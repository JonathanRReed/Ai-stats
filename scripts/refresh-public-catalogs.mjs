import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import { CATALOG_URLS, normalizeCatalog, validCatalogRecords } from './public-catalogs.mjs';
import { prepareSourceSnapshot } from './source-snapshots.mjs';
import { retryDelayMs } from './source-refresh-policy.mjs';

const verifiedCachedInput = (sourceKey, cached, fetchedAt) => {
  if (!cached || cached.payload?.schemaVersion !== 1 || cached.payload?.sourceKey !== sourceKey ||
    !validCatalogRecords(sourceKey,cached.payload.records) || cached.source_key!==sourceKey ||
    cached.record_count!==cached.payload.records.length) throw new Error('No validated cached catalog');
  const input = { sourceKey, observedAt: cached.payload.observedAt ?? null, fetchedAt, records: cached.payload.records };
  const checked=prepareSourceSnapshot(input);
  if(checked.contentHash!==cached.content_hash)throw new Error('Cached catalog hash mismatch');
  return input;
};
/**
 * One admitted upstream request. Successful candidates are promoted after build verification.
 * @param {{sourceKey:string, store:Record<string,Function>, fetchImpl?:(input:string|URL|Request,init?:RequestInit)=>Promise<Response>, now?:string}} options
 */
export async function prepareCatalogRefresh({ sourceKey, store, fetchImpl = (url,init) => globalThis.fetch(url,init), now: fixedNow }) {
  const clock = () => fixedNow ?? new Date().toISOString();
  const now = clock();
  if (!Object.hasOwn(CATALOG_URLS, sourceKey)) throw new Error('Unknown public catalog');
  if (!Number.isFinite(Date.parse(now))) throw new Error('Invalid refresh clock');
  const lease = await store.claim(sourceKey);
  if (!lease.claimed) return { sourceKey, status: 'skipped', reason: lease.reason };
  let retryAfter = null;
  try {
    const cached = await store.current(sourceKey);
    const headers = new Headers({ Accept: 'application/json', 'User-Agent': 'AI-Stats/1.0' });
    if (lease.etag) headers.set('If-None-Match', lease.etag);
    if (lease.lastModified) headers.set('If-Modified-Since', lease.lastModified);
    const response = await fetchImpl(CATALOG_URLS[sourceKey], {
      headers, redirect: 'error', signal: AbortSignal.timeout(30000),
    });
    retryAfter = response.headers.get('Retry-After');
    let input;
    if (response.status === 304) {
      input = verifiedCachedInput(sourceKey, cached, clock());
    } else {
      if (!response.ok) throw new Error('Catalog request failed (' + response.status + ')');
      const records = normalizeCatalog(sourceKey, await response.json());
      const priorCount = cached?.payload?.records?.length ?? 0;
      if (priorCount && records.length < priorCount * .8) throw new Error('Catalog coverage fell by more than 20%; retaining last good snapshot');
      input = { sourceKey, observedAt: null, fetchedAt: clock(), records };
      prepareSourceSnapshot(input);
    }
    return { sourceKey, status: response.status === 304 ? 'unchanged' : 'prepared',
      leaseId: lease.leaseId, input, etag: response.headers.get('ETag') ?? (response.status === 304 ? lease.etag ?? null : null),
      lastModified: response.headers.get('Last-Modified') ?? (response.status === 304 ? lease.lastModified ?? null : null) };
  } catch (error) {
    const failedAt = Date.parse(clock());
    const delay = retryDelayMs(retryAfter, lease.attempts ?? 0, failedAt);
    const retryAt = failedAt + delay;
    const notBefore = Number.isFinite(retryAt) && retryAt <= 8640000000000000 ? new Date(retryAt).toISOString() : 'infinity';
    await store.fail({ sourceKey, leaseId: lease.leaseId, notBefore,
      message: error instanceof Error ? error.message : 'Catalog refresh failed' });
    return { sourceKey, status: 'failed' };
  }
}

