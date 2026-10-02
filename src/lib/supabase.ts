import {buildVerifiedBindings,enrichVerifiedCatalog,type VerifiedBindings} from './catalog-bindings';
import {normalizeEmbeddingCatalog,catalogPricePerMillion} from '../../scripts/public-catalogs.mjs';
import {parseCatalogCache,catalogReadReceipt} from './catalog-cache';
import { readAaCohort } from './aa-membership';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AA_MODEL_SELECT_COLUMNS } from './aa-model-columns';
import {
  dedupeAaModelsBySlug,
  hydrateEpochModelsFromRuns,
  normalizeAaOperationalMetrics,
  sortAaModelsByIntelligence,
} from './data-integrity';

// Public client for server-side fetching (Astro on the server).
// Uses anon key; RLS allows read on public tables.
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[supabase] Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
      })
    : null;

export { AA_MODEL_SELECT_COLUMNS };

const SUPABASE_PAGE_SIZE = 1000;

type SupabasePageResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

const fetchAllPages = async <T>(
  makeQuery: (from: number, to: number) => PromiseLike<SupabasePageResult<T>>,
): Promise<T[]> => {
  const rows: T[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await makeQuery(from, to);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows;
};

// Epoch.ai types
export type EpochModel = {
  id: string;
  model_version: string;
  model_name: string | null;
  display_name: string | null;
  organization: string | null;
  country: string | null;
  model_accessibility: string | null;
  release_date: string | null;
  eci_score: number | null;
  training_compute_flop: number | null;
  training_compute_confidence: string | null;
  description: string | null;
};

export type EpochBenchmark = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  source: string | null;
};

export type EpochBenchmarkRun = {
  conditions?: Record<string, string | number | boolean> | null;
  evaluation_date?: string | null;
  score_unit?: 'native' | 'percent' | 'fraction';
  id: string;
  model_version: string;
  benchmark_id: string;
  score: number | null;
  release_date: string | null;
  organization: string | null;
  country: string | null;
  stderr: number | null;
  score_metric?: string | null;
  source_name?: string | null;
  source_link?: string | null;
  benchmark_name?: string;
  benchmark_slug?: string;
};

export type AaModel = {
  current_source_member?: boolean | null;
  id: string;
  name: string | null;
  slug: string | null;
  creator_id: string | null;
  creator_name: string | null;
  creator_slug: string | null;
  source_metadata?: {
    endpoint?: string;
    intelligence_index_version?: string | number | null;
    performance_prompt?: string | null;
    tier?: string | null;
    observed_at?: string | null;
    release_date?: string | null;
  } | null;
  evaluations: Record<string, unknown> | null;
  aa_intelligence_index: number | null;
  aa_coding_index: number | null;
  aa_agentic_index?: number | null;
  aa_math_index: number | null;
  mmlu_pro: number | null;
  gpqa: number | null;
  hle: number | null;
  livecodebench: number | null;
  scicode: number | null;
  math_500: number | null;
  aime: number | null;
  pricing: Record<string, unknown> | null;
  price_1m_blended_3_to_1: number | null;
  price_1m_input_tokens: number | null;
  price_1m_output_tokens: number | null;
  median_output_tokens_per_second: number | null;
  median_time_to_first_token_seconds: number | null;
  median_time_to_first_answer_token: number | null;
  first_seen: string;
  last_seen: string;
  // Derived for UI
  company_name?: string | null;
  openrouter_id?: string | null;
  openrouter_name?: string | null;
  openrouter_context_length?: number | null;
  openrouter_prompt_price_1m?: number | null;
  openrouter_completion_price_1m?: number | null;
  openrouter_supported_parameters?: string[];
  openrouter_input_modalities?: string[];
  openrouter_output_modalities?: string[];
  openrouter_is_free?: boolean;
  openrouter_usage_rank?: number | null;
  openrouter_usage_tokens?: number | null;
  openrouter_usage_requests?: number | null;
  openrouter_usage_share?: number | null;
  openrouter_usage_variant?: string | null;
  openrouter_usage_change?: number | null;
  openrouter_endpoint_provider_count?: number | null;
  openrouter_endpoint_providers?: string[];
  openrouter_endpoint_quantizations?: string[];
  openrouter_endpoint_min_prompt_price_1m?: number | null;
  openrouter_endpoint_min_completion_price_1m?: number | null;
  hf_model_id?: string | null;
  hf_author?: string | null;
  hf_downloads?: number | null;
  hf_likes?: number | null;
  hf_pipeline_tag?: string | null;
  hf_library_name?: string | null;
  hf_last_modified?: string | null;
  hf_tags?: string[];
  litellm_model_id?: string | null;
  litellm_provider?: string | null;
  litellm_mode?: string | null;
  litellm_max_input_tokens?: number | null;
  litellm_max_output_tokens?: number | null;
  litellm_input_price_1m?: number | null;
  litellm_output_price_1m?: number | null;
  litellm_supports_vision?: boolean;
  litellm_supports_function_calling?: boolean;
  litellm_supports_reasoning?: boolean;
  litellm_supports_prompt_caching?: boolean;
  litellm_supports_system_messages?: boolean;
  litellm_supports_web_search?: boolean;
};

