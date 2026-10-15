import {expect,test} from 'bun:test';
import {frontierReferenceDisplayCount,shouldShowFrontierReference} from './compare-frontier-reference';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ComparisonChart from '../components/compare/ComparisonChart';
import {buildCompareSeries} from './compare-series';
import {parseCompareState} from './compare-state';

test('automatic truncated frontier warnings use the suggested display count, not an empty reference list',()=>{
 const suggested=Array.from({length:100},(_,index)=>`m${index}`);
 expect(frontierReferenceDisplayCount({
  scatterView:true,
  customSelection:false,
  suggestedIds:suggested,
  frontierReferenceIds:[],
 })).toBe(100);
 expect(frontierReferenceDisplayCount({
  scatterView:true,
  customSelection:true,
  suggestedIds:suggested,
  frontierReferenceIds:suggested.slice(0,15),
 })).toBe(15);
});

test('synthetic frontiers above 100 records report the capped automatic display count',()=>{
 const suggested=Array.from({length:100},(_,index)=>`frontier:${index}`);
 const display=frontierReferenceDisplayCount({
  scatterView:true,
  customSelection:false,
  suggestedIds:suggested,
  frontierReferenceIds:[],
 });
 expect(display).toBe(100);
 expect(`Pareto line reference is limited to ${display} of 115 compatible records by the 100-record selection limit.`)
  .toContain('limited to 100 of 115');
});

test('manual Frontier control hides the current-frontier reference while preserving selected points',()=>{
 const models=[
  {id:'a',name:'A',family:'A',provider:'Lab',source:'aa' as const,sourceModelId:'a',current:true,intelligence:40,aaTaskCost:1,indexVersion:'4.3',performancePrompt:'long'},
  {id:'b',name:'B',family:'B',provider:'Lab',source:'aa' as const,sourceModelId:'b',current:true,intelligence:80,aaTaskCost:2,indexVersion:'4.3',performancePrompt:'long'},
  {id:'c',name:'C',family:'C',provider:'Lab',source:'aa' as const,sourceModelId:'c',current:true,intelligence:60,aaTaskCost:1.5,indexVersion:'4.3',performancePrompt:'long'},
 ];
 const selectedIds=['a','c'];
 const state={...parseCompareState(new URLSearchParams('chart=task-cost&m=a&m=c'),models),frontier:false};
 const selected=buildCompareSeries({models,observations:[]},state);
 expect(shouldShowFrontierReference(false,['a','b','c'])).toBe(false);
 expect(shouldShowFrontierReference(true,['a','b','c'])).toBe(true);
 const reference=shouldShowFrontierReference(state.frontier,['a','b','c'])
  ?buildCompareSeries({models,observations:[]},{...state,modelIds:['a','b','c'],reasoningEfforts:[],frontier:true})
  :null;
 const html=renderToStaticMarkup(createElement(ComparisonChart,{series:selected,referenceFrontier:reference??undefined,labels:true,activeId:null,onPreview:()=>{},onPin:()=>{},svgRef:{current:null}}));
 expect(selected.points.map(point=>point.modelId).sort()).toEqual(selectedIds);
 expect(html).not.toContain('Pareto line');
 expect(html).not.toContain('current-frontier-mark');
});
