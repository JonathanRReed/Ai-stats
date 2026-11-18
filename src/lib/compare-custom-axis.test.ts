import {expect,test} from 'bun:test';
import {blendAxis,matchScores,parseScoreCsv} from './compare-custom-axis';
import {parseViewOptions,writeViewOptions,DEFAULT_VIEW_OPTIONS} from './compare-view-options';
import {buildCompareSeries,workloadMonthlyCost,type ExplorerModel} from './compare-series';
import {parseCompareState} from './compare-state';

const model=(id:string,extra:Partial<ExplorerModel>={}):ExplorerModel=>({id,name:id.toUpperCase(),family:id,source:'aa',sourceModelId:id,current:true,indexVersion:'5',...extra});

test('a blend rescales each weighted measure across the records and leaves incomplete records out',()=>{
 const models=[model('a',{intelligence:40,coding:20,outputSpeed:100}),model('b',{intelligence:60,coding:60,outputSpeed:50}),model('c',{intelligence:50,coding:null,outputSpeed:75})];
 const axis=blendAxis(models,{intelligence:50,coding:50,speed:0});
 expect(axis.values).toEqual({a:0,b:100});
 expect(axis.missing).toBe(1);
 expect(axis.label).toBe('Your blend (50% Intelligence Index, 50% Coding Index)');
 const speedOnly=blendAxis(models,{intelligence:0,coding:0,speed:10});
 expect(speedOnly.values).toEqual({a:100,b:0,c:50});
 expect(blendAxis(models,{intelligence:0,coding:0,speed:0}).values).toEqual({});
 expect(blendAxis([models[0]],{intelligence:1,coding:0,speed:0}).values).toEqual({a:50});
});

test('score files skip a header, accept quotes and report rows they cannot read',()=>{
 const parsed=parseScoreCsv('model,score\n"Alpha, Large",71.5\nbeta\t40%\nbroken\n,5\ngamma;abc\n');
 expect(parsed.rows).toEqual([{name:'Alpha, Large',value:71.5,line:2},{name:'beta',value:40,line:3}]);
 expect(parsed.problems).toEqual(['Line 4: expected a model and a number.','Line 5: expected a model and a number.','Line 6: expected a model and a number.']);
 expect(parseScoreCsv('').rows).toEqual([]);
 expect(parseScoreCsv('Opus 5.5 (Max, Default Fallback),88.5\nA, B, C;7').rows).toEqual([{name:'Opus 5.5 (Max, Default Fallback)',value:88.5,line:1},{name:'A, B, C',value:7,line:2}]);
});

test('scores attach only on an exact, unambiguous record match',()=>{
 const models=[model('a',{name:'Alpha (High)',slug:'alpha-high'}),model('b',{name:'Shared'}),model('c',{name:'Shared'})];
 const axis=matchScores([{name:' alpha  (high) ',value:1,line:1},{name:'ALPHA-HIGH',value:2,line:2},{name:'Shared',value:3,line:3},{name:'Alpha',value:4,line:4},{name:'c',value:5,line:5}],models);
 expect(axis.values).toEqual({a:2,c:5});
 expect(axis.unmatched).toEqual(['Shared','Alpha']);
 expect(axis.matched).toBe(2);
});

test('view options survive a link round trip and reject bad input',()=>{
 const options={...DEFAULT_VIEW_OPTIONS,view:'table' as const,budget:.5,valueLines:true,sizeBySpeed:true,asOf:'2026-06-01',workload:{inputTokensPerDay:2e6,outputTokensPerDay:5e5},weights:{intelligence:60,coding:30,speed:10}};
 const params=writeViewOptions(new URLSearchParams('chart=task-cost'),options);
 expect(params.get('chart')).toBe('task-cost');
 expect(parseViewOptions(params)).toEqual(options);
 expect(writeViewOptions(new URLSearchParams('budget=3&view=bars'),DEFAULT_VIEW_OPTIONS).toString()).toBe('');
 expect(parseViewOptions(new URLSearchParams('view=pie&budget=-1&asof=2026-13&win=5&weights=0,0,0&size=area'))).toEqual(DEFAULT_VIEW_OPTIONS);
 expect(parseViewOptions(new URLSearchParams('win=0&wout=0')).workload).toBeNull();
});

test('a workload turns token prices into a monthly cost and a custom axis replaces the score',()=>{
 const models=[model('a',{intelligence:50,priceBlended:2,priceInput:1,priceOutput:5}),model('b',{intelligence:60,priceBlended:4,priceInput:null,priceOutput:9})];
 const workload={inputTokensPerDay:1e6,outputTokensPerDay:2e5};
 expect(workloadMonthlyCost(models[0],workload)).toBe(60);
 const state=parseCompareState(new URLSearchParams('chart=cost-intelligence&m=a&m=b'),models);
 const series=buildCompareSeries({models,observations:[]},state,{workload});
 expect(series.xLabel).toBe('USD / month for your workload');
 expect(series.points.map(point=>[point.id,point.x])).toEqual([['a',60]]);
 expect(series.excluded).toEqual([{modelId:'b',reason:'Missing input or output token price'}]);
 const custom=buildCompareSeries({models,observations:[]},state,{customY:{label:'Your score',unit:'your units',values:{a:7}}});
 expect(custom.yLabel).toBe('Your score');
 expect(custom.points.map(point=>[point.id,point.y,point.unit])).toEqual([['a',7,'your units']]);
 expect(custom.excluded).toEqual([{modelId:'b',reason:'No value on your axis for this record'}]);
 // Bar views never take a custom axis or a workload.
 expect(buildCompareSeries({models,observations:[]},{...state,chart:'price'},{workload,customY:{label:'x',unit:'u',values:{a:1}}}).yLabel).toBe('USD / 1M tokens');
});
