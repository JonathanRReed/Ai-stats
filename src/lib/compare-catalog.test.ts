import {expect,test} from 'bun:test';
const catalog=await import('./compare-catalog').catch(()=>({}));
test('catalog keeps exact variants and does not merge AA and Epoch by display name',()=>{
  const aa=[{id:'aa1',name:'Model (High)',slug:'model-high',creator_name:'Lab',current_source_member:true,
    aa_intelligence_index:0,price_1m_blended_3_to_1:0,last_seen:'2026-10-02T00:00:00Z',
    source_metadata:{intelligence_index_version:4.2,performance_prompt:'long'}}];
  const epoch=[{model_version:'v1',display_name:'Model (High)',organization:'Lab'}];
  const result=catalog.buildExplorerCatalog?.(aa,epoch);
  expect(result).toHaveLength(2);
  expect(result?.[0]).toMatchObject({id:'aa1',source:'aa',family:'Model',reasoning:'high',intelligence:0,
    priceBlended:0,indexVersion:'4.2',performancePrompt:'long',current:true});
  expect(result?.[1]).toMatchObject({id:'epoch:v1',source:'epoch',sourceModelId:'v1',reasoning:'unknown'});
});
test('unknown prices and source membership remain unknown',()=>{
  const result=catalog.buildExplorerCatalog?.([{id:'a',name:'A',price_1m_input_tokens:null,price_1m_output_tokens:'',
    current_source_member:null,source_metadata:{}}],[]);
  expect(result?.[0]).toMatchObject({priceInput:null,priceOutput:null,current:null,indexVersion:null});
});
test('default selection excludes history and missing measurements without inventing a winner',()=>{
  const models=[{id:'old',name:'Old',family:'Old',source:'aa',sourceModelId:'old',current:false,intelligence:100,priceBlended:1},
    {id:'a',name:'A',family:'A',source:'aa',sourceModelId:'a',current:true,intelligence:70,priceBlended:0},
    {id:'b',name:'B',family:'B',source:'aa',sourceModelId:'b',current:true,intelligence:60,priceBlended:1}];
  expect(catalog.defaultExplorerSelection?.(models)).toEqual(['a','b']);
});
test('recorded date labels stay in family names and unknown reasoning is not called none',()=>{
  expect(catalog.modelDisplayFacets?.('Model (Jan 2025)')).toEqual({family:'Model (Jan 2025)',reasoning:'unknown'});
  expect(catalog.modelDisplayFacets?.('Model (Adaptive Reasoning, Xhigh Effort, Default Fallback)'))
    .toEqual({family:'Model',reasoning:'xhigh'});
});
