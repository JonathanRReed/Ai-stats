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
