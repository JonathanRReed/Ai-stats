import {expect,test} from 'bun:test';
import {prepareAppRelease,releaseDatasetRevision} from '../../scripts/app-release.mjs';
import {fixture} from './compare-release.fixture';
import {measurementBucket} from './compare-delivery';
const assetsFor=(manifest:ReturnType<typeof fixture>)=>{
 const assets:Record<string,unknown>={};
 for(const row of manifest.models){const bucket=measurementBucket(row.id),key='m_'+bucket;const item=assets[key] as {records:unknown[]}|undefined;
 if(item)item.records.push(row);else assets[key]={schemaVersion:1,revision:manifest.delivery.revision,bucket,records:[row]};}
 return assets;
};
test('public release hashes are stable and every measurement bucket is validated',()=>{
 const manifest=fixture(),assets=assetsFor(manifest),release=prepareAppRelease(manifest,assets);
 expect(release.revision).toMatch(/^[a-f0-9]{64}$/);expect(prepareAppRelease(manifest,assets).revision).toBe(release.revision);
 expect(()=>prepareAppRelease(manifest,{})).toThrow();
 expect(()=>prepareAppRelease({...manifest,password:'private'},assets)).toThrow();
});

test('seed values must equal their verified measurement records',()=>{
 const manifest=structuredClone(fixture()),assets=structuredClone(assetsFor(manifest));
 manifest.models[0].intelligence=99;
 expect(()=>prepareAppRelease(manifest,assets)).toThrow();
});
test('changed measurements cannot reuse the prior dataset fingerprint',()=>{
 const manifest=structuredClone(fixture()),assets=structuredClone(assetsFor(manifest));
 (assets['m_'+measurementBucket('a')] as {records:Array<{intelligence:number}>}).records[0].intelligence=98;
 expect(()=>prepareAppRelease(manifest,assets)).toThrow();
});
test('incomplete benchmark observations cannot enter a published release',()=>{
 const manifest={...fixture(),benchmarks:[{slug:'test',name:'Test'}]};
 const observation={id:'row',modelVersion:'model',benchmarkSlug:'test',value:1,unit:'native'};
 manifest.datasetRevision=releaseDatasetRevision(manifest,[observation]);
 const assets={...assetsFor(manifest),b_74657374:{schemaVersion:1,slug:'test',observations:[observation]}};
 expect(()=>prepareAppRelease(manifest,assets)).toThrow();
});
