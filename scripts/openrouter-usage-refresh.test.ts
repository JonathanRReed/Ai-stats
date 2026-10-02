import {expect,test} from 'bun:test';
import * as sync from './sync-openrouter-usage.mjs';
const snapshot={schemaVersion:1,period:'day',estimated:false,filters:{},asOf:'2026-10-02T02:00:00.000Z',
 startDate:'2026-10-01',endDate:'2026-10-01',missingDays:[],sourceUrl:'https://openrouter.ai/rankings',
 licenseUrl:'https://creativecommons.org/licenses/by/4.0/',rows:[{date:'2026-10-01',modelPermaslug:'lab/a',totalTokens:'42'}]};
test('usage refresh without auth does not claim a lease or publish',async()=>{
 let calls=0;
 const result=await sync.prepareUsageRefresh?.({apiKey:'',store:{claim:async()=>{calls++;return {claimed:true};}}});
 expect(result).toMatchObject({sourceKey:'openrouter-usage',status:'blocked'});expect(calls).toBe(0);
});
test('usage candidate keeps one replaceable dated snapshot, not appended traffic',async()=>{
 const result=await sync.prepareUsageRefresh?.({apiKey:'test-key',now:'2026-10-02T07:00:00Z',
 store:{claim:async()=>({claimed:true,leaseId:'lease'}),fail:async()=>{}},
 fetchImpl:async()=>Response.json({meta:{as_of:snapshot.asOf,start_date:snapshot.startDate,end_date:snapshot.endDate,version:'v1'},
 data:[{date:'2026-10-01',model_permaslug:'lab/a',total_tokens:'42'}]})});
 expect(result).toMatchObject({status:'prepared',sourceKey:'openrouter-usage',leaseId:'lease'});
 expect(result?.input).toMatchObject({sourceKey:'openrouter-usage',observedAt:snapshot.asOf,records:[{id:'daily-usage',snapshot}]});
});
test('usage rate limit persists its lease-specific hold',async()=>{
 let failure:unknown;
 const result=await sync.prepareUsageRefresh?.({apiKey:'test-key',now:'2026-10-02T07:00:00Z',
 store:{claim:async()=>({claimed:true,leaseId:'lease'}),fail:async(value)=>{failure=value;}},
 fetchImpl:async()=>new Response(null,{status:429,headers:{'Retry-After':'7200'}})});
 expect(result?.status).toBe('failed');expect(failure).toMatchObject({sourceKey:'openrouter-usage',leaseId:'lease',notBefore:'2026-10-02T09:00:00.000Z'});
});
