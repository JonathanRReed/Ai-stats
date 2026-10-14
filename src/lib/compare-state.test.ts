import {expect,test} from 'bun:test';
import * as state from './compare-state';
const catalog=[
  {id:'a-high',name:'Model A (High)',family:'Model A',reasoning:'high',current:true},
  {id:'a-low',name:'Model A (Low)',family:'Model A',reasoning:'low',current:true},
  {id:'b',name:'Model B',family:'Model B',reasoning:'unknown',current:true},
  {id:'retired',name:'Old model',family:'Old',reasoning:'unknown',current:false},
];
test('safe state round-trips selections, controls and missing shared identities',()=>{
  const parsed=state.parseCompareState?.(new URLSearchParams('chart=benchmark&m=a-high&m=missing&metric=epoch_gpqa&condition=%7B%22Shots%22%3A%220%22%7D&scale=log&labels=1&frontier=0&reason=high'),catalog,['b']);
  expect(parsed).toMatchObject({chart:'benchmark',modelIds:['a-high'],missingModelIds:['missing'],
    metricId:'epoch_gpqa',conditionKey:'[["Shots","0"]]',scale:'log',labels:true,frontier:false,reasoningEfforts:['high']});
  expect(state.parseCompareState?.(state.serializeCompareState?.(parsed),catalog,['b'])).toEqual(parsed);
});
test('saved legacy model links stay explicit after a chart change and popstate restores their selection',()=>{
 const saved=new URLSearchParams('models=a-high%2Cb&chart=cost-intelligence');
 expect(state.hasExplicitCompareSelection(saved)).toBe(true);
 expect(state.usesSuggestedCompareSelection(saved)).toBe(false);
 const selected=state.parseCompareState(saved,catalog,['retired']);
 const changed={...selected,chart:'speed-intelligence' as const};
 const changedUrl=state.serializeCompareState(changed);
 expect(state.parseCompareState(changedUrl,catalog,['retired']).modelIds).toEqual(['a-high','b']);
 // popstate restores the earlier legacy URL through the same explicit-selection check.
 expect(state.usesSuggestedCompareSelection(new URLSearchParams(saved))).toBe(false);
 expect(state.parseCompareState(saved,catalog,['retired']).modelIds).toEqual(['a-high','b']);
});
test('all supported selection URL forms stay explicit instead of switching to suggested defaults',()=>{
 for(const saved of [
  'm=a-high',
  'models=a-high%2Cb',
  'model=Model%20A%20%28High%29',
  'source=aa&record=aa-high',
 ]){
  const params=new URLSearchParams(saved);
  expect(state.hasExplicitCompareSelection(params)).toBe(true);
  expect(state.usesSuggestedCompareSelection(params)).toBe(false);
 }
 expect(state.hasExplicitCompareSelection(new URLSearchParams('source=aa'))).toBe(false);
});
test('invalid URL controls are bounded and default safely',()=>{
  const parsed=state.parseCompareState?.(new URLSearchParams('chart=script&scale=bad&metric=javascript:bad&reason=nope'),catalog,['b']);
  expect(parsed).toMatchObject({chart:'cost-intelligence',scale:'linear',modelIds:['b'],
    metricId:'aa_intelligence_index',reasoningEfforts:[]});
});
test('an explicitly empty selection survives URL serialization and back navigation',()=>{
  const parsed=state.parseCompareState?.(new URLSearchParams('m='),catalog,['b']);
  expect(parsed?.modelIds).toEqual([]);
  expect(state.parseCompareState?.(state.serializeCompareState?.(parsed),catalog,['b'])?.modelIds).toEqual([]);
});
test('family selection preserves exact reasoning variants and excludes retired models by default',()=>{
  expect(state.selectFamily?.(['b'],catalog,'Model A',true)).toEqual(['b','a-high','a-low']);
  expect(state.selectFamily?.(['a-high','a-low','b'],catalog,'Model A',false)).toEqual(['b']);
  expect(state.selectFamily?.([],catalog,'Old',true)).toEqual([]);
});
test('legacy model-name links resolve only when the match is unambiguous',()=>{
  expect(state.parseCompareState?.(new URLSearchParams('model=Model%20A%20%28High%29&metric=epoch_gpqa'),catalog,['b']))
    .toMatchObject({modelIds:['a-high'],chart:'benchmark',metricId:'epoch_gpqa'});
  const ambiguous=[...catalog,{...catalog[0],id:'other'}];
  expect(state.parseCompareState?.(new URLSearchParams('model=Model%20A%20%28High%29'),ambiguous,['b'])?.missingModelIds)
    .toEqual(['Model A (High)']);
});

