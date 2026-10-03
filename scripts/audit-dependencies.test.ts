import {test,expect} from 'bun:test';
import {classifyAudit,verifyPatchedDependency} from './audit-dependencies.mjs';
const item={id:1240991,url:'https://github.com/advisories/GHSA-ch52-4w7c-c8xp',severity:'high',vulnerable_versions:'<=4.2.0'};
test('only the exact repaired metadata advisory is classified',()=>{
 expect(classifyAudit({'http-cache-semantics':[item]},1).locallyPatchedAdvisories).toBe(1);
 expect(classifyAudit({},0).locallyPatchedAdvisories).toBe(0);
 for(const [report,status] of [[{},1],[null,0],[[],0],[{other:[item]},1],[{'http-cache-semantics':[{...item,id:1}]},1],[{'http-cache-semantics':[item,item]},1],[{'http-cache-semantics':[item,{...item,url:'new'}]},1],[{'http-cache-semantics':[item]},2]]){
  expect(()=>classifyAudit(report,status)).toThrow();
 }
});
test('installed dependency, patch, lock and all copies satisfy the proof',async()=>{
 expect((await verifyPatchedDependency()).verifiedCopies).toBeGreaterThan(0);
});

test('proof rejects altered patches and hidden unpatched dependency copies',async()=>{
 const {mkdtemp,mkdir,readFile,writeFile,symlink,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const root=await mkdtemp(join(tmpdir(),'cache-proof-'));
 const module=await readFile('node_modules/http-cache-semantics/index.js');
 const patch=await readFile('patches/http-cache-semantics@4.2.0.patch');
 const mapping={'http-cache-semantics@4.2.0':'patches/http-cache-semantics@4.2.0.patch'};
 try{
  await mkdir(join(root,'patches'));
  await mkdir(join(root,'node_modules/http-cache-semantics'),{recursive:true});
  await writeFile(join(root,'package.json'),JSON.stringify({patchedDependencies:mapping}));
  await writeFile(join(root,'bun.lock'),JSON.stringify({patchedDependencies:mapping,packages:{'http-cache-semantics':['http-cache-semantics@4.2.0']}}));
  await writeFile(join(root,'patches/http-cache-semantics@4.2.0.patch'),patch);
  await writeFile(join(root,'node_modules/http-cache-semantics/package.json'),JSON.stringify({name:'http-cache-semantics',version:'4.2.0',main:'index.js'}));
  await writeFile(join(root,'node_modules/http-cache-semantics/index.js'),module);
  expect((await verifyPatchedDependency(root)).verifiedCopies).toBe(1);
  await writeFile(join(root,'patches/http-cache-semantics@4.2.0.patch'),'wrong');
  await expect(verifyPatchedDependency(root)).rejects.toThrow('integrity');
  await writeFile(join(root,'patches/http-cache-semantics@4.2.0.patch'),patch);
  const nested=join(root,'node_modules/parent/node_modules/http-cache-semantics');
  await mkdir(nested,{recursive:true});
  await writeFile(join(nested,'index.js'),'unpatched');
  await symlink(join(root,'node_modules/http-cache-semantics/package.json'),join(nested,'package.json'));
  await expect(verifyPatchedDependency(root)).rejects.toThrow('Unpatched');
 }finally{await rm(root,{recursive:true,force:true});}
});
