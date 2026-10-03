import {test,expect} from 'bun:test';import {selectBenchmarkModels,benchmarkStartingSelection} from './compare-state';
test('benchmark choices admit original publisher records and preserve source identity',()=>{
 const catalog=[{id:'aa:same',source:'aa',sourceModelId:'same'},{id:'epoch:same',source:'epoch',sourceModelId:'same'},{id:'publisher:same',source:'publisher',sourceModelId:'same'}];
 expect(selectBenchmarkModels(catalog,[{modelVersion:'same',sourceKey:'livebench',value:40}])).toEqual(['publisher:same']);
 expect(selectBenchmarkModels(catalog,[{modelVersion:'same',sourceKey:'epoch-ai',value:0}])).toEqual(['epoch:same']);
 expect(selectBenchmarkModels(catalog,[{modelVersion:'same',value:null}])).toEqual([]);
});
test('a new benchmark selection chooses the latest explicitly recorded version and measured identities',()=>{
 const catalog=[{id:'epoch:old',source:'epoch',sourceModelId:'old'},{id:'epoch:new',source:'epoch',sourceModelId:'new'}];
 const base={id:'r',benchmarkSlug:'metr',metricKey:'average_score',unit:'fraction' as const,value:.5,conditions:null,evaluationDate:null,sourceUrl:null,fetchedAt:null,snapshotId:null,sourceKey:'epoch-ai'};
 const observations=[{...base,modelVersion:'old',benchmarkVersion:'v1.0'},{...base,modelVersion:'new',benchmarkVersion:'v1.1'}];
 const chosen=benchmarkStartingSelection(catalog,observations);expect(chosen.modelIds).toEqual(['epoch:new']);expect(JSON.parse(chosen.scoreMetricKey!)[2]).toBe('v1.1');
 expect(benchmarkStartingSelection(catalog,observations,JSON.stringify(['average_score','percent','v1.0'])).modelIds).toEqual(['epoch:old']);
 expect(benchmarkStartingSelection(catalog,observations,'unavailable').modelIds).toEqual([]);
});
