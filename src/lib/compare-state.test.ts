import {expect,test} from 'bun:test';
const state=await import('./compare-state').catch(()=>({}));
const catalog=[
  {id:'a-high',name:'Model A (High)',family:'Model A',reasoning:'high',current:true},
  {id:'a-low',name:'Model A (Low)',family:'Model A',reasoning:'low',current:true},
  {id:'b',name:'Model B',family:'Model B',reasoning:'unknown',current:true},
  {id:'retired',name:'Old model',family:'Old',reasoning:'unknown',current:false},
];
test('safe state round-trips selections, controls and missing shared identities',()=>{
  const parsed=state.parseCompareState?.(new URLSearchParams('chart=benchmark&m=a-high&m=missing&metric=epoch_gpqa&condition=%7B%22Shots%22%3A%220%22%7D&scale=log&labels=1&frontier=0&reason=high'),catalog,['b']);
  expect(parsed).toMatchObject({chart:'benchmark',modelIds:['a-high'],missingModelIds:['missing'],
    metricId:'epoch_gpqa',conditionKey:'{"Shots":"0"}',scale:'log',labels:true,frontier:false,reasoningEfforts:['high']});
  expect(state.parseCompareState?.(state.serializeCompareState?.(parsed),catalog,['b'])).toEqual(parsed);
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
