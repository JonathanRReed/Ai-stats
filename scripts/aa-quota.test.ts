import {expect,test} from 'bun:test';
import {readAaRateHeaders,createAaRequestGate} from '../supabase/functions/ingest-artificialanalysis/quota';
test('AA fixed-window receipts retain the upstream reset and Retry-After',()=>{
 const now=Date.parse('2026-10-02T20:00:00Z');
 expect(readAaRateHeaders(new Headers({'X-RateLimit-Limit':'100','X-RateLimit-Remaining':'12','X-RateLimit-Reset':String((now+3600000)/1000),'Retry-After':'7200'}),429,now)).toEqual({limit:100,remaining:12,reset:'2026-10-02T21:00:00.000Z',notBefore:'2026-10-02T22:00:00.000Z'});
 expect(readAaRateHeaders(new Headers(),500,now).notBefore).toBe('2026-10-02T20:05:00.000Z');
});
test('request gate reserves before fetch and persists every response including tier failures',async()=>{
 const calls:string[]=[];const client={rpc:async(name:string)=>{calls.push(name);return {data:true,error:null};}};
 const gate=createAaRequestGate(client,'lease',async()=>{calls.push('fetch');return new Response('{}',{status:403,headers:{'X-RateLimit-Remaining':'50'}});});
 await gate('https://artificialanalysis.ai/api/v2/language/models',{});
 expect(calls).toEqual(['reserve_aa_request','fetch','record_aa_response']);
});
test('quota exhaustion and failed state persistence never make another upstream call',async()=>{
 let calls=0;const gate=createAaRequestGate({rpc:async()=>({data:false,error:null})},'lease',async()=>{calls++;return new Response();});
 await expect(gate('https://artificialanalysis.ai/api/v2/language/models',{})).rejects.toThrow();
 expect(calls).toBe(0);
});
