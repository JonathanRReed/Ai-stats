import {describe,expect,it} from 'bun:test';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {digest,splitDocuments,verifyRecovery} from './verify-recovery-export.mjs';
describe('recovery row preservation',()=>{
 it('retains exact large integers, whitespace and escaped braces',()=>{
  const a=String.raw`{"id":9223372036854775807,"value":1.234567890123456789,"text":"}\"{","nested":[{"x":1}]}`;
  const b='{\n "id":2,"text":"line\\nnext"\n}';
  expect(splitDocuments(a+'\n'+b)).toEqual([a,b]);
 });
 it('rejects incomplete rows',()=>{expect(()=>splitDocuments('{"id":')).toThrow();});
 it('rejects invalid JSON',()=>{expect(()=>splitDocuments('{bad}')).toThrow();});
 it('uses raw UTF-8 checksums',()=>{expect(digest('')).toBe('d41d8cd98f00b204e9800998ecf8427e');expect(splitDocuments('{"emoji":"🐕"}')).toEqual(['{"emoji":"🐕"}']);});
});
it('rejects omitted manifest tables before loading an isolated database',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'recovery-coverage-test-'));
 try{
  await writeFile(path.join(dir,'start-manifest.json'),JSON.stringify({tables:[{table_name:'public.required'}]}));
  await writeFile(path.join(dir,'export-progress.json'),'[]');
  await expect(verifyRecovery(dir,'unused-module')).rejects.toThrow('Recovery table set is incomplete');
 }finally{await rm(dir,{recursive:true,force:true});}
});

// Real isolated PostgreSQL fixtures; never load a private export or contact a server.
async function recoveryFixture() {
 const dir=await mkdtemp(path.join(tmpdir(),'recovery-roundtrip-test-'));
 const put=(name:string,value:unknown)=>writeFile(path.join(dir,name),JSON.stringify(value));
 const names=['alpha','beta'];
 const docs=['{"id":9223372036854775807,"text":"🐕"}','{"id":2,"text":"synthetic"}'];
 const progress=names.map(name=>({table:'public.'+name,schema:'public',name,pk:'id',done:true}));
 await put('schema-metadata.json',{
  tables:names.map(table_name=>({schema_name:'public',table_name})),
  columns:names.flatMap(table_name=>[
   {schema_name:'public',table_name,column_name:'id',position:1,data_type:'bigint',not_null:true},
   {schema_name:'public',table_name,column_name:'text',position:2,data_type:'text',not_null:false}
  ]),constraints:[],indexes:[],functions:[],views:[]
 });
 await put('start-manifest.json',{tables:names.map((name,i)=>({table_name:'public.'+name,row_count:1,export_bytes:Buffer.byteLength(docs[i]),content_digest:digest(digest(docs[i]))}))});
 await put('export-progress.json',progress);
 for(let i=0;i<names.length;i++) {
  const chars=[...docs[i]];
  const emojiIndex=chars.indexOf('🐕');
  const size=emojiIndex>=0?emojiIndex+1:12;
  for(let offset=0;offset<chars.length;offset+=size) {
   const part=chars.slice(offset,offset+size).join('');
   await put(`public.${names[i]}.batch-0.part-${offset}.json`,{table:'public.'+names[i],row_offset:0,char_offset:offset,batch_digest:digest(docs[i]),part_digest:digest(part),part,part_size:size,batch_chars:chars.length,batch_bytes:Buffer.byteLength(docs[i]),row_count:1});
  }
 }
 return {dir,put,progress};
}
const databaseModule=fileURLToPath(import.meta.resolve('@electric-sql/pglite'));

it('completes a real fragmented synthetic restore preserving bigint and Unicode',async()=>{
 const {dir}=await recoveryFixture();
 try {
  const report=await verifyRecovery(dir,databaseModule);
  expect(report.complete).toBe(true);
  expect(report.tables.map((t:{table:string,rows:number})=>[t.table,t.rows])).toEqual([['public.alpha',1],['public.beta',1]]);
  expect(JSON.parse(await readFile(path.join(dir,'restore-verification.json'),'utf8')).complete).toBe(true);
 }finally{await rm(dir,{recursive:true,force:true});}
},20000);

it('invalidates a prior successful report when a fragment is damaged',async()=>{
 const {dir,put}=await recoveryFixture();
 try {
  await verifyRecovery(dir,databaseModule);
  const file='public.alpha.batch-0.part-0.json';
  const fragment=JSON.parse(await readFile(path.join(dir,file),'utf8'));
  await put(file,{...fragment,part:'damaged'});
  await expect(verifyRecovery(dir,databaseModule)).rejects.toThrow();
  expect(existsSync(path.join(dir,'restore-verification.json'))).toBe(false);
 }finally{await rm(dir,{recursive:true,force:true});}
},20000);

it('invalidates a prior report even when manifest validation fails before loading the database',async()=>{
 const {dir,put}=await recoveryFixture();
 try {
  await put('restore-verification.json',{complete:true});
  await put('export-progress.json',[]);
  await expect(verifyRecovery(dir,'unused-module')).rejects.toThrow('Recovery table set is incomplete');
  expect(existsSync(path.join(dir,'restore-verification.json'))).toBe(false);
 }finally{await rm(dir,{recursive:true,force:true});}
});

it('rejects destination names swapped between valid manifest tables',async()=>{
 const {dir,put,progress}=await recoveryFixture();
 try {
  await put('export-progress.json',progress.map((entry,i)=>({...entry,name:progress[1-i].name})));
  await expect(verifyRecovery(dir,databaseModule)).rejects.toThrow('Recovery destination differs from manifest identity');
  expect(existsSync(path.join(dir,'restore-verification.json'))).toBe(false);
 }finally{await rm(dir,{recursive:true,force:true});}
},20000);

it('rejects a missing fragment and leaves no successful report',async()=>{
 const {dir}=await recoveryFixture();
 try {
  await rm(path.join(dir,'public.alpha.batch-0.part-0.json'));
  await expect(verifyRecovery(dir,databaseModule)).rejects.toThrow();
  expect(existsSync(path.join(dir,'restore-verification.json'))).toBe(false);
 }finally{await rm(dir,{recursive:true,force:true});}
},20000);

it('rejects a mismatched destination schema before loading the database',async()=>{
 const {dir,put,progress}=await recoveryFixture();
 try {
  await put('export-progress.json',progress.map(entry=>({...entry,schema:'private'})));
  await expect(verifyRecovery(dir,'unused-module')).rejects.toThrow('Recovery destination differs from manifest identity');
 }finally{await rm(dir,{recursive:true,force:true});}
});
