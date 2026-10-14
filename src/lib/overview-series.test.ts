import { expect, test } from 'bun:test';
import { buildExplorerCatalog } from './compare-catalog';
import { buildCompareSeries } from './compare-series';
import { parseCompareState } from './compare-state';
import { buildOverviewSeries, defaultOverviewMetric, overviewCohorts, overviewObservationDate, UNKNOWN_VERSION } from './overview-series';

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
  expect(prices.scale).toBe('linear');
  expect(prices.scaleNotice).toContain('zero');
});

test('overview defaults to task cost only when the default measured cohort has task costs',()=>{
  const withCosts=buildExplorerCatalog([aa('a','A')],[]);
  const withoutCosts=buildExplorerCatalog([aa('a','A',{source_metadata:{intelligence_index_version:'4.3',index_cost:{}}})],[]);
  expect(defaultOverviewMetric(withCosts)).toBe('task-cost');
  expect(defaultOverviewMetric(withoutCosts)).toBe('cost-intelligence');
  expect(overviewObservationDate(withCosts,'4.3')).toBe('2026-10-14T00:00:00Z');
});
