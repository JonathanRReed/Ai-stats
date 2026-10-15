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
test('cost scatter retains free models, excludes missing price, and keeps Log while omitting zero',()=>{
  const result=series.buildCompareSeries?.({models,observations:[]},selection('scale=log'));
  expect(result?.points.map((p:{modelId:string})=>p.modelId)).toEqual(['a']);
  expect(result?.points[0]).toMatchObject({x:0,y:80});
  expect(result?.scale).toBe('log');
  expect(result?.omittedFromLog?.map((p:{modelId:string})=>p.modelId)).toEqual(['a']);
  expect(result?.scaleNotice).toBe('1 selected observation is not plotted on Log (zero USD / 1M tokens (3:1 input/output)): A high (0).');
  expect(series.plottableSeriesPoints(result!)).toEqual([]);
  expect(result?.excluded).toContainEqual({modelId:'b',reason:'Missing price or intelligence'});
});

test('log keeps positive points plotted when a selected zero is omitted',()=>{
  const mixed:ExplorerModel[]=[
    {...models[0],id:'free',name:'Free',priceBlended:0,aaTaskCost:0},
    {...models[0],id:'paid',name:'Paid',priceBlended:2,aaTaskCost:1,intelligence:70},
  ];
  const state=parseCompareState(new URLSearchParams('chart=cost-intelligence&scale=log&m=free&m=paid'),mixed);
  const result=series.buildCompareSeries({models:mixed,observations:[]},state);
  expect(result.scale).toBe('log');
  expect(result.points).toHaveLength(2);
  expect(result.omittedFromLog.map(p=>p.modelId)).toEqual(['free']);
  expect(series.plottableSeriesPoints(result).map(p=>p.modelId)).toEqual(['paid']);
  // Free (x=0, y=80) dominates Paid (x=2, y=70); omitting Free from Log geometry must not promote Paid.
  expect(result.frontierGroups).toEqual({'4.2:long':['free']});
});

test('reference-only zeros omit from log without forcing selected positives linear',()=>{
  const rows:ExplorerModel[]=[
    {...models[0],id:'zero-ref',name:'Zero ref',priceBlended:0,aaTaskCost:0,intelligence:90},
    {...models[0],id:'pos',name:'Pos',priceBlended:3,aaTaskCost:2,intelligence:70},
  ];
  const selected=series.buildCompareSeries({models:rows,observations:[]},parseCompareState(new URLSearchParams('chart=cost-intelligence&scale=log&m=pos'),rows));
  const reference=series.buildCompareSeries({models:rows,observations:[]},parseCompareState(new URLSearchParams('chart=cost-intelligence&scale=log&m=zero-ref&m=pos'),rows));
  expect(selected.scale).toBe('log');
  expect(selected.omittedFromLog).toEqual([]);
  expect(selected.scaleNotice).toBeNull();
  expect(reference.omittedFromLog.map(p=>p.modelId)).toEqual(['zero-ref']);
  expect(reference.scale).toBe('log');
  expect(series.plottableSeriesPoints(reference).map(p=>p.modelId)).toEqual(['pos']);
});

test('all-zero log selection keeps records for CSV and exposes an empty plottable set',()=>{
  const zeros:ExplorerModel[]=[{...models[0],id:'z1',priceBlended:0,aaTaskCost:0},{...models[0],id:'z2',name:'Z2',family:'Z2',priceBlended:0,aaTaskCost:0,intelligence:50}];
  const result=series.buildCompareSeries({models:zeros,observations:[]},parseCompareState(new URLSearchParams('chart=task-cost&scale=log&m=z1&m=z2'),zeros));
  expect(result.points).toHaveLength(2);
  expect(result.omittedFromLog).toHaveLength(2);
  expect(series.plottableSeriesPoints(result)).toEqual([]);
  expect(result.scaleNotice).toContain('2 selected observations are not plotted on Log (zero USD / AA Index task)');
});

