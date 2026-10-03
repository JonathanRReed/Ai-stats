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
