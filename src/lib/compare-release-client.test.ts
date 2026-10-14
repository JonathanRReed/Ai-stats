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

test('a newer pre-capability v2 release cannot replace the dated v3 snapshot',async()=>{
 const manifest={...fixture(),schemaVersion:'ai-stats-compare-release.v2',delivery:{...fixture().delivery,suggestedModelIds:undefined}};let calls=0;
 const result=await fetchNewCompareRelease('old',async()=>Response.json(++calls===1?{schemaVersion:1,revision:'a'.repeat(64),datasetRevision:manifest.datasetRevision}:manifest));
 expect(result).toBeNull();
});

test('a populated v3 refresh atomically applies its new leader and cohort selection',async()=>{
 const updated=fixture();updated.datasetRevision='c'.repeat(64);updated.generatedAt='2026-10-03T12:00:00.000Z';
 // The release includes the replacement cohort leader in both its chart
 // suggestions and matching seed, so no defaults are borrowed from the page.
 updated.models=[updated.models[1]];updated.defaultModelIds=['b'];
 updated.delivery.suggestedModelIds={'task-cost':['b'],'cost-intelligence':['b'],'speed-intelligence':['b'],price:[],'total-cost':['b']};
 const paths:string[]=[];
 const result=await fetchNewCompareRelease('old',async url=>{paths.push(url);return Response.json(paths.length===1?{schemaVersion:1,revision:'a'.repeat(64),datasetRevision:updated.datasetRevision}:updated);});
 expect(result?.manifest.datasetRevision).toBe(updated.datasetRevision);
 expect(result?.manifest.models.map(model=>model.id)).toEqual(['b']);
 expect(result?.manifest.defaultModelIds).toEqual(['b']);
 expect(result?.manifest.delivery.suggestedModelIds?.['task-cost']).toEqual(['b']);
});
