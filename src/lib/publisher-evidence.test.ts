import {test,expect} from 'bun:test';
import {adaptPublisherEvidence,validatePublisherSnapshot,type PublisherSnapshot} from './publisher-evidence';
const snapshot:PublisherSnapshot={schemaVersion:1,sourceKey:'terminal-bench',fetchedAt:'2026-10-03T04:45:31Z',observedAt:null,benchmarkVersion:'4.0.0',sourceUrl:'https://www.tbench.ai/',records:[
 {systemId:'codex:model:max',modelId:'model',label:'Model',benchmarkSlug:'terminal-bench',benchmarkVersion:'4.0.0',metric:'Accuracy',unit:'percent',score:58.2,higherIsBetter:true,conditions:{agent:'Codex',reasoningEffort:'max',agentVersion:null},evaluatedAt:null,sourceUrl:'https://www.tbench.ai/'},
 {systemId:'other:model:max',modelId:'model',label:'Model',benchmarkSlug:'terminal-bench',benchmarkVersion:'4.0.0',metric:'Accuracy',unit:'percent',score:45,higherIsBetter:true,conditions:{agent:'Other',reasoningEffort:'max'},evaluatedAt:null,sourceUrl:'https://www.tbench.ai/'}]};
test('publisher systems remain source-scoped and carry their own retrieval receipt',()=>{
 const out=adaptPublisherEvidence([snapshot]);
 expect(out.models).toHaveLength(2);expect(out.models[0].id).not.toBe(out.models[1].id);
 expect(out.models[0].source).toBe('publisher');expect(out.runs[0].source_name).toBe('Terminal-Bench');
 expect(out.runs[0].source_fetched_at).toBe(snapshot.fetchedAt);expect(out.runs[0].evaluation_date).toBeNull();
 expect(out.runs[0].conditions).not.toHaveProperty('agentVersion');
 expect(out.benchmarks[0].name).toBe('Terminal-Bench 4.0.0');
});
test('malformed, mixed-version, duplicate and unsafe publisher data is rejected',()=>{
 expect(()=>validatePublisherSnapshot({...snapshot,records:[]},snapshot.sourceKey)).toThrow();
 expect(()=>validatePublisherSnapshot({...snapshot,records:[snapshot.records[0],snapshot.records[0]]},snapshot.sourceKey)).toThrow();
 expect(()=>validatePublisherSnapshot({...snapshot,records:[{...snapshot.records[0],benchmarkVersion:'2.0'}]},snapshot.sourceKey)).toThrow();
 expect(()=>validatePublisherSnapshot({...snapshot,sourceUrl:'javascript:alert(1)'},snapshot.sourceKey)).toThrow();
});
