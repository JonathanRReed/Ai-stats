import {expect,test} from 'bun:test';
import {isAutomaticCandidate,automaticFrontier} from './automatic-selection';
import {selectAaBenchmarkModels,selectTokenPriceModels,buildComparePresets} from './compare-presets';
import type {ExplorerModel} from './compare-series';
const model=(id:string,extra:Partial<ExplorerModel>={}):ExplorerModel=>({id,name:id,family:id,source:'aa',sourceModelId:id,current:true,indexVersion:'4.3',intelligence:50,...extra});
test('automatic eligibility excludes known free prices without guessing unknown prices',()=>{
 expect(isAutomaticCandidate(model('free',{priceBlended:0}))).toBe(false);
 expect(isAutomaticCandidate(model('route',{priceInput:0,priceOutput:0}))).toBe(false);
 expect(isAutomaticCandidate(model('unknown'))).toBe(true);
 expect(isAutomaticCandidate(model('partial',{priceInput:0}))).toBe(true);
 expect(isAutomaticCandidate(model('paid',{priceInput:0,priceOutput:1}))).toBe(true);
});
test('all automatic frontiers omit known free models and zero cost, retaining measured Sol-like winners',()=>{
 const rows=[model('free',{priceBlended:0,aaTaskCost:0,outputSpeed:500}),model('sol',{priceBlended:4,aaTaskCost:.2,outputSpeed:100}),model('cost-zero',{priceBlended:1,aaTaskCost:0,outputSpeed:90})];
 expect(automaticFrontier(rows,m=>m.aaTaskCost).modelIds).toEqual(['sol']);
 expect(automaticFrontier(rows,m=>m.outputSpeed,'max').modelIds).toEqual(['sol']);
});
test('benchmark defaults omit known free models but retain unknown-price benchmark coverage',()=>{
 const rows=[model('free',{priceBlended:0,intelligence:100}),model('unknown'),model('paid',{priceBlended:1,intelligence:60})];
 expect(selectAaBenchmarkModels(rows,'aa_intelligence_index')).toEqual(['paid','unknown']);
});
test('token default prices must include a positive charge; explicit free preset remains available',()=>{
 const free=model('or:free',{source:'openrouter',sourceModelId:'or:free',priceInput:0,priceOutput:0,inputModalities:['text'],outputModalities:['text']});
 const rows=[free,model('paid',{priceInput:0,priceOutput:1}),model('missing',{priceInput:0})];
 expect(selectTokenPriceModels(rows)).toEqual(['paid']);
 expect(buildComparePresets(rows).find(p=>p.id==='free')?.modelIds).toEqual(['or:free']);
});
test('token-price defaults compare current text-model leaders, not cheap image or embedding routes',()=>{
 const rows=[model('opus-high',{family:'Opus',intelligence:70,priceInput:5,priceOutput:25}),model('opus-low',{family:'Opus',intelligence:60,priceInput:5,priceOutput:25}),
 model('sol',{family:'Sol',intelligence:65,priceInput:2,priceOutput:8}),model('image',{source:'litellm',priceInput:.001,priceOutput:.001}),
 model('embedding',{source:'openrouter',priceInput:.001,priceOutput:0,inputModalities:['text'],outputModalities:['embedding']})];
 expect(selectTokenPriceModels(rows)).toEqual(['opus-high','sol']);
});
