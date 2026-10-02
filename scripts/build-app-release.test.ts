import {releaseDatasetRevision} from './app-release.mjs';
import {fromEpochRuns} from '../src/lib/compare-evidence';
import {benchmarkAssetKey} from '../src/lib/compare-release';
import {expect,test} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readAppReleaseArtifacts} from './publish-app-release.mjs';
import {assembleAppRelease,writeAppReleaseArtifacts} from './build-app-release.mjs';
import {fixture} from '../src/lib/compare-release.fixture';
import {measurementBucket} from '../src/lib/compare-delivery';
test('data-only compilation produces validated artifacts without an Astro site build',()=>{
 const manifest=fixture(),chunks=new Map<string,typeof manifest.models>();
 for(const model of manifest.models){const bucket=measurementBucket(model.id);chunks.set(bucket,[...(chunks.get(bucket)??[]),model]);}
 const release=assembleAppRelease(manifest,{delivery:manifest.delivery,chunks,data:{epoch:{epochRuns:[],fetchedAt:null}}});
 expect(release.manifest.datasetRevision).toBe(manifest.datasetRevision);
 expect(Object.keys(release.assets)).toHaveLength(2);
 expect(release.revision).toMatch(/^[a-f0-9]{64}$/);
});
test('data-only compilation rejects incomplete measurements before writing',()=>{
 const manifest=fixture();
 expect(()=>assembleAppRelease(manifest,{delivery:manifest.delivery,chunks:new Map(),data:{epoch:{epochRuns:[],fetchedAt:null}}})).toThrow();
});

test('data-only artifacts round-trip through the existing publisher contract',async()=>{
 const manifest=fixture(),chunks=new Map<string,typeof manifest.models>();
 for(const model of manifest.models){const bucket=measurementBucket(model.id);chunks.set(bucket,[...(chunks.get(bucket)??[]),model]);}
 const release=assembleAppRelease(manifest,{delivery:manifest.delivery,chunks,data:{epoch:{epochRuns:[],fetchedAt:null}}});
 const directory=await mkdtemp(join(tmpdir(),'aistats-artifact-test-'));
 try{await writeAppReleaseArtifacts(release,directory);expect((await readAppReleaseArtifacts(directory)).revision).toBe(release.revision);}
 finally{await rm(directory,{recursive:true,force:true});}
});

test('two benchmark assets retain only their own runs and original retrieval date',async()=>{
 const fetchedAt='2026-10-02T19:43:00.000Z';
 const runs=[
 {id:'alpha-run',model_version:'model-a',benchmark_slug:'alpha',score:37,score_unit:'percent',score_metric:'accuracy',conditions:{shots:0}},
 {id:'beta-run',model_version:'model-b',benchmark_slug:'beta',score:0,score_unit:'native',score_metric:'tasks',conditions:{attempts:1}}
 ];
 const manifest={...fixture(),benchmarks:[{slug:'alpha',name:'Alpha'},{slug:'beta',name:'Beta'}]};
 manifest.datasetRevision=releaseDatasetRevision(manifest,fromEpochRuns(runs as Parameters<typeof fromEpochRuns>[0],fetchedAt));
 const chunks=new Map<string,typeof manifest.models>();
 for(const model of manifest.models){const bucket=measurementBucket(model.id);chunks.set(bucket,[...(chunks.get(bucket)??[]),model]);}
 const release=assembleAppRelease(manifest,{delivery:manifest.delivery,chunks,data:{epoch:{epochRuns:runs,fetchedAt}}});
 const directory=await mkdtemp(join(tmpdir(),'aistats-benchmark-artifacts-'));
 try{
 await writeAppReleaseArtifacts(release,directory);
 const restored=await readAppReleaseArtifacts(directory);
 for(const [slug,id,value] of [['alpha','alpha-run',37],['beta','beta-run',0]] as const){
 const asset=restored.assets[benchmarkAssetKey(slug)];
 expect(asset.fetchedAt).toBe(fetchedAt);expect(asset.observations).toHaveLength(1);
 expect(asset.observations[0]).toMatchObject({id,benchmarkSlug:slug,value,fetchedAt});
 }
 expect(restored.revision).toBe(release.revision);
 }finally{await rm(directory,{recursive:true,force:true});}
});
