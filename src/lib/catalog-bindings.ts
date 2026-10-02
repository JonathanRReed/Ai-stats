import type {AaModel,ModelAliasRow,IntelligenceSourceRow,PublicCatalogModels} from './supabase';
export type BoundSource='openrouter'|'huggingface'|'litellm'|'epoch-ai'|'polibench';
export type VerifiedBindings=Record<string,Partial<Record<BoundSource,string>>>;
const TARGETS=new Set<BoundSource>(['openrouter','huggingface','litellm','epoch-ai','polibench']);
/** Only reviewed registry associations may join measurements across sources. */
export function buildVerifiedBindings(models:AaModel[],aliases:ModelAliasRow[],sources:IntelligenceSourceRow[]):VerifiedBindings{
 const sourceKeys=new Map(sources.map(source=>[source.id,source.source_key]));
 const owners=new Map<string,Set<string>>();
 for(const model of models)for(const key of [model.id,model.slug].filter((key):key is string=>Boolean(key))){
  const ids=owners.get(key)??new Set<string>();ids.add(model.id);owners.set(key,ids);
 }
 const result:VerifiedBindings={};
 for(const model of models){
  const canonicalIds=new Set(aliases.filter(alias=>sourceKeys.get(alias.intelligence_source_id)==='artificial-analysis'&&
   (alias.source_model_key===model.id||alias.source_model_key===model.slug)&&owners.get(alias.source_model_key)?.size===1&&
   alias.match_method==='source_native'&&Number(alias.confidence)===1).map(alias=>alias.canonical_model_id));
  const candidates=new Map<BoundSource,Set<string>>();
  for(const alias of aliases){
   const source=sourceKeys.get(alias.intelligence_source_id) as BoundSource;
   if(!canonicalIds.has(alias.canonical_model_id)||!TARGETS.has(source)||alias.match_method!=='explicit_cross_source'||
    Number(alias.confidence)!==1||!alias.provenance?.trim()||!alias.source_model_key?.trim())continue;
   const values=candidates.get(source)??new Set<string>();values.add(alias.source_model_key);candidates.set(source,values);
  }
  const bindings=Object.fromEntries([...candidates].filter(([,values])=>values.size===1).map(([source,values])=>[source,[...values][0]]));
  if(Object.keys(bindings).length)result[model.id]=bindings;
 }
 return result;
}
export function enrichVerifiedCatalog(models:AaModel[],catalogs:PublicCatalogModels,bindings:VerifiedBindings={}):AaModel[]{
 const or=new Map(catalogs.openRouterModels.map(row=>[row.openrouter_id,row]));
 const hf=new Map(catalogs.huggingFaceModels.map(row=>[row.model_id,row]));
 const lite=new Map(catalogs.liteLlmModels.map(row=>[row.model_id,row]));
 const endpoints=new Map(catalogs.openRouterEndpointSummaries.map(row=>[row.openrouter_id,row]));
 return models.map(model=>{
  const clean={...model};
  for(const key of Object.keys(clean))if(/^(openrouter_|hf_|litellm_)/.test(key))delete (clean as unknown as Record<string,unknown>)[key];
  const match=bindings[model.id]??{};
  const router=match.openrouter?or.get(match.openrouter):undefined;
  const hub=match.huggingface?hf.get(match.huggingface):undefined;
  const llm=match.litellm?lite.get(match.litellm):undefined;
  const endpoint=router?endpoints.get(router.openrouter_id):undefined;
  return {...clean,
   ...(router?{openrouter_id:router.openrouter_id,openrouter_name:router.name,openrouter_context_length:router.context_length,
    openrouter_prompt_price_1m:router.prompt_price_1m,openrouter_completion_price_1m:router.completion_price_1m,
    openrouter_supported_parameters:router.supported_parameters,openrouter_input_modalities:router.input_modalities,
    openrouter_output_modalities:router.output_modalities,openrouter_is_free:router.is_free}:{}),
   ...(endpoint?{openrouter_endpoint_provider_count:endpoint.provider_count,openrouter_endpoint_providers:endpoint.providers,
    openrouter_endpoint_quantizations:endpoint.quantizations,openrouter_endpoint_min_prompt_price_1m:endpoint.min_prompt_price_1m,
    openrouter_endpoint_min_completion_price_1m:endpoint.min_completion_price_1m}:{}),
   ...(hub?{hf_model_id:hub.model_id,hf_author:hub.author,hf_downloads:hub.downloads,hf_likes:hub.likes,hf_pipeline_tag:hub.pipeline_tag,
    hf_library_name:hub.library_name,hf_last_modified:hub.last_modified,hf_tags:hub.tags}:{}),
   ...(llm?{litellm_model_id:llm.model_id,litellm_provider:llm.provider,litellm_mode:llm.mode,litellm_max_input_tokens:llm.max_input_tokens,
    litellm_max_output_tokens:llm.max_output_tokens,litellm_input_price_1m:llm.input_price_1m,litellm_output_price_1m:llm.output_price_1m,
    litellm_supports_vision:llm.supports_vision,litellm_supports_function_calling:llm.supports_function_calling,
    litellm_supports_reasoning:llm.supports_reasoning,litellm_supports_prompt_caching:llm.supports_prompt_caching,
    litellm_supports_system_messages:llm.supports_system_messages,litellm_supports_web_search:llm.supports_web_search}:{})
  };
 });
}
