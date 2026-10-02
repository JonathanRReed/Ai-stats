import {expect,test} from 'bun:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ObservationDetails from '../components/compare/ObservationDetails';
import ComparisonChart from '../components/compare/ComparisonChart';
import {buildCompareSeries} from './compare-series';
import {parseCompareState} from './compare-state';
test('scatter inspection and keyboard labels expose both exact cost and intelligence',()=>{
 const models=[{id:'a',name:'A',family:'A',source:'aa' as const,sourceModelId:'a',current:true,intelligence:42,aaTaskCost:.25,indexVersion:'4.3'}];
 const series=buildCompareSeries({models,observations:[]},parseCompareState(new URLSearchParams('chart=task-cost&m=a'),models));
 const details=renderToStaticMarkup(createElement(ObservationDetails,{point:series.points[0],pinned:true,onPin:()=>{},onClose:()=>{},series}));
 expect(details).toContain('USD / evaluation task');expect(details).toContain('0.25');expect(details).toContain('42');
 const chart=renderToStaticMarkup(createElement(ComparisonChart,{series,labels:false,activeId:null,onPreview:()=>{},onPin:()=>{},svgRef:{current:null}}));
 expect(chart).toMatch(/aria-label="[^"]*0\.25[^"]*USD \/ evaluation task[^"]*42/);
});

test('small measured values never round to zero in chart labels',async()=>{
 const {formatChartNumber}=await import('./compare-geometry');
 for(const value of [.001,.002,.004])expect(formatChartNumber(value)).toBe(String(value));
});
test('unresolved native identity stays unresolved after sharing',async()=>{
 const {serializeCompareState}=await import('./compare-state');
 const rows=[{id:'huggingface:lab/a',source:'huggingface',sourceModelId:'lab/a'},{id:'duplicate',source:'huggingface',sourceModelId:'lab/a'}];
 const state=parseCompareState(new URLSearchParams('source=huggingface&record=lab/a'),rows);
 expect(parseCompareState(serializeCompareState(state),rows).modelIds).toEqual([]);
});
