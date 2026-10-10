import {expect,test} from 'bun:test';
import {copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const validator=path.join(root,'scripts/validate-app-release-db.mjs');
const databaseModule=fileURLToPath(import.meta.resolve('@electric-sql/pglite'));
const migrations=[
 '20261002200437_independent_app_release_cache.sql',
 '20261003024932_app_release_publication_timeout.sql',
 '20261003173339_publisher_release_protocol_v2.sql'
];
async function validate(cwd=root) {
 const child=Bun.spawn([process.execPath,validator],{
  cwd,env:{...process.env,PGLITE_TEST_MODULE:databaseModule},stdout:'pipe',stderr:'pipe'
 });
 const [code,out,err]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
 return {code,out,err};
}

test('validates the real app-release migration path and synthetic publication contract',async()=>{
 const {code,out,err}=await validate();
 expect(code,err).toBe(0);
 expect(out).toContain('PASS:');
},20000);

for(const mutation of ['no-op','wrong timeout']) {
 test(`rejects a ${mutation} standalone timeout migration before v2 can mask it`,async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'app-release-migration-test-'));
  try {
   const target=path.join(dir,'supabase/migrations');
   await mkdir(target,{recursive:true});
   for(const migration of migrations) await copyFile(path.join(root,'supabase/migrations',migration),path.join(target,migration));
   const timeoutPath=path.join(target,migrations[1]);
   const sql=await readFile(timeoutPath,'utf8');
   await writeFile(timeoutPath,mutation==='no-op'?'-- Intentionally missing timeout change.\n':sql.replace("'30s'","'8s'"));
   const {code,err}=await validate(dir);
   expect(code).not.toBe(0);
   expect(err).toContain('standalone timeout migration must configure statement_timeout=30s');
  }finally{await rm(dir,{recursive:true,force:true});}
 },20000);
}
