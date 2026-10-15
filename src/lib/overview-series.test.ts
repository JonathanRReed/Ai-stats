import { expect, test } from 'bun:test';
import { buildExplorerCatalog } from './compare-catalog';
import { buildCompareSeries, chartLabelCandidates, collisionFreeChartLabels, compatibleVariantLines, type SeriesPoint } from './compare-series';
import { parseCompareState } from './compare-state';
import { buildOverviewSeries, defaultOverviewMetric, overviewCohorts, overviewObservationDate, retainAvailableProvider, UNKNOWN_VERSION } from './overview-series';

const aa = (id:string, family:string, extra:Record<string,unknown>={}) => ({
  id, name:family, slug:id, creator_name:'Provider', current_source_member:true,
  aa_intelligence_index:125, price_1m_blended_3_to_1:0, last_seen:'2026-10-14T00:00:00Z',
  source_metadata:{intelligence_index_version:'4.3',performance_prompt:'long',index_cost:{total_cost:10,cost_per_task:{total_cost:0.5}}},
  ...extra,
});

test('overview uses the compare catalog and series values for the same AA identity',()=>{
  const models=buildExplorerCatalog([aa('opus-a','Opus'),aa('other-family','Other')],[]);
  const overview=buildOverviewSeries(models,'task-cost','4.3').points.find(point=>point.modelId==='opus-a');
  const state=parseCompareState(new URLSearchParams('chart=task-cost&m=opus-a'),models,[]);
  const compare=buildCompareSeries({models,observations:[]},state).points[0];
  expect(overview).toMatchObject({modelId:'opus-a',x:.5,y:125,source:'aa',cohortKey:'4.3:long'});
  expect(overview).toEqual(compare);
});

test('overview isolates recorded versions and leaves unknown versions out of known cohorts',()=>{
  const models=buildExplorerCatalog([
    aa('new','New',{source_metadata:{intelligence_index_version:'4.3.2',index_cost:{cost_per_task:{total_cost:1}}}}),
    aa('old','Old',{source_metadata:{intelligence_index_version:'4.3',index_cost:{cost_per_task:{total_cost:2}}}}),
    aa('unknown','Unknown',{source_metadata:{index_cost:{cost_per_task:{total_cost:3}}}}),
  ],[]);
  expect(overviewCohorts(models)).toEqual(['4.3.2','4.3',UNKNOWN_VERSION]);
  expect(buildOverviewSeries(models,'task-cost','4.3.2').points.map(point=>point.modelId)).toEqual(['new']);
  expect(buildOverviewSeries(models,'task-cost',UNKNOWN_VERSION).frontierGroups).toEqual({});
});

test('malformed AA index versions stay outside verified frontier and variant cohorts',()=>{
 const models=buildExplorerCatalog([
  aa('bad-a','Malformed family',{source_metadata:{intelligence_index_version:'4.x',performance_prompt:'long',index_cost:{cost_per_task:{total_cost:1}}}}),
  aa('bad-b','Malformed family',{source_metadata:{intelligence_index_version:'unverified',performance_prompt:'long',index_cost:{cost_per_task:{total_cost:2}}}}),
 ],[]);
 const variantModels=models.map((model,index)=>({...model,reasoning:index?'high':'low'}));
 const state=parseCompareState(new URLSearchParams('chart=task-cost&m=bad-a&m=bad-b'),variantModels,[]);
 const series=buildCompareSeries({models:variantModels,observations:[]},state);
 expect(series.points.map(point=>point.cohortKey)).toEqual([null,null]);
 expect(series.frontierGroups).toEqual({});
 expect(compatibleVariantLines(series.points)).toEqual([]);
});

test('overview keeps index values above 100, accepts zero token prices, and excludes null axes',()=>{
  const models=buildExplorerCatalog([
    aa('zero','Zero'),
    aa('null-index','Null index',{aa_intelligence_index:null}),
    aa('null-price','Null price',{price_1m_blended_3_to_1:null}),
    aa('missing-task','Missing task',{source_metadata:{intelligence_index_version:'4.3',index_cost:{}}}),
  ],[]);
  const task=buildOverviewSeries(models,'task-cost','4.3');
  expect(task.points.map(point=>point.modelId)).toEqual(['zero','null-price']);
  expect(task.points[0].y).toBe(125);
  const prices=buildOverviewSeries(models,'cost-intelligence','4.3');
  expect(prices.points.map(point=>point.modelId)).toEqual(['zero','missing-task']);
  expect(prices.points[0].x).toBe(0);
  expect(prices.scale).toBe('log');
  expect(prices.omittedFromLog.map(point=>point.modelId)).toContain('zero');
  expect(prices.scaleNotice).toContain('zero');
});

