import {expect,test} from 'bun:test';
import {buildExplorerCatalog} from './compare-catalog';
import {buildCompareSeries} from './compare-series';
import {parseCompareState} from './compare-state';
const model={id:'a',name:'A',current_source_member:true,aa_intelligence_index:42,price_1m_blended_3_to_1:2,
 source_metadata:{intelligence_index_version:4.3,index_cost:{total_cost:100,cost_per_task:{total_cost:0.25}}}};
test('catalog preserves source-reported evaluation costs without deriving tokens',()=>{
 const row=buildExplorerCatalog([model],[])[0];
 expect(row).toMatchObject({aaTaskCost:0.25,aaEvaluationCost:100});
 expect(row).not.toHaveProperty('totalTokens');
});
test('task and total cost charts use recorded USD costs with versioned intelligence',()=>{
 const models=buildExplorerCatalog([model],[]);
 for(const [chart,x] of [['task-cost',0.25],['total-cost',100]] as const){
 const state=parseCompareState(new URLSearchParams('chart='+chart+'&m=a'),models);
 const series=buildCompareSeries({models,observations:[]},state);
 expect(state.chart).toBe(chart);expect(series.kind).toBe('scatter');
 expect(series.points[0]).toMatchObject({x,y:42,receipt:{source:'Artificial Analysis',indexVersion:'4.3'}});
 }
});
test('unknown cost remains missing even when token prices and speed exist',()=>{
 const models=buildExplorerCatalog([{...model,id:'b',source_metadata:{intelligence_index_version:4.3}}],[]);
 const state=parseCompareState(new URLSearchParams('chart=task-cost&m=b'),models);
 expect(buildCompareSeries({models,observations:[]},state).points).toEqual([]);
});
