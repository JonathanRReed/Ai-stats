import {expect,test} from 'bun:test';
import {existsSync} from 'node:fs';
const at='2026-10-02T21:00:00.000Z';
const fixture=()=>({
 schemaVersion:'ai-stats-stats.v1',generatedAt:at,
 aaModels:['a','b'].map(id=>({id,name:id,first_seen:at,last_seen:at,current_source_member:true,aa_intelligence_index:0,price_1m_input_tokens:0,price_1m_output_tokens:1,source_metadata:{intelligence_index_version:'4.3'}})),
 epochModels:[{id:'e',model_version:'epoch-model'}],
 epochBenchmarks:[{id:'bench',slug:'bench',name:'Benchmark'}],
 epochRuns:[{id:'run',model_version:'epoch-model',benchmark_id:'bench',benchmark_slug:'bench',score:0,score_unit:'native',conditions:{shots:0},evaluation_date:'2026-09-01',source_link:'https://epoch.ai/benchmarks',score_metric:'tasks'}],
 epochFetchedAt:at,
 publicCatalogs:{openRouterModels:[],openRouterUsageRankings:[],openRouterProviders:[],openRouterModelCount:null,openRouterEmbeddingModels:[],openRouterEndpointSummaries:[]},
 freshness:{updatedAt:at,aaLastSeen:at,epochFetchedAt:at,sources:[{sourceKey:'artificial-analysis',displayName:'Artificial Analysis',status:'healthy',lastObservedAt:null,lastSuccessfulRunAt:at,fetchedAt:at,publishedAt:null,coverageLabel:null,ageDays:0,message:''}],fallback:{mode:'live-view',fallback:false,reason:null}},
 coverage:{records:2,historical:0,membershipUnverified:0,complete:true,unavailableSources:[],sources:[{key:'aa',name:'Artificial Analysis',count:2,available:true}]},
 polibench:null,usage:null
});
const contract=async()=>{
 const present=existsSync(new URL('../src/lib/stats-snapshot.ts',import.meta.url));
 expect(present).toBe(true);
 if(!present)throw new Error('Stats snapshot contract is missing');
 return import('../src/lib/stats-snapshot');
};
test('Stats snapshots retain zero measurements and distinct source dates',async()=>{
 const {readStatsSnapshot}=await contract();
 const snapshot=readStatsSnapshot(fixture(),{aaIds:['a','b']});
 expect(snapshot.aaModels[0].aa_intelligence_index).toBe(0);
 expect(snapshot.epochRuns[0]).toMatchObject({score:0,score_unit:'native',evaluation_date:'2026-09-01'});
 expect(snapshot.epochFetchedAt).toBe(at);
 expect(snapshot.polibench).toBeNull();
 expect(snapshot.usage).toBeNull();
});
test('Stats rejects missing current models, duplicate identities and retired rows',async()=>{
 const {readStatsSnapshot}=await contract();
 const missing=fixture();missing.aaModels.pop();
 expect(()=>readStatsSnapshot(missing,{aaIds:['a','b']})).toThrow();
 const duplicate=fixture();duplicate.aaModels[1].id='a';
 expect(()=>readStatsSnapshot(duplicate)).toThrow();
 const retired=fixture();retired.aaModels[0].current_source_member=false;
 expect(()=>readStatsSnapshot(retired)).toThrow();
});
test('Stats rejects private fields, credential URLs and nonfinite values',async()=>{
 const {readStatsSnapshot,statsSnapshotText}=await contract();
 expect(()=>readStatsSnapshot({...fixture(),api_key:'must-not-publish'})).toThrow();
 const secret=fixture();secret.epochRuns[0].source_link='https://example.com/?token=private';
 expect(()=>readStatsSnapshot(secret)).toThrow();
 const invalid=fixture();invalid.aaModels[0].aa_intelligence_index=Infinity;
 expect(()=>statsSnapshotText(invalid)).toThrow();
});
test('Stats does not guess Epoch units from score magnitude',async()=>{
 const {readStatsSnapshot}=await contract();
 const sample=fixture();sample.epochRuns[0].score=0.7;
 expect(readStatsSnapshot(sample).epochRuns[0].score_unit).toBe('native');
 const invalid=fixture();invalid.epochRuns[0].score_unit='guessed';
 expect(()=>readStatsSnapshot(invalid)).toThrow();
});
test('Stats canonical content is independent of object insertion order',async()=>{
 const {statsSnapshotText}=await contract();
 const a=fixture(),b=Object.fromEntries(Object.entries(a).reverse());
 expect(statsSnapshotText(a)).toBe(statsSnapshotText(b));
});
test('Stats rejects unsupported versions and oversized assets',async()=>{
 const {readStatsSnapshot}=await contract();
 expect(()=>readStatsSnapshot({...fixture(),schemaVersion:'other'})).toThrow();
 const huge=fixture();huge.aaModels[0].name='x'.repeat(6*1024*1024);
 expect(()=>readStatsSnapshot(huge)).toThrow();
});
