import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AA_MODEL_SELECT_COLUMNS } from './aa-model-columns';
import {
  dedupeAaModelsBySlug,
  hydrateEpochModelsFromRuns,
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
  id: string;
  model_version: string;
  benchmark_id: string;
  score: number | null;
  release_date: string | null;
  organization: string | null;
  country: string | null;
  stderr: number | null;
  benchmark_name?: string;
  benchmark_slug?: string;
};

export type AaModel = {
  id: string;
  name: string | null;
  slug: string | null;
  creator_id: string | null;
  creator_name: string | null;
  creator_slug: string | null;
  evaluations: Record<string, unknown> | null;
  aa_intelligence_index: number | null;
  aa_coding_index: number | null;
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

type OpenRouterApiModel = {
  id?: string;
  canonical_slug?: string;
  name?: string;
  description?: string;
  created?: number;
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string;
  };
  pricing?: Record<string, string | number | null | undefined>;
  top_provider?: Record<string, unknown> | null;
  supported_parameters?: string[];
};

const toPricePerMillion = (value: unknown): number | null => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num * 1_000_000;
};

const toPriceValue = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const splitOpenRouterId = (id: string): { author: string | null; slug: string | null } => {
  const [author, ...rest] = id.split('/');
  return {
    author: author || null,
    slug: rest.join('/') || null,
  };
};

