import {expect,test} from 'bun:test';
import {parseCompareState} from './compare-state';
import type {EpochObservation} from './epoch-observations';
import * as series from './compare-series';
import type {ExplorerModel} from './compare-series';
const models:ExplorerModel[]=[
  {id:'a',name:'A high',family:'A',reasoning:'high',source:'aa',sourceModelId:'a',current:true,
    intelligence:80,priceInput:0,priceOutput:0,priceBlended:0,outputSpeed:40,indexVersion:'4.2',performancePrompt:'long',observedAt:'2026-10-02T00:00:00Z'},
  {id:'b',name:'B',family:'B',reasoning:'unknown',source:'aa',sourceModelId:'b',current:true,
    intelligence:70,priceInput:null,priceOutput:null,priceBlended:null,outputSpeed:60,indexVersion:'4.2',performancePrompt:'long',observedAt:'2026-10-02T00:00:00Z'},
  {id:'old',name:'Old',family:'Old',reasoning:'unknown',source:'aa',sourceModelId:'old',current:false,
    intelligence:99,priceInput:1,priceOutput:1,priceBlended:1,outputSpeed:100,indexVersion:'3',performancePrompt:'medium',observedAt:'2025-01-01T00:00:00Z'},
];
const selection=(query='')=>parseCompareState(new URLSearchParams('m=a&m=b&'+query),models);
test('cost scatter retains free models, excludes missing price, and falls back from log for zero',()=>{
  const result=series.buildCompareSeries?.({models,observations:[]},selection('scale=log'));
  expect(result?.points.map((p:{modelId:string})=>p.modelId)).toEqual(['a']);
  expect(result?.points[0]).toMatchObject({x:0,y:80});
  expect(result?.scale).toBe('linear');
  expect(result?.scaleNotice).toContain('zero');
  expect(result?.excluded).toContainEqual({modelId:'b',reason:'Missing price or intelligence'});
});
test('speed comparison admits unpriced models and never infers task token counts',()=>{
  expect(series.buildCompareSeries?.({models,observations:[]},selection('chart=speed-intelligence'))?.points).toHaveLength(2);
  const tokens=series.buildCompareSeries?.({models,observations:[]},selection('chart=tokens-task'));
  expect(tokens?.available).toBe(true);expect(tokens?.points.map(point=>point.modelId)).toEqual(['a']);
});
test('frontiers never mix index versions or unknown provenance',()=>{
  const points=[
    {id:'a',modelId:'a',x:1,y:80,cohortKey:'v4'}, {id:'b',modelId:'b',x:2,y:70,cohortKey:'v4'},
    {id:'c',modelId:'c',x:0,y:100,cohortKey:'v3'}, {id:'d',modelId:'d',x:0,y:100,cohortKey:null},
  ];
  expect(series.paretoFrontiers?.(points,'min')).toEqual({'v3':['c'],'v4':['a']});
});
test('historical selection needs an explicit history toggle',()=>{
  const state=parseCompareState(new URLSearchParams('m=old'),models);
  expect(series.buildCompareSeries?.({models,observations:[]},state)?.points).toEqual([]);
  expect(series.buildCompareSeries?.({models,observations:[]},{...state,includeHistory:true})?.points).toHaveLength(1);
});
test('Epoch benchmarks retain distinct conditions and runs rather than taking maximum',()=>{
  const model:ExplorerModel={id:'epoch:variant',name:'Variant',family:'Variant',reasoning:'unknown',source:'epoch',sourceModelId:'variant',current:true};
  const row:EpochObservation={id:'diff',modelVersion:'variant',benchmarkSlug:'aider',metricKey:'Percent correct',
    value:8,unit:'percent',conditions:{format:'diff'},evaluationDate:'2025-01-01',sourceUrl:'https://epoch.ai/benchmarks',
    fetchedAt:'2026-10-02T00:00:00Z',snapshotId:'1'};
  const observations=[row,{...row,id:'whole',value:16.4,conditions:{format:'whole'}}];
  const state=parseCompareState(new URLSearchParams('chart=benchmark&m=epoch%3Avariant&metric=epoch_aider'),[model]);
  const all=series.buildCompareSeries?.({models:[model],observations},state);
  expect(all?.points.map((p:{y:number})=>p.y)).toEqual([8,16.4]);
  expect(all?.mixedConditions).toBe(true);
  expect(series.buildCompareSeries?.({models:[model],observations},{...state,conditionKey:'[["format","diff"]]'})?.points).toHaveLength(1);
});
test('incompatible native units cannot be presented on one benchmark scale',()=>{
  const model:ExplorerModel={id:'epoch:v',name:'V',family:'V',source:'epoch',sourceModelId:'v',current:true};
  const rows:EpochObservation[]=[{id:'one',modelVersion:'v',benchmarkSlug:'b',metricKey:'Score',unit:'native',value:4,conditions:null,evaluationDate:null,sourceUrl:null,fetchedAt:null,snapshotId:null},
    {id:'two',modelVersion:'v',benchmarkSlug:'b',metricKey:'Percent correct',unit:'percent',value:80,conditions:null,evaluationDate:null,sourceUrl:null,fetchedAt:null,snapshotId:null}];
  const state=parseCompareState(new URLSearchParams('chart=benchmark&m=epoch%3Av&metric=epoch_b'),[model]);
  expect(series.buildCompareSeries?.({models:[model],observations:rows},state)?.points).toEqual([]);
});

