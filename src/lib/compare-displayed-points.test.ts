import {expect,test} from 'bun:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ComparisonChart from '../components/compare/ComparisonChart';
import {buildCompareSeries} from './compare-series';
import {parseCompareState} from './compare-state';
import {displayedComparisonPoints} from './compare-displayed-points';
import {seriesCsv} from './compare-export';
const models=[
 {id:'selected',name:'Selected model',family:'Selected',source:'aa' as const,sourceModelId:'selected',current:true,intelligence:40,outputSpeed:50,indexVersion:'4.3',performancePrompt:'long'},
 {id:'reference',name:'Reference model',family:'Reference',source:'aa' as const,sourceModelId:'reference',current:true,intelligence:60,outputSpeed:100,indexVersion:'4.3',performancePrompt:'long'},
];
const state=parseCompareState(new URLSearchParams('chart=speed-intelligence&m=selected&frontier=1'),models);
const selected=buildCompareSeries({models,observations:[]},state);
const reference=buildCompareSeries({models,observations:[]},{...state,modelIds:['selected','reference'],frontier:true});
test('every unselected Pareto marker has a measured record for inspection and exports',()=>{
 const shown=displayedComparisonPoints(selected,reference);
 expect(shown.points.map(point=>point.id)).toEqual(['selected','reference']);
 expect(shown.referencePoints.map(point=>point.id)).toEqual(['reference']);
 const markup=renderToStaticMarkup(createElement(ComparisonChart,{series:selected,referenceFrontier:reference,labels:true,endpointLane:true,activeId:null,onPreview:()=>{},onPin:()=>{},svgRef:{current:null}}));
 expect(markup).toContain('Reference model: 100 Output tokens / second · 60 AA Index points · Pareto reference model');
 expect(markup).toContain('Reference endpoint');
 const csv=seriesCsv(shown.points,{referenceIds:[...shown.referenceIds]});
 expect(csv).toContain('"Shown as"');
 expect(csv).toContain('"Pareto reference"');
 expect(csv).toContain('"Reference model"');
});
test('turning the Pareto line off removes reference records without changing selection',()=>{
 const shown=displayedComparisonPoints(selected,null);
 expect(shown.referencePoints).toEqual([]);
 expect(shown.points).toEqual(selected.points);
});
test('selected Pareto members are never duplicated',()=>{
 const shown=displayedComparisonPoints(reference,reference);
 expect(shown.referencePoints).toEqual([]);
 expect(new Set(shown.points.map(point=>point.id)).size).toBe(shown.points.length);
});
