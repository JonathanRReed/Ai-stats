import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {buildExplorerCatalog,defaultExplorerSelection} from './compare-catalog';
import {buildCompareSeries} from './compare-series';
import {parseCompareState} from './compare-state';
import CompareExplorer from '../components/compare/CompareExplorer';
import ModelSelector from '../components/compare/ModelSelector';
import {readFileSync} from 'node:fs';
test('all cached records survive, including free routes and LiteLLM records past 2500',()=>{
 const models=buildExplorerCatalog([],[],{openrouter:[{id:'lab/free',name:'Free',is_free:true,prompt_price_1m:0,completion_price_1m:0}],
 litellm:Array.from({length:3555},(_,i)=>({id:'route/'+i,provider:'Provider',input_price_1m:1,output_price_1m:2})),
 huggingface:[{id:'lab/model',model_id:'lab/model',author:'lab'}]});
 expect(models).toHaveLength(3557);
 expect(models.find(m=>m.id==='openrouter:lab/free')).toMatchObject({priceInput:0,priceOutput:0,source:'openrouter'});
 expect(models.some(m=>m.id==='litellm:route/3554')).toBe(true);
 expect(models.find(m=>m.source==='huggingface')?.intelligence).toBeUndefined();
});
test('prices retain source provenance without borrowing benchmark scores',()=>{
 const models=buildExplorerCatalog([],[],{openrouter:[{id:'lab/free',name:'Free',prompt_price_1m:0,completion_price_1m:0}]});
 const state=parseCompareState(new URLSearchParams('chart=price&m=openrouter:lab/free'),models);
 const result=buildCompareSeries({models,observations:[]},state);
 expect(result.points).toHaveLength(2);
 expect(result.points[0]).toMatchObject({y:0,receipt:{source:'OpenRouter'}});
 expect(buildCompareSeries({models,observations:[]},{...state,chart:'cost-intelligence'}).points).toHaveLength(0);
});
test('unavailable chart links recover and no disabled cost/token tabs appear',()=>{
 const state=parseCompareState(new URLSearchParams('chart=tokens-task'),[]);
 expect(state.chart).toBe('cost-intelligence');
 const html=renderToStaticMarkup(createElement(CompareExplorer,{models:[],benchmarks:[],defaultModelIds:[]}));
 expect(html).not.toContain('Task cost'); expect(html).not.toContain('Total tokens');
 expect(html).toContain('Compare by');
});
test('picker offers more results and searches the full catalog with source labels',()=>{
 const models=buildExplorerCatalog(Array.from({length:100},(_,i)=>({id:'a'+i,name:'Model '+i,current_source_member:true})),[]);
 const html=renderToStaticMarkup(createElement(ModelSelector,{models,selected:[],includeHistory:false,onToggle:()=>{},onFamily:()=>{},onHistory:()=>{},reasoningEfforts:[],onReasoning:()=>{},onClear:()=>{},onReset:()=>{}}));
 expect(html).toContain('Show more'); expect(html).toContain('Artificial Analysis'); expect(html).toContain('Catalog source');
});
test('default comparison stays compact without hiding other variants',()=>{
 const models=buildExplorerCatalog([{id:'high',name:'A (High)',creator_name:'Lab',current_source_member:true,aa_intelligence_index:70,price_1m_blended_3_to_1:2},{id:'low',name:'A (Low)',creator_name:'Lab',current_source_member:true,aa_intelligence_index:60,price_1m_blended_3_to_1:1}],[]);
 expect(defaultExplorerSelection(models)).toEqual(['high']); expect(models).toHaveLength(2);
});
test('Compare uses uncapped database caches rather than the capped homepage getter',()=>{
 const page=readFileSync('src/pages/compare.astro','utf8');
 expect(page).toContain('getCompareCatalogSources');
 expect(page).toContain('getCanonicalModels');
 const css=readFileSync('src/styles/compare-explorer.css','utf8');
 expect(css).toContain('min-height:44px');
});

test('canonical inventory only suppresses exact source-native aliases',()=>{
 const result=buildExplorerCatalog([{id:'a',name:'Same'}],[],{},{
 sources:[{id:1,source_key:'artificial-analysis'}],
 aliases:[{canonical_model_id:1,intelligence_source_id:1,source_model_key:'a'}],
 models:[{id:1,canonical_key:'aa:a',display_name:'Same'},{id:2,canonical_key:'other:b',display_name:'Same'}]});
 expect(result.map(model=>model.id)).toEqual(['a','catalog:other:b']);
 expect(result[1].intelligence).toBeUndefined();
});

test('Epoch inventory uses the registered epoch-ai source key',()=>{
 const result=buildExplorerCatalog([],[{model_version:'v',display_name:'V'}],{},{
 sources:[{id:2,source_key:'epoch-ai'}],aliases:[{canonical_model_id:2,intelligence_source_id:2,source_model_key:'v'}],
 models:[{id:2,canonical_key:'epoch-ai:v',display_name:'V'}]});
 expect(result.map(model=>model.id)).toEqual(['epoch:v']);
});