test('unknown timing conditions do not establish a compatible speed frontier',()=>{
  const unknown=models.map(model=>({...model,performancePrompt:null}));
  expect(series.buildCompareSeries({models:unknown,observations:[]},selection('chart=speed-intelligence')).frontierGroups).toEqual({});
});

test('selections from another source explain why they are not plotted',()=>{
  const epochModel:ExplorerModel={id:'epoch:v',name:'V',family:'V',source:'epoch',sourceModelId:'v',current:true};
  const state=selection('chart=benchmark&metric=epoch_b');
  const result=series.buildCompareSeries({models:[...models,epochModel],observations:[]},state);
  expect(result.excluded).toEqual([{modelId:'a',reason:'Choose a measured source record for this benchmark'},{modelId:'b',reason:'Choose a measured source record for this benchmark'}]);
});

test('AA reasoning filters do not suppress Epoch measurements',()=>{
  const model:ExplorerModel={id:'epoch:v',name:'V',family:'V',reasoning:'unknown',source:'epoch',sourceModelId:'v',current:true};
  const row:EpochObservation={id:'run',modelVersion:'v',benchmarkSlug:'aider',metricKey:'Percent correct',value:8,unit:'percent',
    conditions:{format:'diff'},evaluationDate:null,sourceUrl:null,fetchedAt:null,snapshotId:null};
  const state=parseCompareState(new URLSearchParams('chart=benchmark&metric=epoch_aider&m=epoch:v&reason=high'),[model]);
  expect(series.buildCompareSeries({models:[model],observations:[row]},state).points).toHaveLength(1);
});

test('mixed Epoch metrics become accessible through an explicit score selection',()=>{
 const model:ExplorerModel={id:'epoch:v',name:'V',family:'V',source:'epoch',sourceModelId:'v',current:true};
 const row:EpochObservation={id:'accuracy',modelVersion:'v',benchmarkSlug:'mixed',metricKey:'Accuracy',value:8,unit:'percent',conditions:null,evaluationDate:null,sourceUrl:null,fetchedAt:null,snapshotId:null};
 const key=JSON.stringify(['Accuracy','percent']);
 const params=new URLSearchParams('chart=benchmark&metric=epoch_mixed&m=epoch:v');params.set('score_metric',key);
 const state=parseCompareState(params,[model]);
 const result=series.buildCompareSeries({models:[model],observations:[row,{...row,id:'rating',metricKey:'Rating',unit:'native',value:1400}]},state);
 expect(result.points).toHaveLength(1);expect(result.points[0].y).toBe(8);
});

test('original publisher observations reach the chart without an Epoch source filter',()=>{
 const model:ExplorerModel={id:'publisher:system',source:'publisher',sourceModelId:'system',name:'System',family:'System',current:true};
 const row:EpochObservation={id:'run',modelVersion:'system',benchmarkSlug:'publisher_terminal_bench_4_0_0',metricKey:'accuracy',unit:'percent',value:58.2,conditions:{agent:'Codex'},evaluationDate:null,sourceUrl:'https://hub.harborframework.com/',fetchedAt:'2026-10-03T04:45:31Z',snapshotId:null,sourceKey:'terminal-bench',sourceName:'Terminal-Bench',benchmarkVersion:'4.0.0'};
 const state=parseCompareState(new URLSearchParams('chart=benchmark&m=publisher%3Asystem&metric=epoch_publisher_terminal_bench_4_0_0'),[model]);
 const result=series.buildCompareSeries({models:[model],observations:[row]},state);
 expect(result.points).toHaveLength(1);expect(result.points[0].y).toBe(58.2);expect(result.points[0].receipt.source).toBe('Terminal-Bench');
});

test('BTF-3 chart labels its lower-is-better scale while retaining raw scores',()=>{
 const model:ExplorerModel={id:'epoch:m',source:'epoch',sourceModelId:'m',name:'M',family:'M',current:true};
 const row:EpochObservation={id:'r',modelVersion:'m',benchmarkSlug:'btf3_external',metricKey:'Pooled score',unit:'native',value:.12,conditions:null,evaluationDate:null,sourceUrl:null,fetchedAt:null,snapshotId:null};
 const state=parseCompareState(new URLSearchParams('chart=benchmark&metric=epoch_btf3_external&m=epoch%3Am'),[model]);const result=series.buildCompareSeries({models:[model],observations:[row]},state);expect(result.yLabel).toContain('lower is better');expect(result.points[0].y).toBe(.12);
});
