import {readFile} from 'node:fs/promises';
import {expect,test} from 'bun:test';
import * as catalogs from './public-catalogs.mjs';
test('privileged refresh is main-only and checks out reviewed main',async()=>{
 const workflow=await readFile('.github/workflows/refresh-benchmarks.yml','utf8');
 expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
 expect(workflow).toContain('ref: main');
 expect(workflow).not.toContain('ref: ${{ github.ref_name }}');
});
test('embedding reader keeps valid records and excludes conflicting duplicates',()=>{
 const rows=catalogs.normalizeEmbeddingCatalog?.({data:[
 {id:'lab/good',pricing:{prompt:'0.000002'}},{name:'missing id'},null,
 {id:'lab/conflict',pricing:{prompt:'0.01'}},{id:'lab/conflict',pricing:{prompt:'0.02'}},
 ]});
 expect(rows?.map(row=>row.id)).toEqual(['lab/good']);
 expect(rows?.[0].prompt_price_1m).toBe(2);
 expect(()=>catalogs.normalizeCatalog('openrouter',{data:[{id:'lab/good'},{name:'missing'}]})).toThrow();
});
test('an unusable embedding response fails rather than refreshing an empty success',()=>{
 expect(()=>catalogs.normalizeEmbeddingCatalog?.({data:[null,{name:'missing'}]})).toThrow();
});
