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
 expect(details).toContain('USD / AA Index task');expect(details).toContain('0.25');expect(details).toContain('42');
 const chart=renderToStaticMarkup(createElement(ComparisonChart,{series,labels:false,activeId:null,onPreview:()=>{},onPin:()=>{},svgRef:{current:null}}));
 expect(chart).toContain('USD / AA Index task'); expect(chart).toContain('0.25'); expect(chart).toContain('42');
});
test('manual selection can render the complete current frontier as a separate chart reference',()=>{
 const models=[
  {id:'a',name:'A',family:'A',provider:'Lab',source:'aa' as const,sourceModelId:'a',current:true,intelligence:40,aaTaskCost:1,indexVersion:'4.3',performancePrompt:'long'},
  {id:'b',name:'B',family:'B',provider:'Lab',source:'aa' as const,sourceModelId:'b',current:true,intelligence:80,aaTaskCost:2,indexVersion:'4.3',performancePrompt:'long'},
 ];
 const state={...parseCompareState(new URLSearchParams('chart=task-cost&m=a'),models),frontier:true};
 const selected=buildCompareSeries({models,observations:[]},state);
 const reference=buildCompareSeries({models,observations:[]},{...state,modelIds:['a','b'],frontier:true});
 const html=renderToStaticMarkup(createElement(ComparisonChart,{series:selected,referenceFrontier:reference,labels:false,activeId:null,onPreview:()=>{},onPin:()=>{},svgRef:{current:null}}));
 expect(selected.points.map(point=>point.modelId)).toEqual(['a']);
 expect(Object.values(reference.frontierGroups).flat()).toEqual(['a','b']);
 expect(html).toContain('Pareto line');
 expect((html.match(/current-frontier-mark/g)??[]).length).toBe(2);
});
test('receipts keep source, current values and exact identity immediate while audit fields are disclosed',()=>{
 const models=[{id:'native:exact-id',name:'Opus',family:'Opus',source:'aa' as const,sourceModelId:'native:exact-id',current:true,intelligence:42,aaTaskCost:.25,indexVersion:'4.3',observedAt:'2026-10-01T00:00:00Z',fetchedAt:'2026-10-02T00:00:00Z'}];
 const series=buildCompareSeries({models,observations:[]},parseCompareState(new URLSearchParams('chart=task-cost&m=native%3Aexact-id'),models));
 const receipt=series.points[0].receipt;
 series.points[0].receipt={...receipt,conditions:{shots:3},snapshotId:'snapshot:exact'};
 const html=renderToStaticMarkup(createElement(ObservationDetails,{point:series.points[0],pinned:true,onPin:()=>{},onClose:()=>{},series}));
 expect(html).toContain('USD / AA Index task');expect(html).toContain('0.25');expect(html).toContain('Measurement details');
 expect(html).toContain('Observed');expect(html).toContain('4.3');expect(html).toContain('shots: 3');expect(html).toContain('snapshot:exact');expect(html).toContain('native:exact-id');
 expect(html).not.toContain('observation-floating');
});
test('floating receipts choose the opposite corner using log x coordinates',()=>{
 const models=[{id:'low',name:'Low',family:'Low',source:'aa' as const,sourceModelId:'low',current:true,intelligence:30,aaTaskCost:1},{id:'middle',name:'Middle',family:'Middle',source:'aa' as const,sourceModelId:'middle',current:true,intelligence:80,aaTaskCost:11},{id:'high',name:'High',family:'High',source:'aa' as const,sourceModelId:'high',current:true,intelligence:40,aaTaskCost:100}];
 const series=buildCompareSeries({models,observations:[]},parseCompareState(new URLSearchParams('chart=task-cost&scale=log&m=low&m=middle&m=high'),models));
 const high=series.points.find(point=>point.id==='middle')!;
 const html=renderToStaticMarkup(createElement(ObservationDetails,{point:high,pinned:true,floating:true,onPin:()=>{},onClose:()=>{},series}));
 expect(html).toContain('observation-floating');expect(html).toContain('data-anchor-x="left"');expect(html).toContain('data-anchor-y="bottom"');
});
test('floating receipts use logarithmic midpoint for a logarithmic price axis',()=>{
 const models=[1,11,100].map((price,index)=>({id:'p'+index,name:'P'+index,family:'P'+index,source:'aa' as const,sourceModelId:'p'+index,current:true,priceInput:price,priceOutput:price}));
 const series=buildCompareSeries({models,observations:[]},parseCompareState(new URLSearchParams('chart=price&scale=log&m=p0&m=p1&m=p2'),models));
 const point=series.points.find(row=>row.modelId==='p1'&&row.series==='input')!;
 const html=renderToStaticMarkup(createElement(ObservationDetails,{point,pinned:true,floating:true,onPin:()=>{},onClose:()=>{},series}));
 expect(html).toContain('data-anchor-y="bottom"');
});

