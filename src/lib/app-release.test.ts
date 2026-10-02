import {expect,test} from 'bun:test';
import {prepareAppRelease} from '../../scripts/app-release.mjs';
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
