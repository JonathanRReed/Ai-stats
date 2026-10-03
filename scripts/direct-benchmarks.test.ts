import {test,expect} from 'bun:test';
import {normalizeLiveBench,normalizeWeirdML,normalizePostTrainBench} from './direct-benchmarks.mjs';
test('LiveBench matches equal category means, not a mean of all questions',()=>{
 const result=normalizeLiveBench({version:'2026-06-25',categories:{A:['x','y'],B:['z']},csv:'model,x,y,z\nm,100,0,100\n',commit:'a'.repeat(40),fetchedAt:'2026-10-03T00:00:00Z'});
 expect(result.records[0].score).toBe(75);expect(result.records[0].benchmarkVersion).toBe('2026-06-25');
 expect(result.records[0].modelId).toBe('m');
});
test('LiveBench does not turn blank categories into zero scores',()=>{
 expect(()=>normalizeLiveBench({version:'2026-06-25',categories:{A:['x'],B:['y']},csv:'model,x,y\nm,100,\n',commit:'a'.repeat(40),fetchedAt:'2026-10-03T00:00:00Z'})).toThrow();
});
test('WeirdML keeps system identity and does not count task variants as models',()=>{
 const r=normalizeWeirdML({schema_version:1,mode:'real',generated:'2026-10-02T10:13:42Z',source_commit:'abc1234',configuration_count:15,models:[{id:'a-codex',name:'A',slug:'lab/a',score:.35,agent:'codex',harnesses:[{name:'codex',version:'1'}],synthetic:false},{id:'a-other',name:'A',slug:'lab/a',score:.25,agent:'other',harnesses:[{name:'other',version:'2'}],synthetic:false}]},'2026-10-03T00:00:00Z');
 expect(r.records).toHaveLength(2);expect(r.records[0].systemId).not.toBe(r.records[1].systemId);
 expect(r.records[0].score).toBe(.35);expect(r.records[0].conditions.harnesses).toContain('codex');
});
test('PostTrain v1.2 stays in its own version and uses published weighted aggregates',()=>{
 const r=normalizePostTrainBench({resultsVersion:'v1.2',benchmarkKeys:['a','b'],benchmarkWeights:{a:.4,b:.6},aggregatedScores:{model:{avg:37.27,std:1.65,n:2}}},'a'.repeat(40),'2026-10-03T00:00:00Z');
 expect(r.records[0]).toMatchObject({benchmarkVersion:'v1.2',score:37.27,unit:'percent'});
 expect(()=>normalizePostTrainBench({resultsVersion:'v9',aggregatedScores:{}},'a'.repeat(40),'2026-10-03T00:00:00Z')).toThrow();
});
