
/** Sanitized public catalogs. Retrieval timestamps live on the snapshot receipt. */
export const CATALOG_URLS = Object.freeze({
  openrouter: 'https://openrouter.ai/api/v1/models?output_modalities=all',
  huggingface: 'https://huggingface.co/api/models?sort=downloads&direction=-1&limit=700',
  litellm: 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
});
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const strings = value => Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
const number = value => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[+]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const price = value => {
  const parsed = number(value);
  return parsed === null || !Number.isFinite(parsed * 1e6) ? null : parsed * 1e6;
};
const identity = value => {
  const id = text(value);
  if (!id || id.length > 1024) throw new Error('Catalog record has no valid identity');
  return id;
};
const normalizeOpenRouter = raw => {
  const model = object(raw), id = identity(model.id), pricing = object(model.pricing);
  const architecture = object(model.architecture), provider = object(model.top_provider);
  const input = price(pricing.prompt), output = price(pricing.completion);
  const slash = id.indexOf('/');
  const publicPricing = Object.fromEntries(['prompt','completion','request','image','web_search',
    'internal_reasoning','input_cache_read','input_cache_write'].map(key => [key,number(pricing[key])]));
  return {
    id, openrouter_id: id, canonical_slug: text(model.canonical_slug),
    author_slug: slash < 0 ? null : id.slice(0,slash), model_slug: slash < 0 ? id : id.slice(slash+1),
    name: text(model.name) ?? id, description: text(model.description),
    created_unix: number(model.created), context_length: number(model.context_length),
    prompt_price_1m: input, completion_price_1m: output,
    request_price: number(pricing.request), image_price: number(pricing.image),
    web_search_price: number(pricing.web_search),
    internal_reasoning_price_1m: price(pricing.internal_reasoning),
    input_cache_read_price_1m: price(pricing.input_cache_read),
    input_cache_write_price_1m: price(pricing.input_cache_write),
    is_free: id.endsWith(':free') || (input === 0 && output === 0),
    input_modalities: strings(architecture.input_modalities), output_modalities: strings(architecture.output_modalities),
    tokenizer: text(architecture.tokenizer), instruct_type: text(architecture.instruct_type),
    supported_parameters: strings(model.supported_parameters),
    architecture: { input_modalities: strings(architecture.input_modalities), output_modalities: strings(architecture.output_modalities),
      tokenizer: text(architecture.tokenizer), instruct_type: text(architecture.instruct_type) },
    pricing: publicPricing,
    top_provider: { context_length: number(provider.context_length), max_completion_tokens: number(provider.max_completion_tokens),
      is_moderated: typeof provider.is_moderated === 'boolean' ? provider.is_moderated : null },
  };
};
const normalizeHuggingFace = raw => {
  const model = object(raw), id = identity(model.modelId ?? model.id);
  return { id, model_id: id, author: text(model.author) ?? id.split('/')[0],
    downloads: number(model.downloads), likes: number(model.likes), pipeline_tag: text(model.pipeline_tag),
    library_name: text(model.library_name), last_modified: text(model.lastModified), tags: strings(model.tags) };
};
const normalizeLiteLlm = ([key,raw]) => {
  if (key === 'sample_spec') return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('LiteLLM catalog record is malformed');
  const model = object(raw), mode = text(model.mode);
  if (mode && !['chat','completion','responses'].includes(mode)) return null;
  const id = identity(key);
  return { id, model_id: id, provider: text(model.litellm_provider), mode,
    max_input_tokens: number(model.max_input_tokens) ?? number(model.max_tokens),
    max_output_tokens: number(model.max_output_tokens),
    input_price_1m: price(model.input_cost_per_token), output_price_1m: price(model.output_cost_per_token),
    supports_vision: model.supports_vision === true, supports_function_calling: model.supports_function_calling === true,
    supports_reasoning: model.supports_reasoning === true, supports_prompt_caching: model.supports_prompt_caching === true,
    supports_system_messages: model.supports_system_messages !== false, supports_web_search: model.supports_web_search === true };
};
export function normalizeCatalog(sourceKey, payload) {
  let records;
  if (sourceKey === 'openrouter') {
    if (!Array.isArray(payload?.data)) throw new Error('OpenRouter catalog is incomplete');
    records = payload.data.map(normalizeOpenRouter);
  } else if (sourceKey === 'huggingface') {
    if (!Array.isArray(payload)) throw new Error('Hugging Face catalog is incomplete');
    records = payload.map(normalizeHuggingFace);
  } else if (sourceKey === 'litellm') {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('LiteLLM catalog is incomplete');
    records = Object.entries(payload).map(normalizeLiteLlm).filter(Boolean);
  } else throw new Error('Unknown public catalog');
  if (!records.length || records.length > 20000) throw new Error('Catalog has an invalid record count');
  if (new Set(records.map(row => row.id)).size !== records.length) throw new Error('Catalog has duplicate identities');
  return records.sort((a,b) => a.id.localeCompare(b.id));
}

export const catalogPricePerMillion=price;

/** Validate already-normalized records without reinterpreting their price units. */
export function validCatalogRecords(sourceKey, records) {
  if (!Object.hasOwn(CATALOG_URLS,sourceKey) || !Array.isArray(records) || !records.length || records.length>20000) return false;
  const ids=new Set();
  const numeric=value=>value===null||(typeof value==='number'&&Number.isFinite(value)&&value>=0);
  for(const record of records) {
    if(!record||typeof record!=='object'||Array.isArray(record)||typeof record.id!=='string'||!record.id.trim()||ids.has(record.id))return false;
    const identityKey=sourceKey==='openrouter'?'openrouter_id':'model_id';
    if(record[identityKey]!==record.id)return false;
    const numbers=sourceKey==='openrouter'?['context_length','prompt_price_1m','completion_price_1m']:
      sourceKey==='huggingface'?['downloads','likes']:['max_input_tokens','max_output_tokens','input_price_1m','output_price_1m'];
    if(numbers.some(key=>!numeric(record[key])))return false;
    const arrays=sourceKey==='openrouter'?['input_modalities','output_modalities','supported_parameters']:sourceKey==='huggingface'?['tags']:[];
    if(arrays.some(key=>!Array.isArray(record[key])||record[key].some(item=>typeof item!=='string')))return false;
    if(sourceKey==='openrouter'&&typeof record.is_free!=='boolean')return false;
    ids.add(record.id);
  }
  return true;
}

/** Separate read-only embedding surface: retain unambiguous valid rows, never use this for cache publication. */
export function normalizeEmbeddingCatalog(payload) {
 if(!Array.isArray(payload?.data))throw new Error('Invalid embedding response');
 const counts=new Map();
 for(const row of payload.data){const id=text(object(row).id);if(id)counts.set(id,(counts.get(id)??0)+1);}
 const records=[];
 for(const row of payload.data){
  const id=text(object(row).id);if(!id||counts.get(id)!==1)continue;
  try{records.push(normalizeOpenRouter(row));}catch{ /* One unusable row does not erase the remaining models. */ }
 }
 if(!records.length)throw new Error('No usable embedding models');
 return records.sort((a,b)=>a.id.localeCompare(b.id));
}
