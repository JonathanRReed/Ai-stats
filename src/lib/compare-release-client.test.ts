import {expect,test} from 'bun:test';
import {fetchNewCompareRelease,isCompatibleLiveRelease,shouldApplyRelease} from './compare-release-client';
import {readCompareRelease} from './compare-release';
import {BROWSE_RANK_POLICY} from './compare-browse-rank';
import {releaseDatasetRevision} from '../../scripts/app-release.mjs';
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

test('a newer padded-policy v3 release cannot replace the strict v4 snapshot',async()=>{
 const manifest={...fixture(),schemaVersion:'ai-stats-compare-release.v3',delivery:{...fixture().delivery,frontierPolicy:undefined,suggestionFrontierCounts:undefined}};let calls=0;
 const result=await fetchNewCompareRelease('old',async()=>Response.json(++calls===1?{schemaVersion:1,revision:'a'.repeat(64),datasetRevision:manifest.datasetRevision}:manifest));
 expect(result).toBeNull();
});

test('a populated v4 refresh atomically applies its new leader and cohort selection',async()=>{
 const updated=fixture();updated.datasetRevision='c'.repeat(64);updated.generatedAt='2026-10-03T12:00:00.000Z';
 // The release includes the replacement cohort leader in both its chart
 // suggestions and matching seed, so no defaults are borrowed from the page.
 updated.models=[updated.models[1]];updated.defaultModelIds=['b'];
 updated.delivery.suggestedModelIds={'task-cost':['b'],'cost-intelligence':['b'],'speed-intelligence':['b'],price:[],'total-cost':['b']};
 updated.delivery.suggestionFrontierCounts={'task-cost':{total:1,truncated:false},'cost-intelligence':{total:1,truncated:false},'speed-intelligence':{total:1,truncated:false},'total-cost':{total:1,truncated:false}};
 const paths:string[]=[];
 const result=await fetchNewCompareRelease('old',async url=>{paths.push(url);return Response.json(paths.length===1?{schemaVersion:1,revision:'a'.repeat(64),datasetRevision:updated.datasetRevision}:updated);});
 expect(result?.manifest.datasetRevision).toBe(updated.datasetRevision);
 expect(result?.manifest.models.map(model=>model.id)).toEqual(['b']);
 expect(result?.manifest.defaultModelIds).toEqual(['b']);
 expect(result?.manifest.delivery.suggestedModelIds?.['task-cost']).toEqual(['b']);
});

const pointer=(datasetRevision:string)=>({schemaVersion:1,revision:'a'.repeat(64),datasetRevision});
const serve=(manifest:unknown)=>{let calls=0;return async()=>Response.json(++calls===1?pointer((manifest as {datasetRevision:string}).datasetRevision):manifest);};
test('an older-contract v4 release without browse ranks never replaces the ranked page',async()=>{
 // Reproduces the preview regression: production's live v4 release predates browse ranks,
 // has a different dataset revision and newer generatedAt, and used to wipe the ranking.
 const base=fixture(),catalog={...base.delivery.catalog};delete catalog.browseRanks;
 const legacy={...base,generatedAt:'2026-10-05T00:00:00.000Z',delivery:{...base.delivery,catalog}};
 legacy.datasetRevision=releaseDatasetRevision(legacy,[]);
 expect(readCompareRelease(legacy).delivery.catalog.browseRanks).toBeUndefined();
 expect(isCompatibleLiveRelease(readCompareRelease(legacy))).toBe(false);
 expect(await fetchNewCompareRelease('old',serve(legacy))).toBeNull();
});
test('a compatible newer release with valid ranks still refreshes live',async()=>{
 const updated=fixture();updated.generatedAt='2026-10-05T00:00:00.000Z';updated.datasetRevision=releaseDatasetRevision(updated,[]);
 const result=await fetchNewCompareRelease('old',serve(updated),undefined,false,'2026-10-02T12:00:00.000Z');
 expect(result?.manifest.delivery.catalog.browseRanks?.policy).toBe(BROWSE_RANK_POLICY);
});
test('a release generated before the rendered page is not applied',async()=>{
 const older=fixture();older.generatedAt='2026-10-01T00:00:00.000Z';older.datasetRevision=releaseDatasetRevision(older,[]);
 expect(await fetchNewCompareRelease('old',serve(older),undefined,false,'2026-10-02T12:00:00.000Z')).toBeNull();
});
test('malformed rank metadata is rejected before it can reach the family browser',async()=>{
 const bad=fixture();bad.delivery.catalog.browseRanks={policy:BROWSE_RANK_POLICY,ranks:{'task-cost':['4.3','0.0']}};bad.datasetRevision=releaseDatasetRevision(bad,[]);
 expect(()=>readCompareRelease(bad)).toThrow(/browse rank/);
 await expect(fetchNewCompareRelease('old',serve(bad))).rejects.toThrow();
});
