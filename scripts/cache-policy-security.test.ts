import {test,expect} from 'bun:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const CachePolicy=require('http-cache-semantics');
const request=(cc='max-stale=999999')=>({url:'https://cache.test/item',method:'GET',headers:{host:'cache.test','cache-control':cc}});
function policy(headers:Record<string,string>,requestHeaders:Record<string,string>={},shared=true){
 const p=new CachePolicy({...request(''),headers:{host:'cache.test',...requestHeaders}},{status:200,headers},{shared});
 const time=p.now();p.now=()=>time+10000;return p;
}
const restricted=[
 ['cookie',{'set-cookie':'session=private','cache-control':'max-age=0'}],
 ['private',{'cache-control':'private, max-age=0'}],
 ['no-store',{'cache-control':'no-store, max-age=0'}],
 ['no-cache',{'cache-control':'no-cache, max-age=0'}],
 ['proxy-revalidate',{'cache-control':'proxy-revalidate, max-age=0'}],
 ['vary-star',{'vary':'*','cache-control':'max-age=0'}],
] as const;
for(const [name,headers] of restricted){
 test(name+' cannot be revived by max-stale or stale extensions',()=>{
  const p=policy({...headers,'cache-control':headers['cache-control']+', stale-if-error=999999, stale-while-revalidate=999999'});
  for(const directive of ['max-stale','max-stale=999999']){
   expect(p.satisfiesWithoutRevalidation(request(directive))).toBe(false);
   expect(p.evaluateRequest(request(directive)).response).toBeUndefined();
  }
  expect(p.useStaleWhileRevalidate()).toBe(false);
  expect(p.revalidatedPolicy(request(),{status:500,headers:{}}).matches).toBe(false);
  expect(p.timeToLive()).toBe(0);
  const restored=CachePolicy.fromObject(p.toObject());restored.now=p.now;
  expect(restored.satisfiesWithoutRevalidation(request())).toBe(false);
 });
}
test('request no-store and unauthorized shared responses cannot be revived',()=>{
 for(const headers of [{'cache-control':'no-store'},{authorization:'Bearer test-only'}]){
  const p=policy({'cache-control':'max-age=0, stale-if-error=999999, stale-while-revalidate=999999'},headers);
  expect(p.satisfiesWithoutRevalidation(request())).toBe(false);
  expect(p.useStaleWhileRevalidate()).toBe(false);
  expect(p.revalidatedPolicy(request(),{status:500,headers:{}}).matches).toBe(false);
 }
});
test('ordinary stale public data and explicit cookie opt-ins retain max-stale',()=>{
 for(const headers of [
  {'cache-control':'max-age=0'},
  {'cache-control':'public, max-age=0','set-cookie':'public-cookie=yes'},
  {'cache-control':'immutable, max-age=0','set-cookie':'public-cookie=yes'},
 ]){
  const p=policy(headers);
  expect(p.satisfiesWithoutRevalidation(request())).toBe(true);
  expect(p.satisfiesWithoutRevalidation(request('no-cache'))).toBe(false);
 }
 expect(policy({'cache-control':'private, max-age=0'}, {},false).satisfiesWithoutRevalidation(request())).toBe(true);
});
test('ordinary public stale extensions and fresh TTL remain supported',()=>{
 const p=policy({'cache-control':'public, max-age=0, stale-if-error=100, stale-while-revalidate=100'});
 expect(p.useStaleWhileRevalidate()).toBe(true);
 expect(p.revalidatedPolicy(request(),{status:500,headers:{}}).matches).toBe(true);
 expect(p.timeToLive()).toBeGreaterThan(0);
 const fresh=policy({'cache-control':'public, max-age=120'});
 expect(fresh.storable()).toBe(true);expect(fresh.timeToLive()).toBeGreaterThan(0);
});