test('negative bar scores are omitted on log without clamping into geometry',()=>{
  const rows:ExplorerModel[]=[{...models[0],id:'neg',intelligence:-5},{...models[0],id:'pos',name:'Pos',family:'Pos',intelligence:40}];
  const result=series.buildCompareSeries({models:rows,observations:[]},parseCompareState(new URLSearchParams('chart=benchmark&metric=aa_intelligence_index&scale=log&m=neg&m=pos'),rows));
  expect(result.kind).toBe('bars');
  expect(result.scale).toBe('log');
  expect(result.omittedFromLog.map(p=>p.modelId)).toEqual(['neg']);
  expect(series.plottableSeriesPoints(result).map(p=>p.modelId)).toEqual(['pos']);
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

test('variant links require the same source, provider, family, and recorded cohort',()=>{
 const {compatibleVariantLines}=series;
 const point=(id:string,source:'aa'|'openrouter',family:string,cohortKey:string,reasoning:'low'|'high',provider=family)=>({
  id,modelId:id,label:id,family,reasoning,source,provider,series:'model',x:1,y:2,unit:'AA Index points',cohortKey,
  receipt:{source:'Artificial Analysis',sourceUrl:null,observedAt:null,fetchedAt:null,indexVersion:'4.3',conditions:null,snapshotId:null},
 });
 const lines=compatibleVariantLines([
  point('aa-low','aa','Opus','4.3:long','low','Anthropic'),point('aa-high','aa','Opus','4.3:long','high','Anthropic'),
  point('other-provider-low','aa','Opus','4.3:long','low','ProxyCo'),point('other-provider-high','aa','Opus','4.3:long','high','ProxyCo'),
  point('route-high','openrouter','Opus','4.3:long','high'),point('cohort-high','aa','Opus','4.2:long','high'),
  point('other-family','aa','Gemini','4.3:long','high'),
 ]);
 expect(lines).toHaveLength(2);
 expect(lines.map(group=>group.map(row=>row.id))).toEqual([['aa-low','aa-high'],['other-provider-low','other-provider-high']]);
});

test('five Opus effort records remain directly aligned at equal prices and share one variant path',()=>{
 const efforts=['minimal','low','medium','high','xhigh'] as const;
 const variants:ExplorerModel[]=efforts.map((reasoning,index)=>({id:'opus-'+reasoning,name:'Claude Opus 5.5 ('+reasoning+')',family:'Claude Opus 5.5',provider:'Anthropic',reasoning,
  source:'aa',sourceModelId:'opus-'+reasoning,current:true,intelligence:90-index*3,priceInput:4,priceOutput:20,priceBlended:8,
  aaTaskCost:1.25,indexVersion:'4.3',performancePrompt:'long'}));
 const state=parseCompareState(new URLSearchParams('chart=cost-intelligence&scale=linear&'+variants.map(row=>'m='+row.id).join('&')),variants);
 const result=series.buildCompareSeries({models:variants,observations:[]},state);
 expect(result.points).toHaveLength(5);
 expect(new Set(result.points.map(point=>point.x))).toEqual(new Set([8]));
 expect(series.compatibleVariantLines(result.points).map(line=>line.map(point=>point.reasoning))).toEqual([[...efforts]]);
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

test('CSV keeps zero rows while plottable log points omit them',async()=>{
  const {seriesCsv}=await import('./compare-export');
  const zeros:ExplorerModel[]=[{...models[0],id:'z',priceBlended:0,aaTaskCost:0}];
  const result=series.buildCompareSeries({models:zeros,observations:[]},parseCompareState(new URLSearchParams('chart=task-cost&scale=log&m=z'),zeros));
  const csv=seriesCsv(result.points,{includeX:true,xLabel:result.xLabel,yLabel:result.yLabel,metricId:'task-cost'});
  expect(csv).toContain('"0"');
  expect(result.points[0].x).toBe(0);
  expect(series.plottableSeriesPoints(result)).toEqual([]);
});

test('zero-cost high score dominates a positive-cost lower score on every scale',()=>{
  const rows:ExplorerModel[]=[
    {...models[0],id:'k2',name:'K2 Horizon 375B A23B',family:'K2 Horizon',aaTaskCost:0,intelligence:72},
    {...models[0],id:'dominated',name:'Dominated',family:'D',aaTaskCost:3,intelligence:60},
    {...models[0],id:'strong',name:'Strong',family:'S',aaTaskCost:9,intelligence:90},
  ];
  const build=(scale:'linear'|'log')=>series.buildCompareSeries({models:rows,observations:[]},parseCompareState(new URLSearchParams(`chart=task-cost&scale=${scale}&m=k2&m=dominated&m=strong`),rows));
  const linear=build('linear'),log=build('log');
  expect(linear.frontierGroups).toEqual({'4.2:long':['k2','strong']});
  // Toggling scale never changes Pareto membership; Log only omits K2's geometry.
  expect(log.frontierGroups).toEqual(linear.frontierGroups);
  expect(Object.values(log.frontierGroups).flat()).not.toContain('dominated');
  expect(series.plottableSeriesPoints(log).map(point=>point.modelId)).toEqual(['dominated','strong']);
});

test('frontier segments never bridge across an omitted member',()=>{
  const at=new Map([['a',{x:1}],['c',{x:3}],['d',{x:4}]]);
  expect(series.frontierSegments(['a','b','c','d'],at)).toEqual([[{x:1}],[{x:3},{x:4}]]);
  expect(series.frontierSegments(['zero','c','d'],at)).toEqual([[{x:3},{x:4}]]);
  expect(series.frontierSegments(['zero'],at)).toEqual([]);
});

test('Log omission notices name each record, its value and sign without duplicate labels',()=>{
  const rows:ExplorerModel[]=[
    {...models[0],id:'k2',name:'K2 Horizon 375B A23B',family:'K2',reasoning:'high',aaTaskCost:0,intelligence:72},
    {...models[0],id:'k2-low',name:'K2 Horizon 375B A23B',family:'K2',reasoning:'low',aaTaskCost:0,intelligence:70},
    {...models[0],id:'paid',name:'Paid',family:'P',aaTaskCost:2,intelligence:60},
  ];
  const result=series.buildCompareSeries({models:rows,observations:[]},parseCompareState(new URLSearchParams('chart=task-cost&scale=log&m=k2&m=k2-low&m=paid'),rows));
  const items=series.logOmissions(result.omittedFromLog,result.kind);
  expect(items.map(item=>item.label)).toEqual(['K2 Horizon 375B A23B · high','K2 Horizon 375B A23B · low']);
  expect(items.every(item=>item.sign==='zero'&&item.valueLabel==='0')).toBe(true);
  expect(result.scaleNotice).toContain('K2 Horizon 375B A23B · high (0)');
  const negatives=series.logOmissions([{...result.points[0],id:'neg',x:-2}],'scatter');
  expect(negatives[0]).toMatchObject({sign:'negative',valueLabel:'−2'});
  expect(series.logOmissionHeading(negatives,'Score','reference')).toBe('1 current frontier reference record is not plotted on Log (negative Score)');
  expect(series.logOmissionHeading([...items,...negatives],'Score')).toContain('zero or negative Score');
  // The same record never appears twice even if passed twice.
  expect(series.logOmissions([result.points[0],result.points[0]],'scatter')).toHaveLength(1);
});

test('selected and reference Log omissions are labelled accurately without duplicates',()=>{
  const rows:ExplorerModel[]=[
    {...models[0],id:'k2',name:'K2 Horizon 375B A23B',family:'K2',aaTaskCost:0,intelligence:72},
    {...models[0],id:'zero-ref',name:'Zero Ref',family:'Z',aaTaskCost:0,intelligence:50},
    {...models[0],id:'paid',name:'Paid',family:'P',aaTaskCost:2,intelligence:60},
  ];
  const build=(ids:string[])=>series.buildCompareSeries({models:rows,observations:[]},{...parseCompareState(new URLSearchParams('chart=task-cost&scale=log'),rows),modelIds:ids,frontier:true});
  const selected=build(['k2','paid']),reference=build(['k2','zero-ref','paid']);
  const notice=series.combinedLogOmissions(selected,reference)!;
  expect(notice.selected.map(item=>item.label)).toEqual(['K2 Horizon 375B A23B']);
  // K2 is already listed as selected; only the reference-only record is added.
  expect(notice.reference.map(item=>[item.label,item.sign,item.valueLabel])).toEqual([['Zero Ref','zero','0']]);
  expect(series.logOmissionHeading(notice.reference,notice.axis,'reference')).toBe('1 current frontier reference record is not plotted on Log (zero USD / AA Index task)');
  // A negative reference value is called negative, never "zero".
  const negative={...reference,omittedFromLog:[{...reference.points[0],id:'neg-ref',modelId:'neg-ref',label:'Negative Ref',x:-1}]};
  const negativeNotice=series.combinedLogOmissions(selected,negative)!;
  expect(negativeNotice.reference.map(item=>[item.label,item.sign,item.valueLabel])).toEqual([['Negative Ref','negative','−1']]);
  expect(series.logOmissionHeading(negativeNotice.reference,negativeNotice.axis,'reference')).toContain('(negative USD / AA Index task)');
  expect(series.combinedLogOmissions({...selected,scale:'linear'},reference)).toBeNull();
});

test('bar order follows the ranked or explicitly chosen model order, not catalog storage order',()=>{
 const models=[{id:'a',name:'A',family:'A',source:'aa' as const,sourceModelId:'a',current:true,intelligence:40},{id:'b',name:'B',family:'B',source:'aa' as const,sourceModelId:'b',current:true,intelligence:80}];
 const state=parseCompareState(new URLSearchParams('chart=benchmark&m=b&m=a'),models);
 expect(series.buildCompareSeries({models,observations:[]},state).points.map(p=>p.modelId)).toEqual(['b','a']);
});
