import {test,expect} from 'bun:test';import {normalizeOSWorld} from './direct-benchmarks.mjs';
const row={model:'Claude Opus 5',reasoning:'max',toolSetting:'batch tool',stepBudget:500,releaseVersion:'v2.1',datasetScope:'full',binaryAccuracy:44.33,partialScore:80,official:true};
const payload={benchmarkVersion:'OSWorld 2.0',defaultMetric:'binaryAccuracy',releaseVersions:['v2026.06.24','v2.1'],results:[row,{...row,releaseVersion:'v2026.06.24',binaryAccuracy:99},{...row,datasetScope:'offline',binaryAccuracy:98}]};
test('OSWorld retains only the current full official release and uses binary accuracy',()=>{
 const result=normalizeOSWorld(payload,'2026-10-03T15:00:00Z');expect(result.records).toHaveLength(1);expect(result.records[0].score).toBe(44.33);expect(result.records[0].benchmarkVersion).toBe('v2.1');expect(result.records[0].conditions.stepBudget).toBe(500);expect(result.records[0].evaluatedAt).toBeNull();
});
test('new OSWorld versions, missing scores and duplicate systems fail closed',()=>{
 expect(()=>normalizeOSWorld({...payload,releaseVersions:['v2.1','v3']},'2026-10-03T15:00:00Z')).toThrow();
 expect(()=>normalizeOSWorld({...payload,results:[{...row,binaryAccuracy:null}]},'2026-10-03T15:00:00Z')).toThrow();
 expect(()=>normalizeOSWorld({...payload,results:[row,row]},'2026-10-03T15:00:00Z')).toThrow();
});