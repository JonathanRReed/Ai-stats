import {serveAppRelease,type AppReleaseEnv} from '../../../src/lib/app-release-api';
type Context={request:Request;env:AppReleaseEnv;waitUntil:(promise:Promise<unknown>)=>void};
export async function onRequest(context:Context){
 if(!['GET','HEAD'].includes(context.request.method))return serveAppRelease(context.request,context.env);
 const url=new URL(context.request.url);url.search='';
 const key=new Request(url,{method:'GET'});
 const cache=(caches as CacheStorage&{default:Cache}).default;
 const cached=await cache.match(key);
 if(cached)return context.request.method==='HEAD'?new Response(null,{status:cached.status,headers:cached.headers}):cached;
 const result=await serveAppRelease(key,context.env);
 if(result.status===200)context.waitUntil(cache.put(key,result.clone()));
 return context.request.method==='HEAD'?new Response(null,{status:result.status,headers:result.headers}):result;
}
