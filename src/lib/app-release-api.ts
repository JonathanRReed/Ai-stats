import {benchmarkAssetKey} from './compare-release';
export type AppReleaseEnv={PUBLIC_SUPABASE_URL?:string;PUBLIC_SUPABASE_ANON_KEY?:string};
type Fetcher=(url:string,init?:RequestInit)=>Promise<Response>;
const json=(data:unknown,status=200,cache='no-store')=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':cache,'X-Robots-Tag':'noindex'}});
export async function serveAppRelease(request:Request,env:AppReleaseEnv,fetchImpl:Fetcher=fetch):Promise<Response>{
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 const path=new URL(request.url).pathname;
 const current=path==='/api/releases/current.json';
 const match=path.match(/^\/api\/releases\/([a-f0-9]{64})\/(manifest|measurements\/[a-f0-9]{2}|benchmarks\/[a-z0-9_-]{1,120})\.json$/);
 if(!current&&!match)return json({error:'Not found'},404);
 let origin:string,headers:Record<string,string>;
 try{
 const url=new URL(env.PUBLIC_SUPABASE_URL??''),key=env.PUBLIC_SUPABASE_ANON_KEY??'';
 if(url.protocol!=='https:'||url.hostname!=='bgbqdzmgxkwstjihgeef.supabase.co'||url.port||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw new Error();
 headers={apikey:key};
 if(key.startsWith('sb_publishable_')){if(key.length<16)throw new Error();}
 else{
 const parts=key.split('.');if(parts.length!==3)throw new Error();
 const claims=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
 if(claims.role!=='anon')throw new Error();headers.Authorization='Bearer '+key;
 }
 origin=url.origin;
 }catch{return json({error:'Data unavailable'},503);}
 const query=new URLSearchParams({limit:'1'});
 if(current){query.set('select','revision,dataset_revision,generated_at,published_at');query.set('active','eq.true');}
 else{
 query.set('revision','eq.'+match![1]);const route=match![2];
 if(route==='manifest')query.set('select','payload:manifest');
 else{
 const key=route.startsWith('measurements/')?'m_'+route.slice('measurements/'.length):benchmarkAssetKey(route.slice('benchmarks/'.length));
 query.set('select','payload:assets->'+key);
 }
 }
 try{
 const response=await fetchImpl(origin+'/rest/v1/app_release_cache?'+query,{headers,signal:AbortSignal.timeout(8000)});
 if(!response.ok)return json({error:'Data unavailable'},503);
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length>1)return json({error:'Data unavailable'},503);
 if(!rows.length)return json({error:'Not found'},404);
 const row=rows[0];
 const payload=current?{schemaVersion:1,revision:row.revision,datasetRevision:row.dataset_revision,generatedAt:row.generated_at,publishedAt:row.published_at}:row.payload;
 if(!payload||typeof payload!=='object')return json({error:'Not found'},404);
 if(current&&(!/^[a-f0-9]{64}$/.test(payload.revision??'')||!/^[a-f0-9]{64}$/.test(payload.datasetRevision??'')))return json({error:'Data unavailable'},503);
 const result=json(payload,200,current?'public, max-age=60, s-maxage=60':'public, max-age=31536000, immutable');
 return request.method==='HEAD'?new Response(null,{status:result.status,headers:result.headers}):result;
 }catch{return json({error:'Data unavailable'},503);}
}
