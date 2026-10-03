import {test,expect} from 'bun:test';
import {normalizeEpochRecord,getEpochScoreMetric,buildPublicEpochRun} from './epoch-records.mjs';
const schema={source_file:'cybench_external.csv',benchmark:'CyBench',score_column:'% Solved',scale:'1.0',score_ceiling:'1.0',superseded_by:''};
test('exact source metadata selects the metric and its stored fractional unit',()=>{
 const r=normalizeEpochRecord({'Model version':'m','% Solved':'.93',Score:'99'},'cybench_external',{metadata:schema});
 expect(r).toMatchObject({metricKey:'% Solved',value:.93,unit:'fraction'});
});
test('missing primary column cannot silently fall back to a different benchmark score',()=>{
 expect(getEpochScoreMetric({'Model version':'m',Score:'99'},schema)).toBeNull();
});
test('metadata scale is not blindly applied to native ratings',()=>{
 const r=normalizeEpochRecord({'Model version':'m','Mean score':'8.2'},'lech_mazur_writing_external',{metadata:{...schema,score_column:'Mean score',scale:'.1'}});
 expect(r).toMatchObject({value:8.2,unit:'native'});
});
test('percentage storage stays distinct from fractional storage',()=>{
 const r=normalizeEpochRecord({'Model version':'m','Percent correct':'88'},'aider_polyglot_external',{metadata:{...schema,score_column:'Percent correct',scale:'.01'}});
 expect(r).toMatchObject({value:88,unit:'percent'});
});
test('explicit benchmark versions and agents survive normalization and publication',()=>{
 const raw={'Model version':'m',Score:'.5',Version:'v1.1',Agent:'Codex','Agent version':'2.0',Source:'https://www.tbench.ai/leaderboard/terminal-bench/2.0'};
 const r=normalizeEpochRecord(raw,'terminalbench_external');
 expect(r?.conditions).toMatchObject({Version:'v1.1',Agent:'Codex','Agent version':'2.0'});
 expect(r?.sourceUrl).toBe(raw.Source);
 const p=buildPublicEpochRun({epoch_run_id:'r',model_version:'m',score:.5,score_metric:'Score',raw},'terminalbench_external',{metadata:{...schema,score_column:'Score'}});
 expect(p.score_unit).toBe('fraction');
 expect(p.conditions).toMatchObject({Version:'v1.1'});
});

test('sub-unit ECI ceilings preserve the source fraction and percent storage units',()=>{
 expect(normalizeEpochRecord({'Model version':'m','mean_score':'.4'},'frontiermath',{metadata:{score_column:'mean_score',scale:'1',score_ceiling:'.57'}})?.unit).toBe('fraction');
 expect(normalizeEpochRecord({'Model version':'m',Score:'63.3'},'lmca_external',{metadata:{score_column:'Score',scale:'.01',score_ceiling:'.85'}})?.unit).toBe('percent');
});