const normalizeModelLookupKey = (value: string | null | undefined): string => {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/^(openai|anthropic|google|meta|mistral|moonshotai|moonshot|alibaba|qwen|xai|deepseek|minimax|nvidia|cohere|perplexity):\s*/i, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/:free$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const normalizeOpenRouterModel = (model: OpenRouterApiModel): OpenRouterModel | null => {
  const openrouterId = String(model.id ?? '').trim();
  if (!openrouterId) return null;
  const { author, slug } = splitOpenRouterId(openrouterId);
  const pricing = model.pricing ?? {};
  const promptPrice = toPricePerMillion(pricing.prompt);
  const completionPrice = toPricePerMillion(pricing.completion);
  const now = new Date().toISOString();

  return {
    id: openrouterId,
    openrouter_id: openrouterId,
    canonical_slug: model.canonical_slug ?? null,
    author_slug: author,
    model_slug: slug,
    name: String(model.name || openrouterId),
    description: model.description ?? null,
    created_unix: Number.isFinite(Number(model.created)) ? Number(model.created) : null,
    context_length: Number.isFinite(Number(model.context_length))
      ? Number(model.context_length)
      : null,
    prompt_price_1m: promptPrice,
    completion_price_1m: completionPrice,
    request_price: toPriceValue(pricing.request),
    image_price: toPriceValue(pricing.image),
    web_search_price: toPriceValue(pricing.web_search),
    internal_reasoning_price_1m: toPricePerMillion(pricing.internal_reasoning),
    input_cache_read_price_1m: toPricePerMillion(pricing.input_cache_read),
    input_cache_write_price_1m: toPricePerMillion(pricing.input_cache_write),
    is_free:
      openrouterId.endsWith(':free') ||
      ((promptPrice ?? 0) === 0 && (completionPrice ?? 0) === 0),
    input_modalities: model.architecture?.input_modalities ?? [],
    output_modalities: model.architecture?.output_modalities ?? [],
    tokenizer: model.architecture?.tokenizer ?? null,
    instruct_type: model.architecture?.instruct_type ?? null,
    supported_parameters: model.supported_parameters ?? [],
    architecture: (model.architecture as Record<string, unknown>) ?? {},
    pricing: pricing as Record<string, unknown>,
    top_provider: model.top_provider ?? null,
    fetched_at: now,
  };
};

async function fetchOpenRouterPublicModels(limit: number): Promise<OpenRouterModel[]> {
  const response = await fetch(
    'https://openrouter.ai/api/v1/models?output_modalities=all',
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`OpenRouter model fetch failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as { data?: OpenRouterApiModel[] };
  return (body.data ?? [])
    .map(normalizeOpenRouterModel)
    .filter((model): model is OpenRouterModel => model !== null)
    .filter((model) => !model.is_free)
    .sort((a, b) => Number(b.context_length ?? 0) - Number(a.context_length ?? 0))
    .slice(0, limit);
}

/**
 * Fetches models from public.aa_models and returns an array with UI-friendly fields.
 * Adds company_name derived from creator_name for the existing UI.
 */
export async function getModels(): Promise<AaModel[]> {
  if (!supabase) {
    console.warn('[supabase] Client unavailable, returning empty model list.');
    return [];
  }

  const select = AA_MODEL_SELECT_COLUMNS.join(',');

  const { data, error } = await supabase
    .from('aa_models')
    .select(select)
    .order('aa_intelligence_index', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[supabase] getModels error:', error);
    throw error;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return dedupeAaModelsBySlug((data ?? []).map((model: any) => ({
    ...model,
    company_name: model.creator_name ?? null,
  })) as AaModel[]);
}

/**
 * Fetches epoch.ai models sorted by ECI score
 */
export async function getEpochModels(): Promise<EpochModel[]> {
  if (!supabase) {
    console.warn('[supabase] Client unavailable, returning empty epoch model list.');
    return [];
  }

  const { data, error } = await supabase
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
    .order('eci_score', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[supabase] getEpochModels error:', error);
    return [];
  }

  return (data ?? []) as unknown as EpochModel[];
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
  dedupeAaModelsBySlug(sortAaModelsByIntelligence(models));

const isMissingOpenRouterTableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === '42P01' ||
    maybeError.message?.includes('relation "public.openrouter_models" does not exist') === true
  );
};

const OPENROUTER_CACHE_TTL_MS = 15 * 60 * 1000;
const OPENROUTER_DEFAULT_LIMIT = 390;
let openRouterModelsCache:
  | { fetchedAt: number; limit: number; models: OpenRouterModel[] }
  | null = null;
let openRouterModelsPromise: Promise<OpenRouterModel[]> | null = null;

async function readOpenRouterModels(limit: number): Promise<OpenRouterModel[]> {
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
      console.warn('[supabase] OpenRouter table unavailable; using public API fallback.', error.message);
    }
  }

  try {
    return await fetchOpenRouterPublicModels(limit);
  } catch (error) {
    console.warn('[openrouter] Public model fallback failed:', error);
    return [];
  }
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

const buildOpenRouterLookupKeys = (model: OpenRouterModel): string[] => {
  const candidates = [
    model.openrouter_id,
    model.openrouter_id.split('/').slice(1).join('/'),
    model.canonical_slug,
    model.model_slug,
    model.name,
    model.name.includes(':') ? model.name.split(':').slice(1).join(':') : model.name,
  ];

  return Array.from(
    new Set(
      candidates
        .flatMap((candidate) => {
          const normalized = normalizeModelLookupKey(candidate);
          return normalized ? [normalized, normalized.replace(/\s+/g, '')] : [];
        })
        .filter(Boolean),
    ),
  );
};

const buildAaLookupKeys = (model: AaModel): string[] => {
  const candidates = [
    model.slug,
    model.name,
    model.name?.replace(/\([^)]*\)/g, ''),
    model.company_name && model.name ? `${model.company_name} ${model.name}` : null,
    model.creator_slug && model.slug ? `${model.creator_slug} ${model.slug}` : null,
  ];

  return Array.from(
    new Set(
      candidates
        .flatMap((candidate) => {
          const normalized = normalizeModelLookupKey(candidate);
          return normalized ? [normalized, normalized.replace(/\s+/g, '')] : [];
        })
        .filter(Boolean),
    ),
  );
};

export function enrichModelsWithOpenRouterData(
  models: AaModel[],
  openRouterModels: OpenRouterModel[],
): AaModel[] {
  if (!openRouterModels.length) return models;

  const lookup = new Map<string, OpenRouterModel>();
  openRouterModels.forEach((openRouterModel) => {
    buildOpenRouterLookupKeys(openRouterModel).forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, openRouterModel);
    });
  });

  return models.map((model) => {
    const match = buildAaLookupKeys(model)
      .map((key) => lookup.get(key))
      .find((candidate): candidate is OpenRouterModel => Boolean(candidate));

    if (!match) return model;

    return {
      ...model,
      openrouter_id: match.openrouter_id,
      openrouter_name: match.name,
      openrouter_context_length: match.context_length,
      openrouter_prompt_price_1m: match.prompt_price_1m,
      openrouter_completion_price_1m: match.completion_price_1m,
      openrouter_supported_parameters: match.supported_parameters,
      openrouter_input_modalities: match.input_modalities,
      openrouter_output_modalities: match.output_modalities,
      openrouter_is_free: match.is_free,
    };
  });
}

/**
 * Fetches all epoch.ai benchmark definitions
 */
export async function getEpochBenchmarks(): Promise<EpochBenchmark[]> {
  if (!supabase) {
    console.warn('[supabase] Client unavailable, returning empty epoch benchmark list.');
    return [];
  }

  const { data, error } = await supabase
    .from('epoch_benchmarks')
    .select('id,slug,name,description,source')
    .order('name');

  if (error) {
    console.error('[supabase] getEpochBenchmarks error:', error);
    return [];
  }

  return (data ?? []) as EpochBenchmark[];
}

/**
 * Fetches epoch.ai benchmark runs with benchmark names
 */
export async function getEpochBenchmarkRuns(): Promise<EpochBenchmarkRun[]> {
  if (!supabase) {
    console.warn('[supabase] Client unavailable, returning empty epoch benchmark runs.');
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
      epoch_benchmarks (
        name,
        slug
      )
    `)
    .order('score', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[supabase] getEpochBenchmarkRuns error:', error);
    return [];
  }

  // Flatten nested benchmark data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((run: any) => ({
    ...run,
    benchmark_name: run.epoch_benchmarks?.name ?? null,
    benchmark_slug: run.epoch_benchmarks?.slug ?? null,
  })) as EpochBenchmarkRun[];
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