test('overview defaults to task cost only when the default measured cohort has task costs',()=>{
  const withCosts=buildExplorerCatalog([aa('a','A')],[]);
  const withoutCosts=buildExplorerCatalog([aa('a','A',{source_metadata:{intelligence_index_version:'4.3',index_cost:{}}})],[]);
  expect(defaultOverviewMetric(withCosts)).toBe('task-cost');
  expect(defaultOverviewMetric(withoutCosts)).toBe('cost-intelligence');
  expect(overviewObservationDate(withCosts,'4.3')).toBe('2026-10-14T00:00:00Z');
});

test('provider filters reset when a selected provider is absent from the new cohort',()=>{
 expect(retainAvailableProvider('Anthropic',['Google','OpenAI'])).toBe('');
 expect(retainAvailableProvider('OpenAI',['Google','OpenAI'])).toBe('OpenAI');
});

test('chart labels are deterministic, prioritize frontier records, and stay sparse',()=>{
 const points=Array.from({length:30},(_,i)=>({id:'m'+i,label:'Model '+i,family:'Family '+i,reasoning:'unknown',series:'value',source:'aa',x:i,y:i,unit:'score',cohortKey:null,receipt:{source:'AA',sourceUrl:null,observedAt:null,fetchedAt:null,indexVersion:null,conditions:null,snapshotId:null}} as SeriesPoint));
 const labels=chartLabelCandidates(points,{'cohort':['m20','m21']},8);
 expect(labels.slice(0,2)).toEqual(['m20','m21']);
 expect(labels).toHaveLength(8);
 expect(chartLabelCandidates(points,{'cohort':['m20','m21']},8)).toEqual(labels);
});

test('visible chart labels keep frontier endpoints when they fit and skip collisions',()=>{
 const points=Array.from({length:4},(_,i)=>({id:'p'+i,label:'Model '+i,family:'F'+i,reasoning:'unknown',series:'value',source:'aa',x:i,y:i,unit:'score',cohortKey:null,cx:i<3?80+i*14:350,cy:i<3?100:200,receipt:{source:'AA',sourceUrl:null,observedAt:null,fetchedAt:null,indexVersion:null,conditions:null,snapshotId:null}} as SeriesPoint&{cx:number;cy:number}));
 const selected=collisionFreeChartLabels(points,{'cohort':['p0','p1','p2','p3']},500,4);
 expect(selected).toContain('p0');
 expect(selected).not.toContain('p1');
 expect(selected).not.toContain('p2');
 expect(selected).toContain('p3');
 expect(collisionFreeChartLabels(points,{'cohort':['p0','p1','p2','p3']},500,4)).toEqual(selected);
});
test('homepage suggestions share the nonfree comparison policy, including after provider filtering',async()=>{
 const {overviewSuggestions}=await import('./overview-series');
 const rows=buildExplorerCatalog([
  aa('free','Free',{price_1m_blended_3_to_1:0}),
  aa('paid','Paid',{creator_name:'Provider A',price_1m_blended_3_to_1:2}),
  aa('other','Other',{creator_name:'Provider B',price_1m_blended_3_to_1:3,aa_intelligence_index:30}),
  aa('zero-task','Zero task',{price_1m_blended_3_to_1:1,source_metadata:{intelligence_index_version:'4.3',index_cost:{cost_per_task:{total_cost:0}}}}),
 ],[]);
 expect(overviewSuggestions(rows,'task-cost','4.3')).toEqual(['paid']);
 expect(overviewSuggestions(rows,'task-cost','4.3','Provider B')).toEqual(['other']);
 expect(overviewSuggestions(rows,'cost-intelligence','4.3')).not.toContain('free');
});