test('Epoch condition keys survive a shared URL',()=>{
  const params=new URLSearchParams();params.set('condition','[["Shots","0"],["format","diff"]]');
  expect(state.parseCompareState(params,catalog).conditionKey).toBe('[["format","diff"],["Shots","0"]]');
});

test('family removal also removes hidden historical selections',()=>{
  expect(state.selectFamily(['retired'],catalog,'Old',false,false)).toEqual([]);
});
test('benchmark cache ignores inherited properties and accepts only own arrays',()=>{
  for(const slug of ['constructor','__proto__','toString'])expect(state.readBenchmarkCache?.({},slug)).toBeUndefined();
  expect(state.readBenchmarkCache?.({a:[1]},'a')).toEqual([1]);
});

test('legacy explicit AA metric links open their requested benchmark',()=>{
 for(const metric of ['aa_coding_index','mmlu_pro','gpqa']){
  expect(state.parseCompareState(new URLSearchParams('metric='+metric),catalog)).toMatchObject({chart:'benchmark',metricId:metric});
 }
});

test('explicit Epoch score metric round trips with shared URLs',()=>{
 const params=new URLSearchParams('chart=benchmark&metric=epoch_mixed');params.set('score_metric','["Accuracy","percent"]');
 const parsed=state.parseCompareState(params,catalog);
 expect(parsed.scoreMetricKey).toBe('["Accuracy","percent"]');
 expect(state.parseCompareState(state.serializeCompareState(parsed),catalog).scoreMetricKey).toBe(parsed.scoreMetricKey);
});

test('invalid chart defaults use the normalized chart scale',()=>{
 expect(state.parseCompareState(new URLSearchParams('chart=not-a-chart'),catalog)).toMatchObject({chart:'cost-intelligence',scale:'log'});
});

test('default charts use delivered task-cost capability while explicit views and benchmark links persist',()=>{
 expect(state.parseCompareState(new URLSearchParams(),catalog,[], 'task-cost').chart).toBe('task-cost');
 expect(state.parseCompareState(new URLSearchParams('chart=cost-intelligence'),catalog,[], 'task-cost').chart).toBe('cost-intelligence');
 expect(state.parseCompareState(new URLSearchParams('metric=gpqa'),catalog,[], 'task-cost')).toMatchObject({chart:'benchmark',metricId:'gpqa'});
});

test('family pagination keeps every member of a group together at the page boundary',()=>{
 const rows=[...Array.from({length:79},(_,i)=>({source:'aa',family:'Family '+i})),
  {source:'aa',family:'Opus'},{source:'aa',family:'Opus'},{source:'aa',family:'Opus'},
  {source:'openrouter',family:'Opus'}];
 const page=state.paginateFamilyGroups(rows,80);
 expect(page.visibleCount).toBe(82);
 expect(page.groups.at(-1)?.map(row=>row.source+':'+row.family)).toEqual(['aa:Opus','aa:Opus','aa:Opus']);
});

test('minimal reasoning filters and shared URLs retain the effort label',()=>{
 const rows=[...catalog,{id:'minimal',name:'Gemini 3.5 Flash (Minimal)',family:'Gemini 3.5 Flash',reasoning:'minimal',current:true}];
 const parsed=state.parseCompareState(new URLSearchParams('m=minimal&reason=minimal'),rows);
 expect(parsed).toMatchObject({modelIds:['minimal'],reasoningEfforts:['minimal']});
 expect(state.parseCompareState(state.serializeCompareState(parsed),rows)).toEqual(parsed);
});

test('a stale score metric remains visible and recoverable with one or zero recorded metrics',()=>{
 expect(state.scoreMetricOptions(['valid'],'retired')).toEqual({visible:true,missing:true});
 expect(state.scoreMetricOptions([],'retired')).toEqual({visible:true,missing:true});
 expect(state.scoreMetricOptions(['valid'],null)).toEqual({visible:false,missing:false});
 expect(state.changeScoreMetric('valid')).toEqual({scoreMetricKey:'valid',conditionKey:null});
 expect(state.changeScoreMetric('')).toEqual({scoreMetricKey:null,conditionKey:null});
});
