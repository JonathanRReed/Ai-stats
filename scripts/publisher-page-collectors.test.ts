import {test,expect} from 'bun:test';import {normalizeProofBench,normalizeBlueprintBench} from './direct-benchmarks.mjs';
const now='2026-10-03T16:00:00Z';
const proof={metadata:{slug:'proof_bench',version:'1.1',archived:false,total_models:1,models:['lab/model'],updated:'2026-10-01'},tasks:{overall:{'lab/model':{accuracy:99,provider:'Lab',compute_effort:'max',temperature:1,max_output_tokens:128000}}}};
test('ProofBench retains declared version, exact identities and evaluation conditions',()=>{
 const row=normalizeProofBench(proof,now).records[0];expect(row.score).toBe(99);expect(row.unit).toBe('percent');expect(row.benchmarkVersion).toBe('v1.1');expect(row.conditions.reasoningEffort).toBe('max');expect(row.evaluatedAt).toBeNull();
});
test('ProofBench rejects incomplete and unreviewed releases',()=>{
 expect(()=>normalizeProofBench({...proof,metadata:{...proof.metadata,total_models:2}},now)).toThrow();
 expect(()=>normalizeProofBench({...proof,metadata:{...proof.metadata,version:'1.2'}},now)).toThrow();
});
const html='<h1>Blueprint-Bench 2</h1><table><tr><th></th><th>Model</th><th>Score</th></tr><tr><td>1</td><td>Human*</td><td>0.586</td></tr><tr><td>2</td><td><b>Model &amp; Agent</b></td><td>0.544</td></tr><tr><td>3</td><td>Other</td><td>0.000**</td></tr></table>';
test('Blueprint reads only the model scoreboard and preserves baseline-censored scores',()=>{
 const data=normalizeBlueprintBench(html,now);expect(data.records).toHaveLength(2);expect(data.records[0].label).toBe('Model & Agent');expect(data.records[0].score).toBe(.544);expect(data.records[1].conditions.scoreDisclosure).toContain('random baseline');expect(data.records[0].unit).toBe('points');
});
test('Blueprint rejects changed table shapes, duplicate systems and missing boards',()=>{
 expect(()=>normalizeBlueprintBench(html.replace('<th>Score</th>','<th>Accuracy</th>'),now)).toThrow();
 expect(()=>normalizeBlueprintBench(html.replace('Other','Model &amp; Agent'),now)).toThrow();
 expect(()=>normalizeBlueprintBench('<h1>Blueprint-Bench 2</h1>',now)).toThrow();
});
