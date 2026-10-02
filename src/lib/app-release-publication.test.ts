import {expect,test} from 'bun:test';
import {publishAppRelease,readAppReleaseArtifacts} from '../../scripts/publish-app-release.mjs';
import {fixture} from './compare-release.fixture';
import {measurementBucket} from './compare-delivery';
import {prepareAppRelease} from '../../scripts/app-release.mjs';
const files=()=>{
 const manifest=fixture(),assets:Record<string,unknown>={};
 for(const row of manifest.models){const bucket=measurementBucket(row.id);assets['m_'+bucket]={schemaVersion:1,revision:manifest.delivery.revision,bucket,records:[row]};}
 return {manifest,assets};
};
test('artifact reader resolves only validated snapshot paths',async()=>{
 const {manifest,assets}=files(),paths:string[]=[];
 const release=await readAppReleaseArtifacts('/build',async path=>{
 paths.push(String(path));
 return JSON.stringify(String(path).endsWith('compare-manifest.json')?manifest:assets['m_'+String(path).split('/').at(-1)!.slice(0,2)]);
 });
 expect(release.revision).toMatch(/^[a-f0-9]{64}$/);
 expect(paths).toHaveLength(3);expect(paths.every(path=>path.startsWith('/build/api/'))).toBe(true);
});
test('publisher rejects other projects before using its credential',async()=>{
 const {manifest,assets}=files(),release=prepareAppRelease(manifest,assets);let calls=0;
 await expect(publishAppRelease({release,baseUrl:'https://other.supabase.co',serviceKey:'test-only',fetchImpl:async()=>{calls++;return Response.json(null);}})).rejects.toThrow();
 expect(calls).toBe(0);
});
test('publisher uses the service-only atomic RPC and verifies its receipt',async()=>{
 const {manifest,assets}=files(),release=prepareAppRelease(manifest,assets);
 const result=await publishAppRelease({release,baseUrl:'https://bgbqdzmgxkwstjihgeef.supabase.co',serviceKey:'test-only',fetchImpl:async(url,init)=>{
 expect(url).toBe('https://bgbqdzmgxkwstjihgeef.supabase.co/rest/v1/rpc/publish_app_release');
 const body=JSON.parse(String(init.body));expect(body.p_revision).toBe(release.revision);return Response.json(release.revision);
 }});
 expect(result.revision).toBe(release.revision);
});