test('small measured values never round to zero in chart labels',async()=>{
 const {formatChartNumber}=await import('./compare-geometry');
 for(const value of [.001,.002,.004])expect(formatChartNumber(value)).toBe(String(value));
});
test('endpoint labels obey the Labels control and bar legends never report a non-rendered overflow',()=>{
 const models=Array.from({length:9},(_,index)=>({id:'m'+index,name:'Family '+index,family:'Family '+index,source:'aa' as const,sourceModelId:'m'+index,current:true,intelligence:50+index,priceBlended:index+1,priceInput:index+1,priceOutput:index+2,aaTaskCost:index+1}));
 const scatter=buildCompareSeries({models,observations:[]},parseCompareState(new URLSearchParams('chart=cost-intelligence&m='+models.map(row=>row.id).join('&m=')),models));
 const off=renderToStaticMarkup(createElement(ComparisonChart,{series:scatter,labels:false,endpointLane:true,activeId:null,onPreview:()=>{},onPin:()=>{},svgRef:{current:null}}));
 expect(off).not.toContain('endpoint');expect(off).not.toContain('more families');
 const on=renderToStaticMarkup(createElement(ComparisonChart,{series:scatter,labels:true,endpointLane:true,activeId:null,onPreview:()=>{},onPin:()=>{},svgRef:{current:null}}));
 expect(on).toContain('Family 0 endpoint');
 const bars=buildCompareSeries({models,observations:[]},parseCompareState(new URLSearchParams('chart=price&m='+models.map(row=>row.id).join('&m=')),models));
 const barMarkup=renderToStaticMarkup(createElement(ComparisonChart,{series:bars,labels:true,endpointLane:true,activeId:null,onPreview:()=>{},onPin:()=>{},svgRef:{current:null}}));
 expect(barMarkup).not.toContain('in family rail');expect(barMarkup).not.toContain('more families');
});
test('benchmark bar categories distinguish same-family reasoning variants without changing measured coordinates',()=>{
 const efforts=['max','xhigh','high','medium','low'];
 const models=efforts.map((reasoning,index)=>({id:'opus-'+reasoning,name:`Claude Opus 5.5 (${reasoning})`,family:'Claude Opus 5.5',provider:'Anthropic',reasoning,source:'aa' as const,sourceModelId:'opus-'+reasoning,current:true,intelligence:42+index}));
 const series=buildCompareSeries({models,observations:[]},parseCompareState(new URLSearchParams('chart=benchmark&metric=aa_intelligence_index&m='+models.map(row=>row.id).join('&m=')),models));
 const coordinates=series.points.map(point=>[point.x,point.y]);
 const html=renderToStaticMarkup(createElement(ComparisonChart,{series,labels:true,activeId:null,onPreview:()=>{},onPin:()=>{},svgRef:{current:null}}));
 for(const effort of efforts)expect(html).toContain(`Claude Opus 5.5 (${effort})`);
 expect(html).toContain('horizontal-bars');
 for(const model of models){
  const full=`${model.name} · Anthropic · Artificial Analysis`;
  expect(html).toContain(`<title>${full}</title>`);expect(html).toContain(`aria-label="${full}"`);
 }
 expect(series.points.map(point=>[point.x,point.y])).toEqual(coordinates);
});
test('unresolved native identity stays unresolved after sharing',async()=>{
 const {serializeCompareState}=await import('./compare-state');
 const rows=[{id:'huggingface:lab/a',source:'huggingface',sourceModelId:'lab/a'},{id:'duplicate',source:'huggingface',sourceModelId:'lab/a'}];
 const state=parseCompareState(new URLSearchParams('source=huggingface&record=lab/a'),rows);
 expect(parseCompareState(serializeCompareState(state),rows).modelIds).toEqual([]);
});
