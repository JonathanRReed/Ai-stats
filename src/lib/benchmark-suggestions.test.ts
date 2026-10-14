import {expect,test} from 'bun:test';
import {benchmarkConditionKey,mostCoveredBenchmarkCondition,rankedBenchmarkModels} from './benchmark-suggestions';
import {benchmarkStartingSelection} from './compare-state';
import type {EpochObservation} from './epoch-observations';

const catalog=[
 {id:'epoch:z',source:'epoch',sourceModelId:'z'},
 {id:'epoch:a',source:'epoch',sourceModelId:'a'},
 {id:'epoch:b',source:'epoch',sourceModelId:'b'},
 {id:'publisher:a',source:'publisher',sourceModelId:'a'},
];
const row=(modelVersion:string,value:number,extra:Partial<EpochObservation>={}):EpochObservation=>({
 id:modelVersion,sourceKey:'epoch-ai',modelVersion,benchmarkSlug:'metr',benchmarkVersion:'v1',metricKey:'score',unit:'percent',value,conditions:{shots:1},evaluationDate:'2026-01-01',
 sourceUrl:null,fetchedAt:null,snapshotId:null,...extra,
});

test('benchmark selections rank measured scores, independent of catalog order',()=>{
 expect(rankedBenchmarkModels(catalog,[row('z',40),row('a',92),row('b',81)])).toEqual(['epoch:a','epoch:b','epoch:z']);
});

test('lower-is-better ranking retains zero as a measured value',()=>{
 expect(rankedBenchmarkModels(catalog,[row('z',0),row('a',3),row('b',1)],8,false)).toEqual(['epoch:z','epoch:b','epoch:a']);
});

test('fraction and percentage units normalize to the same score scale',()=>{
 expect(rankedBenchmarkModels(catalog,[row('z',.92,{unit:'fraction'}),row('a',80,{unit:'percent'})])).toEqual(['epoch:z','epoch:a']);
});

test('source-specific IDs keep publisher and Epoch model names distinct',()=>{
 expect(rankedBenchmarkModels(catalog,[row('a',70),row('a',95,{sourceKey:'livebench'})])).toEqual(['publisher:a','epoch:a']);
});

test('the latest repeated run wins instead of selecting the highest old score',()=>{
 expect(rankedBenchmarkModels(catalog,[row('a',99,{evaluationDate:'2026-01-01'}),row('a',60,{evaluationDate:'2026-02-01'}),row('b',80)])).toEqual(['epoch:b','epoch:a']);
});

test('condition coverage counts unique eligible model identities, not duplicate runs',()=>{
 const settingsA={shots:1},settingsB={shots:2};
 const observations=[row('a',50,{id:'a1',conditions:settingsA}),row('a',60,{id:'a2',conditions:settingsA}),row('b',70,{conditions:settingsB}),row('z',80,{conditions:settingsB})];
 expect(mostCoveredBenchmarkCondition(catalog,observations)).toBe(benchmarkConditionKey({conditions:settingsB}));
});

test('benchmark cohort ranking filters incompatible settings and reports its condition',()=>{
 const observations=[row('z',1,{conditions:{shots:1}}),row('a',99,{conditions:{shots:1}}),row('b',100,{conditions:{shots:2}})];
 expect(benchmarkStartingSelection(catalog,observations)).toMatchObject({modelIds:['epoch:a','epoch:z'],conditionKey:'[["shots",1]]'});
});

test('an empty benchmark cohort produces no selections or invented condition',()=>{
 expect(benchmarkStartingSelection(catalog,[])).toMatchObject({modelIds:[],scoreMetricKey:null,conditionKey:null});
 expect(mostCoveredBenchmarkCondition(catalog,[])).toBeNull();
});
