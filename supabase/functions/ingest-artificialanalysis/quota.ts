type RpcClient={rpc:(name:string,args?:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
const integer=(value:string|null)=>value!==null&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):null;
const iso=(value:number)=>Number.isFinite(value)&&Math.abs(value)<8640000000000000?new Date(value).toISOString():null;
export function readAaRateHeaders(headers:Headers,status:number,now=Date.now()){
 const limit=integer(headers.get('x-ratelimit-limit')),remaining=integer(headers.get('x-ratelimit-remaining'));
 const resetSeconds=integer(headers.get('x-ratelimit-reset')),reset=resetSeconds===null?null:iso(resetSeconds*1000);
 const retry=headers.get('retry-after'),seconds=integer(retry);
 const oversized=retry!==null&&/^\d+$/.test(retry)&&seconds===null;
 const retryTime=oversized?Date.parse('9999-12-31T23:59:59.999Z'):seconds!==null?Math.min(Date.parse('9999-12-31T23:59:59.999Z'),now+seconds*1000):retry?Date.parse(retry):NaN;
 const fallback=status===429||status>=500?now+300000:NaN;
 const backoff=[retryTime,fallback,status===429&&reset?Date.parse(reset):NaN].filter(Number.isFinite);
 return {limit:limit&&limit>0?limit:null,remaining,reset,notBefore:backoff.length?iso(Math.max(...backoff)):null};
}
export function createAaRequestGate(client:RpcClient,lease:string,fetchImpl:(url:string,init:RequestInit)=>Promise<Response>=fetch){
 return async(url:string,init:RequestInit)=>{
 const target=new URL(url);if(target.origin!=='https://artificialanalysis.ai'||!target.pathname.startsWith('/api/v2/language/models'))throw new Error('Invalid AA destination');
 const reservation=await client.rpc('reserve_aa_request',{p_lease:lease});
 if(reservation.error||reservation.data!==true)throw new Error('AA refresh paused by quota or lease guard');
 const response=await fetchImpl(url,{...init,redirect:'error',signal:AbortSignal.timeout(30000)});
 const receipt=readAaRateHeaders(response.headers,response.status);
 const saved=await client.rpc('record_aa_response',{p_lease:lease,p_limit:receipt.limit,p_remaining:receipt.remaining,p_reset:receipt.reset,p_not_before:receipt.notBefore});
 if(saved.error||saved.data!==true)throw new Error('Could not persist AA quota receipt');
 return response;
 };
}