export type CanonicalModelRow = {
  id: number;
  canonical_key: string;
  display_name: string;
  provider_name: string | null;
  model_family: string | null;
  release_date: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type ModelAliasRow = {
  canonical_model_id: number;
  intelligence_source_id: number;
  source_model_key: string;
  source_model_name: string | null;
  match_method: 'source_native' | 'explicit_cross_source';
  provenance: string;
  confidence: number;
  updated_at: string;
};

export type IntelligenceSourceRow = {
  id: number;
  source_key: string;
  display_name: string;
  homepage_url: string | null;
  status: string;
  last_successful_run_at: string | null;
};

export type OpenRouterModel = {
  id: string;
  openrouter_id: string;
  canonical_slug: string | null;
  author_slug: string | null;
  model_slug: string | null;
  name: string;
  description: string | null;
  created_unix: number | null;
  context_length: number | null;
  prompt_price_1m: number | null;
  completion_price_1m: number | null;
  request_price: number | null;
  image_price: number | null;
  web_search_price: number | null;
  internal_reasoning_price_1m: number | null;
  input_cache_read_price_1m: number | null;
  input_cache_write_price_1m: number | null;
  is_free: boolean;
  input_modalities: string[];
  output_modalities: string[];
  tokenizer: string | null;
  instruct_type: string | null;
  supported_parameters: string[];
  architecture: Record<string, unknown>;
  pricing: Record<string, unknown>;
  top_provider: Record<string, unknown> | null;
  fetched_at: string;
};

export type HuggingFaceHubModel = {
  id: string;
  model_id: string;
  author: string | null;
  downloads: number | null;
  likes: number | null;
  pipeline_tag: string | null;
  library_name: string | null;
  last_modified: string | null;
  tags: string[];
  fetched_at: string;
};

export type LiteLLMCatalogModel = {
  id: string;
  model_id: string;
  provider: string | null;
  mode: string | null;
  max_input_tokens: number | null;
  max_output_tokens: number | null;
  input_price_1m: number | null;
  output_price_1m: number | null;
  supports_vision: boolean;
  supports_function_calling: boolean;
  supports_reasoning: boolean;
  supports_prompt_caching: boolean;
  supports_system_messages: boolean;
  supports_web_search: boolean;
  fetched_at: string;
};

export type OpenRouterUsageRanking = {
  id: string;
  model_permaslug: string;
  variant_permaslug: string;
  provider: string | null;
  variant: string | null;
  rank: number;
  total_tokens: number;
  request_count: number;
  tool_calls: number;
  tool_call_errors: number;
  usage_share: number | null;
  change: number | null;
  date: string | null;
  fetched_at: string;
};

export type OpenRouterProvider = {
  id: string;
  name: string;
  slug: string;
  privacy_policy_url: string | null;
  terms_of_service_url: string | null;
  status_page_url: string | null;
  headquarters: string | null;
  datacenters: string[];
  fetched_at: string;
};

export type OpenRouterModelCount = {
  count: number | null;
  fetched_at: string;
};

export type OpenRouterEmbeddingModel = {
  id: string;
  openrouter_id: string;
  name: string;
  author_slug: string | null;
  model_slug: string | null;
  context_length: number | null;
  prompt_price_1m: number | null;
  input_modalities: string[];
  output_modalities: string[];
  supported_parameters: string[];
  fetched_at: string;
};

export type OpenRouterEndpointSummary = {
  id: string;
  openrouter_id: string;
  provider_count: number;
  providers: string[];
  quantizations: string[];
  max_context_length: number | null;
  min_prompt_price_1m: number | null;
  min_completion_price_1m: number | null;
  fetched_at: string;
};

type OpenRouterApiProvider = {
  name?: string;
  slug?: string;
  privacy_policy_url?: string | null;
  terms_of_service_url?: string | null;
  status_page_url?: string | null;
  headquarters?: string | null;
  datacenters?: string[];
};

type OpenRouterApiEndpoint = {
  provider_name?: string;
  name?: string;
  quantization?: string;
  context_length?: number;
  pricing?: Record<string, string | number | null | undefined>;
};

export type PublicCatalogModels = {
  openRouterModels: OpenRouterModel[];
  huggingFaceModels: HuggingFaceHubModel[];
  liteLlmModels: LiteLLMCatalogModel[];
  openRouterUsageRankings: OpenRouterUsageRanking[];
  openRouterProviders: OpenRouterProvider[];
  openRouterModelCount: OpenRouterModelCount | null;
  openRouterEmbeddingModels: OpenRouterEmbeddingModel[];
  openRouterEndpointSummaries: OpenRouterEndpointSummary[];
};

const toPricePerMillion = (value: unknown): number | null => catalogPricePerMillion(value);

async function readPublicCatalog(sourceKey: string) {
  if (!supabase) return null;
  try {
    const {data,error}=await supabase.from('source_snapshot_cache')
      .select('source_key,snapshot_id,content_hash,payload,record_count,fetched_at,published_at,refresh_status,refresh_message')
      .eq('source_key',sourceKey).maybeSingle();
    return error?null:parseCatalogCache(data,sourceKey);
  } catch { return null; }
}
/** Full validated cached catalogs for Compare; no paid-only filter, row cap or upstream request. */
export async function getCompareCatalogSources() {
  const keys=['openrouter','huggingface','litellm'] as const;
  const caches=await Promise.all(keys.map(key=>readPublicCatalog(key)));
  return {openrouter:caches[0]?.records??[],huggingface:caches[1]?.records??[],litellm:caches[2]?.records??[],
    availability:keys.map((key,index)=>catalogReadReceipt(key,caches[index]))};
}
async function fetchHuggingFaceCachedModels(limit: number): Promise<HuggingFaceHubModel[]> {
  const cached=await readPublicCatalog('huggingface');
  return cached?(cached.records as unknown as HuggingFaceHubModel[])
    .sort((a,b)=>Number(b.downloads??0)-Number(a.downloads??0)).slice(0,limit):[];
}

async function fetchLiteLlmCachedModels(limit: number): Promise<LiteLLMCatalogModel[]> {
  const cached=await readPublicCatalog('litellm');
  return cached?(cached.records as unknown as LiteLLMCatalogModel[])
    .sort((a,b)=>Number(b.max_input_tokens??0)-Number(a.max_input_tokens??0)).slice(0,limit):[];
}

async function fetchOpenRouterProviders(): Promise<OpenRouterProvider[]> {
  const response = await fetch('https://openrouter.ai/api/v1/providers', {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter provider fetch failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as { data?: OpenRouterApiProvider[] };
  return (body.data ?? [])
    .map((provider) => {
      const slug = String(provider.slug || '').trim();
      const name = String(provider.name || slug).trim();
      if (!slug || !name) return null;
      return {
        id: slug,
        name,
        slug,
        privacy_policy_url: provider.privacy_policy_url ?? null,
        terms_of_service_url: provider.terms_of_service_url ?? null,
        status_page_url: provider.status_page_url ?? null,
        headquarters: provider.headquarters ?? null,
        datacenters: Array.isArray(provider.datacenters) ? provider.datacenters : [],
        fetched_at: new Date().toISOString(),
      };
    })
    .filter((provider): provider is OpenRouterProvider => provider !== null);
}

async function fetchOpenRouterModelCount(): Promise<OpenRouterModelCount | null> {
  const response = await fetch('https://openrouter.ai/api/v1/models/count', {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter model count fetch failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as { data?: { count?: number } };
  const count = Number(body.data?.count);
  return {
    count: Number.isFinite(count) ? count : null,
    fetched_at: new Date().toISOString(),
  };
}

async function fetchOpenRouterEmbeddingModels(limit: number): Promise<OpenRouterEmbeddingModel[]> {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings/models', {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter embedding model fetch failed with HTTP ${response.status}`);
  }

  const body:unknown = await response.json();
  const fetchedAt=new Date().toISOString();
  return (normalizeEmbeddingCatalog(body) as unknown as Omit<OpenRouterModel,'fetched_at'>[])
    .map((model) => ({
      id: model.id,
      openrouter_id: model.openrouter_id,
      name: model.name,
      author_slug: model.author_slug,
      model_slug: model.model_slug,
      context_length: model.context_length,
      prompt_price_1m: model.prompt_price_1m,
      input_modalities: model.input_modalities,
      output_modalities: model.output_modalities,
      supported_parameters: model.supported_parameters,
      fetched_at: fetchedAt,
    }))
    .slice(0, limit);
}

async function fetchOpenRouterEndpointSummaries(
  models: OpenRouterModel[],
  limit: number,
): Promise<OpenRouterEndpointSummary[]> {
  const candidates = models
    .filter((model) => model.author_slug && model.model_slug)
    .slice(0, limit);
  const summaries = await Promise.allSettled(
    candidates.map(async (model) => {
      const author = encodeURIComponent(model.author_slug || '');
      const slug = encodeURIComponent(model.model_slug || '');
      const response = await fetch(
        `https://openrouter.ai/api/v1/models/${author}/${slug}/endpoints`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`OpenRouter endpoint fetch failed with HTTP ${response.status}`);
      }

      const body = (await response.json()) as { data?: { endpoints?: OpenRouterApiEndpoint[] } };
      const endpoints = body.data?.endpoints ?? [];
      const providers = Array.from(
        new Set(
          endpoints
            .map((endpoint) => endpoint.provider_name || endpoint.name)
            .filter((provider): provider is string => Boolean(provider)),
        ),
      );
      const quantizations = Array.from(
        new Set(
          endpoints
            .map((endpoint) => endpoint.quantization)
            .filter((quantization): quantization is string => Boolean(quantization)),
        ),
      );
      const promptPrices = endpoints
        .map((endpoint) => toPricePerMillion(endpoint.pricing?.prompt))
        .filter((price): price is number => price !== null);
      const completionPrices = endpoints
        .map((endpoint) => toPricePerMillion(endpoint.pricing?.completion))
        .filter((price): price is number => price !== null);
      const contextLengths = endpoints
        .map((endpoint) => Number(endpoint.context_length))
        .filter((context) => Number.isFinite(context) && context > 0);

      return {
        id: model.openrouter_id,
        openrouter_id: model.openrouter_id,
        provider_count: providers.length,
        providers,
        quantizations,
        max_context_length: contextLengths.length ? Math.max(...contextLengths) : null,
        min_prompt_price_1m: promptPrices.length ? Math.min(...promptPrices) : null,
        min_completion_price_1m: completionPrices.length ? Math.min(...completionPrices) : null,
        fetched_at: new Date().toISOString(),
      };
    }),
  );

  return summaries
    .filter((result): result is PromiseFulfilledResult<OpenRouterEndpointSummary> => result.status === 'fulfilled')
    .map((result) => result.value);
}

/**
 * Fetches models from public.aa_models and returns an array with UI-friendly fields.
 * Adds company_name derived from creator_name for the existing UI.
 */
export async function getModels(includeHistory = false, preserveSourceRecords = false): Promise<AaModel[]> {
  if (!supabase) {
    console.warn('[supabase] Client unavailable, returning empty model list.');
    return [];
  }

  const select = AA_MODEL_SELECT_COLUMNS.join(',');

  const data = await fetchAllPages<unknown>((from, to) =>
    supabase
      .from('aa_models')
      .select(select)
      .order('aa_intelligence_index', { ascending: false, nullsFirst: false })
      .range(from, to),
  ).catch((error) => {
    console.error('[supabase] getModels error:', error);
    throw error;
  });

  const cohort = await readAaCohort({
    models: async () => (data ?? []) as AaModel[],
    cache: async () => {
      const result = await supabase.from('source_snapshot_cache').select('source_key,record_count,payload')
        .eq('source_key', 'artificial-analysis').maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
  }, includeHistory);
  const prepared = cohort.map((model) => ({
    ...model,
    company_name: model.creator_name ?? null,
  })) as AaModel[];
  return preserveSourceRecords?sortAaModelsByIntelligence(prepared.map(normalizeAaOperationalMetrics)):normalizeAaModelsForDisplay(prepared);
}

export async function getCanonicalModels(): Promise<CanonicalModelRow[]> {
  if (!supabase) return [];
  return fetchAllPages<CanonicalModelRow>((from, to) =>
    supabase
      .from('canonical_models')
      .select('id,canonical_key,display_name,provider_name,model_family,release_date,metadata,updated_at')
      .order('canonical_key', { ascending: true })
      .range(from, to),
  );
}

export async function getModelAliases(): Promise<ModelAliasRow[]> {
  if (!supabase) return [];
  return fetchAllPages<ModelAliasRow>((from, to) =>
    supabase
      .from('model_aliases')
      .select('canonical_model_id,intelligence_source_id,source_model_key,source_model_name,match_method,provenance,confidence,updated_at')
      .order('canonical_model_id', { ascending: true })
      .range(from, to),
  );
}

export async function getIntelligenceSources(): Promise<IntelligenceSourceRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('intelligence_sources')
    .select('id,source_key,display_name,homepage_url,status,last_successful_run_at')
    .order('source_key', { ascending: true });
  if (error) throw error;
  return (data ?? []) as IntelligenceSourceRow[];
}

/**
 * Fetches epoch.ai models sorted by ECI score
 */
export async function getEpochModels(): Promise<EpochModel[]> {
  if (!supabase) {
    console.warn('[supabase] Client unavailable, returning empty epoch model list.');
    return [];
  }

  try {
    const data = await fetchAllPages<unknown>((from, to) =>
      supabase
        .from('epoch_models')
        .select(
          [
            'id',
            'model_version',
            'model_name',
            'display_name',
            'organization',
            'country',
            'model_accessibility',
            'release_date',
            'eci_score',
            'training_compute_flop',
            'training_compute_confidence',
            'description',
          ].join(','),
        )
        .order('eci_score', { ascending: false, nullsFirst: false })
        .range(from, to),
    );

    return data as EpochModel[];
  } catch (error) {
    console.error('[supabase] getEpochModels error:', error);
    return [];
  }
}

export async function getHydratedEpochModels(
  runs?: EpochBenchmarkRun[],
): Promise<EpochModel[]> {
  const [models, benchmarkRuns] = await Promise.all([
    getEpochModels(),
    runs ? Promise.resolve(runs) : getEpochBenchmarkRuns(),
  ]);

  return hydrateEpochModelsFromRuns(models, benchmarkRuns);
}

export const normalizeAaModelsForDisplay = (models: AaModel[]): AaModel[] =>
  dedupeAaModelsBySlug(
    sortAaModelsByIntelligence(models.map(normalizeAaOperationalMetrics)),
  );

const isMissingOpenRouterTableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === '42P01' ||
    maybeError.message?.includes('relation "public.openrouter_models" does not exist') === true
  );
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return String(error);
};

const OPENROUTER_CACHE_TTL_MS = 15 * 60 * 1000;
const OPENROUTER_DEFAULT_LIMIT = 390;
const HUGGINGFACE_DEFAULT_LIMIT = 700;
const LITELLM_DEFAULT_LIMIT = 2500;
const OPENROUTER_EMBEDDING_DEFAULT_LIMIT = 200;
const OPENROUTER_ENDPOINT_DETAIL_LIMIT = 32;
let openRouterModelsCache:
  | { fetchedAt: number; limit: number; models: OpenRouterModel[] }
  | null = null;
let openRouterModelsPromise: Promise<OpenRouterModel[]> | null = null;
let huggingFaceModelsCache:
  | { fetchedAt: number; limit: number; models: HuggingFaceHubModel[] }
  | null = null;
let huggingFaceModelsPromise: Promise<HuggingFaceHubModel[]> | null = null;
let liteLlmModelsCache:
  | { fetchedAt: number; limit: number; models: LiteLLMCatalogModel[] }
  | null = null;
let liteLlmModelsPromise: Promise<LiteLLMCatalogModel[]> | null = null;
let openRouterProvidersCache:
  | { fetchedAt: number; providers: OpenRouterProvider[] }
  | null = null;
let openRouterProvidersPromise: Promise<OpenRouterProvider[]> | null = null;
let openRouterModelCountCache:
  | { fetchedAt: number; count: OpenRouterModelCount | null }
  | null = null;
let openRouterModelCountPromise: Promise<OpenRouterModelCount | null> | null = null;
let openRouterEmbeddingModelsCache:
  | { fetchedAt: number; limit: number; models: OpenRouterEmbeddingModel[] }
  | null = null;
let openRouterEmbeddingModelsPromise: Promise<OpenRouterEmbeddingModel[]> | null = null;
let openRouterEndpointSummariesCache:
  | { fetchedAt: number; limit: number; summaries: OpenRouterEndpointSummary[] }
  | null = null;
let openRouterEndpointSummariesPromise: Promise<OpenRouterEndpointSummary[]> | null = null;

async function readOpenRouterModels(limit: number): Promise<OpenRouterModel[]> {
  const cached=await readPublicCatalog('openrouter');
  if(cached)return (cached.records as unknown as OpenRouterModel[]).filter(model=>!model.is_free)
    .sort((a,b)=>Number(b.context_length??0)-Number(a.context_length??0)).slice(0,limit);
  if (supabase) {
    const { data, error } = await supabase
      .from('openrouter_models')
      .select(
        [
          'id',
          'openrouter_id',
          'canonical_slug',
          'author_slug',
          'model_slug',
          'name',
          'description',
          'created_unix',
          'context_length',
          'prompt_price_1m',
          'completion_price_1m',
          'request_price',
          'image_price',
          'web_search_price',
          'internal_reasoning_price_1m',
          'input_cache_read_price_1m',
          'input_cache_write_price_1m',
          'is_free',
          'input_modalities',
          'output_modalities',
          'tokenizer',
          'instruct_type',
          'supported_parameters',
          'architecture',
          'pricing',
          'top_provider',
          'fetched_at',
        ].join(','),
      )
      .eq('is_free', false)
      .order('context_length', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (!error && data?.length) {
      return data as unknown as OpenRouterModel[];
    }

    if (error && !isMissingOpenRouterTableError(error)) {
      console.warn('[supabase] OpenRouter catalog is unavailable.', error.message);
    }
  }

  return [];
}

export async function getOpenRouterModels(limit = OPENROUTER_DEFAULT_LIMIT): Promise<OpenRouterModel[]> {
  const sourceLimit = Math.max(limit, OPENROUTER_DEFAULT_LIMIT);
  const now = Date.now();
  if (
    openRouterModelsCache &&
    openRouterModelsCache.limit >= limit &&
    now - openRouterModelsCache.fetchedAt < OPENROUTER_CACHE_TTL_MS
  ) {
    return openRouterModelsCache.models.slice(0, limit);
  }

  openRouterModelsPromise ??= readOpenRouterModels(sourceLimit).then((models) => {
    openRouterModelsCache = {
      fetchedAt: Date.now(),
      limit: sourceLimit,
      models,
    };
    return models;
  }).finally(() => {
    openRouterModelsPromise = null;
  });

  const models = await openRouterModelsPromise;
  return models.slice(0, limit);
}

export async function getHuggingFaceModels(
  limit = HUGGINGFACE_DEFAULT_LIMIT,
): Promise<HuggingFaceHubModel[]> {
  const sourceLimit = Math.max(limit, HUGGINGFACE_DEFAULT_LIMIT);
  const now = Date.now();
  if (
    huggingFaceModelsCache &&
    huggingFaceModelsCache.limit >= limit &&
    now - huggingFaceModelsCache.fetchedAt < OPENROUTER_CACHE_TTL_MS
  ) {
    return huggingFaceModelsCache.models.slice(0, limit);
  }

  huggingFaceModelsPromise ??= fetchHuggingFaceCachedModels(sourceLimit)
    .then((models) => {
      huggingFaceModelsCache = {
        fetchedAt: Date.now(),
        limit: sourceLimit,
        models,
      };
      return models;
    })
    .catch((error) => {
      console.warn('[huggingface] Cached catalog read failed:', error);
      return [];
    })
    .finally(() => {
      huggingFaceModelsPromise = null;
    });

  const models = await huggingFaceModelsPromise;
  return models.slice(0, limit);
}

export async function getLiteLlmModels(
  limit = LITELLM_DEFAULT_LIMIT,
): Promise<LiteLLMCatalogModel[]> {
  const sourceLimit = Math.max(limit, LITELLM_DEFAULT_LIMIT);
  const now = Date.now();
  if (
    liteLlmModelsCache &&
    liteLlmModelsCache.limit >= limit &&
    now - liteLlmModelsCache.fetchedAt < OPENROUTER_CACHE_TTL_MS
  ) {
    return liteLlmModelsCache.models.slice(0, limit);
  }

  liteLlmModelsPromise ??= fetchLiteLlmCachedModels(sourceLimit)
    .then((models) => {
      liteLlmModelsCache = {
        fetchedAt: Date.now(),
        limit: sourceLimit,
        models,
      };
      return models;
    })
    .catch((error) => {
      console.warn('[litellm] Cached catalog read failed:', error);
      return [];
    })
    .finally(() => {
      liteLlmModelsPromise = null;
    });

  const models = await liteLlmModelsPromise;
  return models.slice(0, limit);
}

/** Deprecated weekly wire field: official daily usage has a different contract. */
export async function getOpenRouterUsageRankings():Promise<OpenRouterUsageRanking[]> {return [];}

export async function getOpenRouterProviders(): Promise<OpenRouterProvider[]> {
  const now = Date.now();
  if (
    openRouterProvidersCache &&
    now - openRouterProvidersCache.fetchedAt < OPENROUTER_CACHE_TTL_MS
  ) {
    return openRouterProvidersCache.providers;
  }

  openRouterProvidersPromise ??= fetchOpenRouterProviders()
    .then((providers) => {
      openRouterProvidersCache = {
        fetchedAt: Date.now(),
        providers,
      };
      return providers;
    })
    .catch((error) => {
      console.warn('[openrouter] Public provider fetch failed:', error);
      return [];
    })
    .finally(() => {
      openRouterProvidersPromise = null;
    });

  return openRouterProvidersPromise;
}

export async function getOpenRouterModelCount(): Promise<OpenRouterModelCount | null> {
  const now = Date.now();
  if (
    openRouterModelCountCache &&
    now - openRouterModelCountCache.fetchedAt < OPENROUTER_CACHE_TTL_MS
  ) {
    return openRouterModelCountCache.count;
  }

  openRouterModelCountPromise ??= fetchOpenRouterModelCount()
    .then((count) => {
      openRouterModelCountCache = {
        fetchedAt: Date.now(),
        count,
      };
      return count;
    })
    .catch((error) => {
      console.warn('[openrouter] Public model count fetch failed:', error);
      return null;
    })
    .finally(() => {
      openRouterModelCountPromise = null;
    });

  return openRouterModelCountPromise;
}

export async function getOpenRouterEmbeddingModels(
  limit = OPENROUTER_EMBEDDING_DEFAULT_LIMIT,
): Promise<OpenRouterEmbeddingModel[]> {
  const sourceLimit = Math.max(limit, OPENROUTER_EMBEDDING_DEFAULT_LIMIT);
  const now = Date.now();
  if (
    openRouterEmbeddingModelsCache &&
    openRouterEmbeddingModelsCache.limit >= limit &&
    now - openRouterEmbeddingModelsCache.fetchedAt < OPENROUTER_CACHE_TTL_MS
  ) {
    return openRouterEmbeddingModelsCache.models.slice(0, limit);
  }

  openRouterEmbeddingModelsPromise ??= fetchOpenRouterEmbeddingModels(sourceLimit)
    .then((models) => {
      openRouterEmbeddingModelsCache = {
        fetchedAt: Date.now(),
        limit: sourceLimit,
        models,
      };
      return models;
    })
    .catch((error) => {
      console.warn('[openrouter] Public embedding model fetch failed:', error);
      return openRouterEmbeddingModelsCache?.models ?? [];
    })
    .finally(() => {
      openRouterEmbeddingModelsPromise = null;
    });

  const models = await openRouterEmbeddingModelsPromise;
  return models.slice(0, limit);
}

export async function getOpenRouterEndpointSummaries(
  models: OpenRouterModel[],
  limit = OPENROUTER_ENDPOINT_DETAIL_LIMIT,
): Promise<OpenRouterEndpointSummary[]> {
  const now = Date.now();
  if (
    openRouterEndpointSummariesCache &&
    openRouterEndpointSummariesCache.limit >= limit &&
    now - openRouterEndpointSummariesCache.fetchedAt < OPENROUTER_CACHE_TTL_MS
  ) {
    return openRouterEndpointSummariesCache.summaries.slice(0, limit);
  }

  openRouterEndpointSummariesPromise ??= fetchOpenRouterEndpointSummaries(models, limit)
    .then((summaries) => {
      openRouterEndpointSummariesCache = {
        fetchedAt: Date.now(),
        limit,
        summaries,
      };
      return summaries;
    })
    .catch((error) => {
      console.warn('[openrouter] Public endpoint detail fetch failed:', error);
      return [];
    })
    .finally(() => {
      openRouterEndpointSummariesPromise = null;
    });

  const summaries = await openRouterEndpointSummariesPromise;
  return summaries.slice(0, limit);
}

export async function getPublicCatalogModels(): Promise<PublicCatalogModels> {
  const cached=await getCompareCatalogSources();
  const openRouterModels=cached.openrouter as unknown as OpenRouterModel[];
  const huggingFaceModels=cached.huggingface as unknown as HuggingFaceHubModel[];
  const liteLlmModels=cached.litellm as unknown as LiteLLMCatalogModel[];
  const [
    openRouterUsageRankings,
    openRouterProviders,
    openRouterModelCount,
    openRouterEmbeddingModels,
    openRouterEndpointSummaries,
  ] = await Promise.all([
    getOpenRouterUsageRankings(),
    getOpenRouterProviders(),
    getOpenRouterModelCount(),
    getOpenRouterEmbeddingModels(),
    getOpenRouterEndpointSummaries(openRouterModels),
  ]);

  return {
    openRouterModels,
    huggingFaceModels,
    liteLlmModels,
    openRouterUsageRankings,
    openRouterProviders,
    openRouterModelCount,
    openRouterEmbeddingModels,
    openRouterEndpointSummaries,
  };
}

export async function getVerifiedCatalogBindings(models:AaModel[]):Promise<VerifiedBindings>{
 const [completeModels,aliases,sources]=await Promise.all([getModels(true,true),getModelAliases(),getIntelligenceSources()]);
 const bindings=buildVerifiedBindings(completeModels,aliases,sources);
 return Object.fromEntries(models.filter(model=>Object.hasOwn(bindings,model.id)).map(model=>[model.id,bindings[model.id]]));
}

/** No name-based cross-source enrichment. Missing reviewed bindings leave details unknown. */
export function enrichModelsWithPublicCatalogData(models:AaModel[],catalogs:PublicCatalogModels,bindings:VerifiedBindings={}):AaModel[]{
 return enrichVerifiedCatalog(models,catalogs,bindings);
}

/**
 * Fetches all epoch.ai benchmark definitions
 */
export async function getEpochBenchmarks(): Promise<EpochBenchmark[]> {
  if (!supabase) {
    console.warn('[supabase] Client unavailable, returning empty epoch benchmark list.');
    return [];
  }

  try {
    const data = await fetchAllPages<unknown>((from, to) =>
      supabase
        .from('epoch_benchmarks')
        .select('id,slug,name,description,source')
        .order('name')
        .range(from, to),
    );
    return data as EpochBenchmark[];
  } catch (error) {
    console.error('[supabase] getEpochBenchmarks error:', error);
    return [];
  }
}

/**
 * Fetches epoch.ai benchmark runs with benchmark names
 */
export async function getEpochBenchmarkRuns(): Promise<EpochBenchmarkRun[]> {
  if (!supabase) {
    console.warn('[supabase] Client unavailable, returning empty epoch benchmark runs.');
    return [];
  }

  const extendedSelect = `
    id,
    model_version,
    benchmark_id,
    score,
    release_date,
    organization,
    country,
    stderr,
    score_metric,
    source_name,
    source_link,
    epoch_benchmarks (
      name,
      slug
    )
  `;
  const basicSelect = `
    id,
    model_version,
    benchmark_id,
    score,
    release_date,
    organization,
    country,
    stderr,
    epoch_benchmarks (
      name,
      slug
    )
  `;

  const readRuns = (select: string) =>
    fetchAllPages<unknown>((from, to) =>
      supabase
        .from('epoch_benchmark_runs')
        .select(select)
        .order('score', { ascending: false, nullsFirst: false })
        .range(from, to),
    );

  try {
    let data: unknown[];
    try {
      data = await readRuns(extendedSelect);
    } catch (error) {
      const message = getErrorMessage(error);
      if (!message.includes('score_metric') && !message.includes('source_name')) {
        throw error;
      }
      data = await readRuns(basicSelect);
    }

    // Flatten nested benchmark data.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((run: any) => ({
      ...run,
      benchmark_name: run.epoch_benchmarks?.name ?? null,
      benchmark_slug: run.epoch_benchmarks?.slug ?? null,
    })) as EpochBenchmarkRun[];
  } catch (error) {
    console.error('[supabase] getEpochBenchmarkRuns error:', error);
    return [];
  }
}

/**
 * Gets top models for a specific epoch benchmark
 */
export async function getTopModelsByEpochBenchmark(
  benchmarkSlug: string,
  limit = 10,
): Promise<EpochBenchmarkRun[]> {
  if (!supabase) {
    console.warn('[supabase] Client unavailable, returning empty top-model query result.');
    return [];
  }

  const { data, error } = await supabase
    .from('epoch_benchmark_runs')
    .select(`
      id,
      model_version,
      benchmark_id,
      score,
      release_date,
      organization,
      country,
      stderr,
      epoch_benchmarks!inner (
        name,
        slug
      )
    `)
    .eq('epoch_benchmarks.slug', benchmarkSlug)
    .not('score', 'is', null)
    .order('score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[supabase] getTopModelsByEpochBenchmark error:', error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((run: any) => ({
    ...run,
    benchmark_name: run.epoch_benchmarks?.name ?? null,
    benchmark_slug: run.epoch_benchmarks?.slug ?? null,
  })) as EpochBenchmarkRun[];
}
