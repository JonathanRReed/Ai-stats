import {expect,test} from 'bun:test';
import {fetchNewCompareRelease,shouldApplyRelease} from './compare-release-client';
import {fixture} from './compare-release.fixture';
test('unchanged dataset costs one small request and no manifest download',async()=>{
 const manifest=fixture();let calls=0;
 const result=await fetchNewCompareRelease(manifest.datasetRevision,async()=>{calls++;return Response.json({schemaVersion:1,revision:'a'.repeat(64),datasetRevision:manifest.datasetRevision});});
 expect(result).toBeNull();expect(calls).toBe(1);
});
test('changed data uses validated same-origin immutable paths',async()=>{
 const manifest=fixture(),paths:string[]=[];
 const result=await fetchNewCompareRelease('old',async url=>{paths.push(url);return Response.json(paths.length===1?{schemaVersion:1,revision:'a'.repeat(64),datasetRevision:manifest.datasetRevision}:manifest);});
 expect(paths).toEqual(['/api/releases/current.json','/api/releases/'+ 'a'.repeat(64)+'/manifest.json']);
 expect(result?.manifest.delivery.assetBase).toBe('/api/releases/'+'a'.repeat(64)+'/measurements');
 expect(result?.manifest.delivery.benchmarkBase).toBe('/api/releases/'+'a'.repeat(64)+'/benchmarks');
});
test('mismatched or unavailable release never replaces the current dataset',async()=>{
 const manifest=fixture();let calls=0;
 await expect(fetchNewCompareRelease('old',async()=>Response.json(++calls===1?{schemaVersion:1,revision:'a'.repeat(64),datasetRevision:'b'.repeat(64)}:manifest))).rejects.toThrow();
 expect(await fetchNewCompareRelease('old',async()=>new Response('',{status:404}))).toBeNull();
});
test('background updates never interrupt an active inspection',()=>{
 expect(shouldApplyRelease(true,false)).toBe(true);
 expect(shouldApplyRelease(true,true)).toBe(false);
 expect(shouldApplyRelease(false,false)).toBe(false);
});

test('a newer legacy release cannot downgrade publisher-capable pages',async()=>{
 const manifest={...fixture(),schemaVersion:'ai-stats-compare-release.v1'};let calls=0;
 const result=await fetchNewCompareRelease('old',async()=>Response.json(++calls===1?{schemaVersion:1,revision:'a'.repeat(64),datasetRevision:manifest.datasetRevision}:manifest));
 expect(result).toBeNull();
});
