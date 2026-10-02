import {expect,test} from 'bun:test';
import {serveAppRelease} from './app-release-api';
const env={PUBLIC_SUPABASE_URL:'https://bgbqdzmgxkwstjihgeef.supabase.co',PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_test'};
const revision='a'.repeat(64);
test('release API is read-only and does not proxy arbitrary paths or projects',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return Response.json([]);};
 expect((await serveAppRelease(new Request('https://site.test/api/releases/current.json',{method:'POST'}),env,fetchImpl)).status).toBe(405);
 expect((await serveAppRelease(new Request('https://site.test/api/releases/users.json'),env,fetchImpl)).status).toBe(404);
 expect((await serveAppRelease(new Request('https://site.test/api/releases/current.json'),{...env,PUBLIC_SUPABASE_URL:'https://other.supabase.co'},fetchImpl)).status).toBe(503);
 expect(calls).toBe(0);
});
test('current release check returns small metadata without downloading the asset cache',async()=>{
 const response=await serveAppRelease(new Request('https://site.test/api/releases/current.json'),env,async url=>{
 const params=new URL(String(url)).searchParams;
 expect(params.get('select')).toBe('revision,dataset_revision,generated_at,published_at');
 expect(params.get('active')).toBe('eq.true');
 return Response.json([{revision,dataset_revision:'b'.repeat(64),generated_at:'2026-10-02T12:00:00Z',published_at:'2026-10-02T13:00:00Z'}]);
 });
 expect(await response.json()).toMatchObject({revision,datasetRevision:'b'.repeat(64)});expect(response.headers.get('Cache-Control')).toContain('60');
});
test('asset reads project a single fixed JSON key and never use privileged credentials',async()=>{
 const response=await serveAppRelease(new Request('https://site.test/api/releases/'+revision+'/measurements/0a.json'),env,async(url,init)=>{
 expect(new URL(String(url)).searchParams.get('select')).toBe('payload:assets->m_0a');
 expect(new Headers(init!.headers).get('apikey')).toBe(env.PUBLIC_SUPABASE_ANON_KEY);
 expect(new Headers(init!.headers).get('authorization')).toBeNull();
 return Response.json([{payload:{schemaVersion:1,records:[]}}]);
 });
 expect(response.status).toBe(200);
 let calls=0;const secret={...env,PUBLIC_SUPABASE_ANON_KEY:'sb_secret_do_not_use'};
 expect((await serveAppRelease(new Request('https://site.test/api/releases/current.json'),secret,async()=>{calls++;return Response.json([]);})).status).toBe(503);
 expect(calls).toBe(0);
});
test('missing cache or upstream failure leaves the static app usable',async()=>{
 const request=new Request('https://site.test/api/releases/current.json');
 expect((await serveAppRelease(request,env,async()=>Response.json([]))).status).toBe(404);
 const response=await serveAppRelease(request,env,async()=>new Response('private upstream error',{status:500}));
 expect(response.status).toBe(503);expect(await response.text()).not.toContain('private upstream');
});
