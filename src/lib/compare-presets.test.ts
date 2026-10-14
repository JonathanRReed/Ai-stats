import {expect,test} from 'bun:test';
import {buildComparePresets,buildAaBenchmarkSelections,selectAaBenchmarkModels,selectTokenPriceModels,availableCompareCharts,availableAaMetrics,nextCatalogSource,defaultCatalogSource,canonicalChartMenu} from './compare-presets';
import type {ExplorerModel} from './compare-series';
const aa=(id:string,extra:Partial<ExplorerModel>={}):ExplorerModel=>({id,name:id,family:id,provider:id,source:'aa',sourceModelId:id,current:true,indexVersion:'4.3',intelligence:50,coding:60,priceBlended:0.5,...extra});
test('presets use current same-version measured rows with explicit criteria',()=>{
 const models=[aa('a'),aa('b',{coding:70}),aa('old',{current:false,coding:99}),aa('unknown',{current:null,coding:99}),aa('version-old',{indexVersion:'3',coding:100})];
 const presets=buildComparePresets(models);
 expect(presets.find(p=>p.id==='coding')?.modelIds).toEqual(['b','a']);
 expect(presets.find(p=>p.id==='budget')?.modelIds).toEqual(['a','b']);
 expect(presets.every(p=>p.description.length>0)).toBe(true);
});
test('free text preset excludes zero-token-priced video and unlabelled routes',()=>{
 const route=(id:string,outputs:string[]):ExplorerModel=>({id:'openrouter:'+id,source:'openrouter',sourceModelId:id,name:id,family:id,provider:id,current:true,priceInput:0,priceOutput:0,inputModalities:['text'],outputModalities:outputs});
 const rows=[route('lab/a:free',['text']),route('lab/video',['video']),route('lab/unlabelled',['text'])];
 expect(buildComparePresets(rows).find(p=>p.id==='free')?.modelIds).toEqual(['openrouter:lab/a:free']);
});
test('unavailable cost views and benchmark fields stay out of controls',()=>{
 expect(availableCompareCharts([aa('a')]).map(c=>c.id)).not.toContain('task-cost');
 expect(availableCompareCharts([aa('a',{aaTaskCost:0})]).map(c=>c.id)).toContain('task-cost');
 expect(availableAaMetrics([aa('a')]).map(([key])=>key)).toEqual(['aa_intelligence_index','aa_coding_index']);
});

test('task-cost defaults require known-version current AA task costs and zero remains measured',()=>{
 const rows=[aa('null',{aaTaskCost:null}),aa('unknown',{indexVersion:null,aaTaskCost:1}),
  aa('history',{current:false,aaTaskCost:1}),aa('zero-cost',{aaTaskCost:0}),
  aa('other-family',{family:'Gemini',provider:'Google',indexVersion:'4.2',aaTaskCost:2})];
 expect(availableCompareCharts(rows).find(chart=>chart.id==='task-cost')).toBeTruthy();
});
test('turning off history resets a source that has no current records',()=>{
 const rows=[aa('old',{current:false}),{...aa('or'),source:'openrouter' as const}];
 expect(nextCatalogSource(rows,'aa',false)).toBe('all');
 expect(nextCatalogSource(rows,'aa',true)).toBe('aa');
});
test('catalog source follows the chart unless a valid user choice is already active',()=>{
 const rows=[aa('aa'),{...aa('epoch'),source:'epoch' as const,sourceModelId:'epoch-v1'}];
 expect(defaultCatalogSource(rows,'benchmark','epoch_simplebench',false)).toBe('epoch');
 expect(defaultCatalogSource(rows,'benchmark','aa_coding_index',false)).toBe('aa');
 expect(defaultCatalogSource(rows,'price','aa_intelligence_index',false)).toBe('all');
 expect(nextCatalogSource([...rows,{...aa('openrouter'),source:'openrouter' as const,sourceModelId:'provider/model'}],'openrouter',false)).toBe('openrouter');
 expect(nextCatalogSource(rows,'epoch',false)).toBe('epoch');
 expect(nextCatalogSource(rows,'epoch',true)).toBe('epoch');
});
test('older delivery chart order and labels never replace current view definitions',()=>{
 const menu=canonicalChartMenu(['total-cost','task-cost','price']);
 expect(menu.map(view=>view.id)).toEqual(['task-cost','price','total-cost']);
 expect(menu.map(view=>view.label)).toEqual(['Cost per task','Token prices','Evaluation cost']);
});

test('historical-only AA metrics are not offered as current benchmark choices',()=>{const old={id:'old',name:'Old',family:'Old',source:'aa' as const,sourceModelId:'old',current:false,metrics:{aime:90}};expect(availableAaMetrics([old])).toEqual([]);});

test('switching from a publisher benchmark selects measured current AA records',()=>{
 const rows:ExplorerModel[]=[{id:'p',name:'Publisher',family:'P',source:'publisher',sourceModelId:'p',current:true},{id:'a',name:'AA',family:'A',source:'aa',sourceModelId:'a',current:true,intelligence:40,coding:0,indexVersion:'4.3'},{id:'old',name:'Old',family:'Old',source:'aa',sourceModelId:'old',current:false,intelligence:90,indexVersion:'4.3'}];
 expect(selectAaBenchmarkModels(rows,'aa_intelligence_index')).toEqual(['a']);
 expect(selectAaBenchmarkModels(rows,'aa_coding_index')).toEqual(['a']);
 expect(selectAaBenchmarkModels(rows,'aime')).toEqual([]);
});

test('AA benchmark defaults rank scores inside the latest largest compatible cohort',()=>{
 const models=[...Array.from({length:10},(_,i)=>aa('rank-'+i,{provider:i<8?'Provider A':'Provider B',intelligence:100-i,indexVersion:i===9?'4.9':'4.10'})),
  aa('old-version',{intelligence:1000,indexVersion:'4.9'})];
 expect(selectAaBenchmarkModels(models,'aa_intelligence_index')).toEqual(Array.from({length:8},(_,i)=>'rank-'+i));
});

test('token-price selection excludes retired records and sorts only reported input plus output prices',()=>{
 const models=[aa('cheap-retired',{current:false,priceInput:0,priceOutput:0}),aa('a',{priceInput:1,priceOutput:3}),aa('b',{priceInput:2,priceOutput:1}),
  aa('missing',{priceInput:0,priceOutput:null})];
 expect(selectTokenPriceModels(models)).toEqual(['b','a']);
});

test('measurement indexes cover AA models outside the seed and retain historical-only metrics',()=>{
 const rows:ExplorerModel[]=[{id:'seed',name:'Seed',family:'Seed',source:'aa',sourceModelId:'seed',current:true,intelligence:50,indexVersion:'4.3'},{id:'other',name:'Other',family:'Other',source:'aa',sourceModelId:'other',current:true,indexVersion:'4.3',performancePrompt:'standard',metrics:{gpqa:.8}},{id:'old',name:'Old',family:'Old',source:'aa',sourceModelId:'old',current:false,indexVersion:'4.2',performancePrompt:'standard',metrics:{aime:90}}];
 const index=buildAaBenchmarkSelections(rows);expect(index.gpqa.current).toEqual(['other']);expect(index.aime.current).toEqual([]);expect(index.aime.historical).toEqual(['old']);expect(availableAaMetrics(rows,true).some(([key])=>key==='aime')).toBe(true);
});
