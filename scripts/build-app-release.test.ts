import {expect,test} from 'bun:test';
import {assembleAppRelease} from './build-app-release.mjs';
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
