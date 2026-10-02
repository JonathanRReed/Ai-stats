import {expect,test} from 'bun:test';
import {buildVerifiedBindings,enrichVerifiedCatalog} from './catalog-bindings';
import type {AaModel,ModelAliasRow,IntelligenceSourceRow,PublicCatalogModels} from './supabase';
const aa={id:'aa-id',slug:'model-high',name:'Model (High)',creator_name:'Lab'} as AaModel;
const sources=[{id:1,source_key:'artificial-analysis'},{id:2,source_key:'openrouter'}] as IntelligenceSourceRow[];
const alias=(overrides:Partial<ModelAliasRow>)=>({canonical_model_id:1,intelligence_source_id:1,source_model_key:'model-high',source_model_name:'Model',match_method:'source_native',provenance:'Recorded native ID',confidence:1,updated_at:'2026-10-02T00:00:00Z',...overrides}) as ModelAliasRow;
const catalogs={openRouterModels:[{openrouter_id:'lab/model:free',name:'Model',prompt_price_1m:0,completion_price_1m:0,context_length:123}],
 huggingFaceModels:[],liteLlmModels:[],openRouterUsageRankings:[],openRouterEndpointSummaries:[],openRouterProviders:[],openRouterEmbeddingModels:[],openRouterModelCount:null} as unknown as PublicCatalogModels;
test('similar names never authorize catalog measurements',()=>{
 expect(enrichVerifiedCatalog([aa],catalogs,{})).toEqual([aa]);
 expect(buildVerifiedBindings([aa],[alias({}),alias({intelligence_source_id:2,source_model_key:'lab/model:free'})],sources)).toEqual({});
});
test('explicit verified native association preserves the exact free route and zero price',()=>{
 const bindings=buildVerifiedBindings([aa],[alias({}),alias({intelligence_source_id:2,source_model_key:'lab/model:free',match_method:'explicit_cross_source'})],sources);
 expect(bindings).toEqual({'aa-id':{openrouter:'lab/model:free'}});
 expect(enrichVerifiedCatalog([aa],catalogs,bindings)[0]).toMatchObject({openrouter_id:'lab/model:free',openrouter_prompt_price_1m:0,openrouter_context_length:123});
});
test('ambiguous routes, weak claims and duplicate AA slugs cannot become verified joins',()=>{
 const native=alias({});
 const link=alias({intelligence_source_id:2,source_model_key:'lab/model:free',match_method:'explicit_cross_source'});
 expect(buildVerifiedBindings([aa],[native,link,{...link,source_model_key:'lab/model'}],sources)).toEqual({});
 expect(buildVerifiedBindings([aa],[native,{...link,confidence:0.5}],sources)).toEqual({});
 expect(buildVerifiedBindings([aa,{...aa,id:'other'}],[native,link],sources)).toEqual({});
});
test('unverified previously-enriched fields do not survive a rebuild',()=>{
 const old={...aa,openrouter_id:'wrong/model',litellm_model_id:'wrong',hf_model_id:'wrong'};
 expect(enrichVerifiedCatalog([old],catalogs,{})[0]).toEqual(aa);
});
