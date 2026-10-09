import {test,expect} from 'bun:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const CachePolicy=require('http-cache-semantics');
const request=(cc='max-stale=999999')=>({url:'https://cache.test/item',method:'GET',headers:{host:'cache.test','cache-control':cc}});
function policy(headers:Record<string,string|undefined>,requestHeaders:Record<string,string|undefined>={},shared=true){
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

test('shared s-maxage cannot disclose an expired authenticated response',()=>{
 const p=policy({'cache-control':'s-maxage=0, stale-if-error=100, stale-while-revalidate=100'},{authorization:'Bearer test-only'});
 expect(p.satisfiesWithoutRevalidation(request())).toBe(false);
 expect(p.useStaleWhileRevalidate()).toBe(false);
 expect(p.revalidatedPolicy(request(),{status:500,headers:{}}).matches).toBe(false);
 expect(p.timeToLive()).toBe(0);
 const fresh=policy({'cache-control':'s-maxage=120, stale-if-error=100, stale-while-revalidate=100'},{authorization:'Bearer test-only'});
 expect(fresh.satisfiesWithoutRevalidation(request())).toBe(true);
 expect(fresh.timeToLive()).toBeGreaterThan(100000);
 expect(fresh.timeToLive()).toBeLessThanOrEqual(110000);
 const privateCache=policy({'cache-control':'s-maxage=0, max-age=120'}, {},false);
 expect(privateCache.satisfiesWithoutRevalidation(request())).toBe(true);
});

for(const directive of ['PrIvAtE','No-StOrE','No-CaChE','PrOxY-ReVaLiDaTe','MuSt-ReVaLiDaTe','S-MaXaGe=0']){
 test('mixed-case '+directive+' preserves the lowercase restriction',()=>{
  const p=policy({'cache-control':directive+', max-age=0, stale-if-error=999999, stale-while-revalidate=999999'});
  expect(p.satisfiesWithoutRevalidation(request())).toBe(false);
  expect(p.useStaleWhileRevalidate()).toBe(false);
  expect(p.revalidatedPolicy(request(),{status:500,headers:{}}).matches).toBe(false);
  expect(p.timeToLive()).toBe(0);
  const restored=CachePolicy.fromObject(p.toObject());restored.now=p.now;
  expect(restored.satisfiesWithoutRevalidation(request())).toBe(false);
 });
}
test('mixed-case request directives retain no-cache and no-store restrictions',()=>{
 const p=policy({'cache-control':'public, max-age=0, stale-while-revalidate=100'});
 expect(p.satisfiesWithoutRevalidation(request('No-CaChE, max-stale=999999'))).toBe(false);
 const noStore=policy({'cache-control':'public, max-age=0, stale-if-error=100'}, {'cache-control':'No-StOrE'});
 expect(noStore.storable()).toBe(false);
 expect(noStore.revalidatedPolicy(request(),{status:500,headers:{}}).matches).toBe(false);
});
for(const vary of [' * ', 'Accept-Encoding, *', '*, Accept-Language']){
 test('wildcard Vary token '+JSON.stringify(vary)+' blocks all reuse paths',()=>{
  const p=policy({'vary':vary,'cache-control':'public, max-age=120, stale-if-error=999999, stale-while-revalidate=999999'});
  expect(p.satisfiesWithoutRevalidation(request())).toBe(false);
  expect(p.useStaleWhileRevalidate()).toBe(false);
  expect(p.revalidatedPolicy(request(),{status:500,headers:{}}).matches).toBe(false);
  expect(p.timeToLive()).toBe(0);
 });
}
test('mixed-case public and fresh max-age remain reusable',()=>{
 const p=policy({'cache-control':'PuBlIc, MaX-AgE=120','set-cookie':'public-cookie=yes'});
 expect(p.storable()).toBe(true);
 expect(p.satisfiesWithoutRevalidation(request())).toBe(true);
 expect(p.timeToLive()).toBeGreaterThan(100000);
});

test('legacy serialized mixed-case directives cannot bypass restrictions',()=>{
 for(const source of ['response','request']){
  const original=policy({'cache-control':'public, max-age=0, stale-if-error=100'});
  const saved=original.toObject();
  if(source==='response')saved.rescc={'PrIvAtE':true,'max-age':'0','stale-if-error':'100'};
  else saved.reqcc={'No-StOrE':true};
  const restored=CachePolicy.fromObject(saved);restored.now=original.now;
  expect(restored.satisfiesWithoutRevalidation(request())).toBe(false);
  expect(restored.revalidatedPolicy(request(),{status:500,headers:{}}).matches).toBe(false);
 }
});

test('ordinary Vary fields still match and wildcard-like names are not wildcards',()=>{
 const p=policy({'vary':'Accept-Language','cache-control':'public, max-age=120'}, {'accept-language':'en'});
 expect(p.satisfiesWithoutRevalidation({...request(),headers:{...request().headers,'accept-language':'en'}})).toBe(true);
 expect(p.satisfiesWithoutRevalidation({...request(),headers:{...request().headers,'accept-language':'fr'}})).toBe(false);
 expect(policy({'vary':'x-*','cache-control':'public, max-age=120'}).satisfiesWithoutRevalidation(request())).toBe(true);
});