/** @param {{baseUrl:string,serviceKey:string,fetchImpl?:(input:string|URL|Request,init?:RequestInit)=>Promise<Response>}} options */
export function createCatalogStore({baseUrl,serviceKey,fetchImpl=(url,init)=>globalThis.fetch(url,init)}) {
  let origin;
  try {
    const url=new URL(baseUrl);
    if(url.protocol!=='https:'||url.hostname!=='bgbqdzmgxkwstjihgeef.supabase.co'||url.port||
      url.username||url.password||url.search||url.hash||(url.pathname!=='/'&&url.pathname!=='')) throw new Error('origin');
    origin=url.origin;
  } catch {throw new Error('Catalog storage requires the authorized production project origin');}
  if(typeof serviceKey!=='string'||!serviceKey.trim())throw new Error('Missing server-side catalog credentials');
  const checkSource=sourceKey=>{if(sourceKey!=='openrouter-usage'&&!Object.hasOwn(CATALOG_URLS,sourceKey))throw new Error('Unknown public catalog');};
  const request=async(endpoint,body)=>{
    let response;
    try {response=await fetchImpl(origin+'/rest/v1/'+endpoint,{
      method:body===undefined?'GET':'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000),
      headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,Accept:'application/json','Content-Type':'application/json'},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
    });}catch{throw new Error('Catalog storage request failed');}
    if(!response.ok)throw new Error('Catalog storage request failed ('+response.status+')');
    try{return await response.json();}catch{throw new Error('Catalog storage returned invalid JSON');}
  };
  return {
    claim:async sourceKey=>{
      checkSource(sourceKey);
      const result=await request('rpc/claim_catalog_refresh',{p_source_key:sourceKey});
      if(!result||typeof result.claimed!=='boolean'||(result.claimed&&typeof result.leaseId!=='string'))
        throw new Error('Invalid catalog lease response');
      return result;
    },
    current:async sourceKey=>{
      checkSource(sourceKey);
      const query=new URLSearchParams({source_key:'eq.'+sourceKey,select:'source_key,snapshot_id,content_hash,payload,fetched_at,published_at,record_count,refresh_status,refresh_message'});
      const rows=await request('source_snapshot_cache?'+query,undefined);
      if(!Array.isArray(rows)||rows.length>1)throw new Error('Invalid current catalog response');
      return rows[0]??null;
    },
    fail:async({sourceKey,leaseId,notBefore,message})=>{
      checkSource(sourceKey);
      return request('rpc/fail_catalog_refresh',{p_source_key:sourceKey,p_lease_id:leaseId,p_not_before:notBefore,p_error:message});
    },
    publish:async candidate=>{
      checkSource(candidate.sourceKey);
      if(!['prepared','unchanged'].includes(candidate.status)||candidate.input?.sourceKey!==candidate.sourceKey||
        typeof candidate.leaseId!=='string')throw new Error('Invalid catalog publication candidate');
      const snapshot=prepareSourceSnapshot(candidate.input);
      const id=await request('rpc/publish_catalog_refresh',{
        p_source_key:snapshot.sourceKey,p_lease_id:candidate.leaseId,p_content_hash:snapshot.contentHash,
        p_observed_at:snapshot.observedAt,p_fetched_at:snapshot.fetchedAt,
        p_payload:{schemaVersion:1,sourceKey:snapshot.sourceKey,observedAt:snapshot.observedAt,records:snapshot.records},
        p_record_count:snapshot.recordCount,p_etag:candidate.etag??null,p_last_modified:candidate.lastModified??null,
      });
      if(!Number.isSafeInteger(id)||id<=0)throw new Error('Invalid published catalog snapshot identity');
      return id;
    },
  };
}
const argument=(argv,name)=>{const index=argv.indexOf(name);return index>=0?argv[index+1]:undefined;};
export async function runCatalogCli({argv=process.argv.slice(2),env=process.env,fetchImpl=(url,init)=>globalThis.fetch(url,init)}={}) {
  const store=createCatalogStore({baseUrl:env.SUPABASE_URL??'',serviceKey:env.SUPABASE_SERVICE_ROLE_KEY??'',fetchImpl});
  if(argv.includes('--prepare')===argv.includes('--publish'))throw new Error('Choose exactly one of --prepare or --publish');
  const file=path.resolve(argument(argv,argv.includes('--prepare')?'--output':'--input')??'.tmp/public-catalog-candidates.json');
  if(argv.includes('--prepare')){
    const candidates=[];
    for(const sourceKey of Object.keys(CATALOG_URLS))candidates.push(await prepareCatalogRefresh({sourceKey,store,fetchImpl}));
    await mkdir(path.dirname(file),{recursive:true});
    await writeFile(file,JSON.stringify({schemaVersion:1,candidates})+'\n',{mode:0o600});
    return candidates.map(({sourceKey,status})=>({sourceKey,status}));
  }
  const batch=JSON.parse(await readFile(file,'utf8'));
  if(batch.schemaVersion!==1||!Array.isArray(batch.candidates)||batch.candidates.length>3||
    new Set(batch.candidates.map(item=>item.sourceKey)).size!==batch.candidates.length)throw new Error('Invalid catalog candidate batch');
  const result=[];
  for(const candidate of batch.candidates){
    if(!Object.hasOwn(CATALOG_URLS,candidate.sourceKey)||!['prepared','unchanged','failed','skipped'].includes(candidate.status))
      throw new Error('Unknown catalog candidate');
    if(['prepared','unchanged'].includes(candidate.status)){
      const snapshotId=await store.publish(candidate);
      result.push({sourceKey:candidate.sourceKey,status:'published',snapshotId});
    }else result.push({sourceKey:candidate.sourceKey,status:candidate.status});
  }
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  runCatalogCli().then(result=>console.log(JSON.stringify(result))).catch(error=>{
    console.error(error instanceof Error?error.message:'Catalog refresh failed');process.exitCode=1;
  });
}
