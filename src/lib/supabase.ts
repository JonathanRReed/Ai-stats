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

type HuggingFaceApiModel = {
  id?: string;
  modelId?: string;
  author?: string;
  downloads?: number;
  likes?: number;
  pipeline_tag?: string;
  library_name?: string;
  lastModified?: string;
  tags?: string[];
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

type LiteLLMPriceEntry = {
  litellm_provider?: string;
  mode?: string;
  max_input_tokens?: number | string;
  max_output_tokens?: number | string;
  max_tokens?: number | string;
  input_cost_per_token?: number | string;
  output_cost_per_token?: number | string;
  supports_vision?: boolean;
  supports_function_calling?: boolean;
  supports_reasoning?: boolean;
  supports_prompt_caching?: boolean;
  supports_system_messages?: boolean;
  supports_web_search?: boolean;
};

type OpenRouterRankingRow = {
  date?: string;
  model_permaslug?: string;
  variant?: string;
  variant_permaslug?: string;
  total_completion_tokens?: number;
  total_prompt_tokens?: number;
  total_native_tokens_reasoning?: number;
  count?: number;
  total_tool_calls?: number;
  requests_with_tool_call_errors?: number;
  change?: number | null;
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

const toPricePerMillion = (value: unknown): number | null => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num * 1_000_000;
};

const toPositiveNumber = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
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

const normalizeHuggingFaceModel = (model: HuggingFaceApiModel): HuggingFaceHubModel | null => {
  const modelId = String(model.modelId || model.id || '').trim();
  if (!modelId) return null;
  const [author] = modelId.split('/');

  return {
    id: modelId,
    model_id: modelId,
    author: model.author || author || null,
    downloads: toPositiveNumber(model.downloads),
    likes: toPositiveNumber(model.likes),
    pipeline_tag: model.pipeline_tag ?? null,
    library_name: model.library_name ?? null,
    last_modified: model.lastModified ?? null,
    tags: Array.isArray(model.tags) ? model.tags : [],
    fetched_at: new Date().toISOString(),
  };
};

async function fetchHuggingFacePublicModels(limit: number): Promise<HuggingFaceHubModel[]> {
  const response = await fetch(
    `https://huggingface.co/api/models?sort=downloads&direction=-1&limit=${limit}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Hugging Face model fetch failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as HuggingFaceApiModel[];
  return (Array.isArray(body) ? body : [])
    .map(normalizeHuggingFaceModel)
    .filter((model): model is HuggingFaceHubModel => model !== null);
}

const normalizeLiteLlmModel = (
  modelId: string,
  entry: LiteLLMPriceEntry,
): LiteLLMCatalogModel | null => {
  if (!modelId || modelId === 'sample_spec') return null;
  const mode = entry.mode ?? null;
  if (mode && !['chat', 'completion', 'responses'].includes(mode)) return null;
  const inputPrice = toPricePerMillion(entry.input_cost_per_token);
  const outputPrice = toPricePerMillion(entry.output_cost_per_token);

  return {
    id: modelId,
    model_id: modelId,
    provider: entry.litellm_provider ?? null,
    mode,
    max_input_tokens: toPositiveNumber(entry.max_input_tokens) ?? toPositiveNumber(entry.max_tokens),
    max_output_tokens: toPositiveNumber(entry.max_output_tokens),
    input_price_1m: inputPrice,
    output_price_1m: outputPrice,
    supports_vision: entry.supports_vision === true,
    supports_function_calling: entry.supports_function_calling === true,
    supports_reasoning: entry.supports_reasoning === true,
    supports_prompt_caching: entry.supports_prompt_caching === true,
    supports_system_messages: entry.supports_system_messages !== false,
    supports_web_search: entry.supports_web_search === true,
    fetched_at: new Date().toISOString(),
  };
};

async function fetchLiteLlmPublicModels(limit: number): Promise<LiteLLMCatalogModel[]> {
  const response = await fetch(
    'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`LiteLLM catalog fetch failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as Record<string, LiteLLMPriceEntry>;
  return Object.entries(body)
    .map(([modelId, entry]) => normalizeLiteLlmModel(modelId, entry))
    .filter((model): model is LiteLLMCatalogModel => model !== null)
    .sort((a, b) => Number(b.max_input_tokens ?? 0) - Number(a.max_input_tokens ?? 0))
    .slice(0, limit);
}

const extractJsonArrayAfterKey = (text: string, key: string): string | null => {
  const keyIndex = text.indexOf(key);
  if (keyIndex < 0) return null;
  const start = text.indexOf('[', keyIndex + key.length);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
};

const extractNextFlightText = (html: string): string => {
  const chunks = html.matchAll(/self\.__next_f\.push\((.*?)\)<\/script>/gs);
  let result = '';
  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(chunk[1]) as unknown[];
      if (typeof parsed[1] === 'string') result += parsed[1];
    } catch {
      // Ignore chunks that are not plain JSON push payloads.
    }
  }
  return result;
};

async function fetchOpenRouterUsageRankings(limit: number): Promise<OpenRouterUsageRanking[]> {
  const response = await fetch('https://openrouter.ai/rankings/', {
    headers: {
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter rankings fetch failed with HTTP ${response.status}`);
  }

  const html = await response.text();
  const flightText = extractNextFlightText(html);
  const rankingJson = extractJsonArrayAfterKey(flightText, 'rankingData":');
  if (!rankingJson) return [];

  const rows = JSON.parse(rankingJson) as OpenRouterRankingRow[];
  const normalized = rows
    .map((row) => {
      const modelPermaslug = String(row.model_permaslug || '').trim();
      if (!modelPermaslug) return null;
      const totalTokens =
        Number(row.total_prompt_tokens || 0) +
        Number(row.total_completion_tokens || 0) +
        Number(row.total_native_tokens_reasoning || 0);
      return {
        row,
        modelPermaslug,
        totalTokens,
      };
    })
    .filter(
      (
        row,
      ): row is {
        row: OpenRouterRankingRow;
        modelPermaslug: string;
        totalTokens: number;
      } => row !== null && row.totalTokens > 0,
    )
    .sort((a, b) => b.totalTokens - a.totalTokens);

  const totalAllTokens = normalized.reduce((sum, item) => sum + item.totalTokens, 0);
  return normalized.slice(0, limit).map((item, index) => {
    const variantPermaslug =
      item.row.variant_permaslug ||
      (item.row.variant && item.row.variant !== 'standard'
        ? `${item.modelPermaslug}:${item.row.variant}`
        : item.modelPermaslug);
    return {
      id: variantPermaslug,
      model_permaslug: item.modelPermaslug,
      variant_permaslug: variantPermaslug,
      provider: item.modelPermaslug.split('/')[0] || null,
      variant: item.row.variant ?? null,
      rank: index + 1,
      total_tokens: item.totalTokens,
      request_count: Number(item.row.count || 0),
      tool_calls: Number(item.row.total_tool_calls || 0),
      tool_call_errors: Number(item.row.requests_with_tool_call_errors || 0),
      usage_share: totalAllTokens > 0 ? item.totalTokens / totalAllTokens : null,
      change: typeof item.row.change === 'number' ? item.row.change : null,
      date: item.row.date ?? null,
      fetched_at: new Date().toISOString(),
    };
  });
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

  const body = (await response.json()) as { data?: OpenRouterApiModel[] };
  return (body.data ?? [])
    .map(normalizeOpenRouterModel)
    .filter((model): model is OpenRouterModel => model !== null)
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
      fetched_at: model.fetched_at,
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
export async function getModels(): Promise<AaModel[]> {
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
  dedupeAaModelsBySlug(sortAaModelsByIntelligence(models));

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
const OPENROUTER_USAGE_DEFAULT_LIMIT = 500;
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
let openRouterUsageCache:
  | { fetchedAt: number; limit: number; rankings: OpenRouterUsageRanking[] }
  | null = null;
let openRouterUsagePromise: Promise<OpenRouterUsageRanking[]> | null = null;
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

  huggingFaceModelsPromise ??= fetchHuggingFacePublicModels(sourceLimit)
    .then((models) => {
      huggingFaceModelsCache = {
        fetchedAt: Date.now(),
        limit: sourceLimit,
        models,
      };
      return models;
    })
    .catch((error) => {
      console.warn('[huggingface] Public model fallback failed:', error);
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

  liteLlmModelsPromise ??= fetchLiteLlmPublicModels(sourceLimit)
    .then((models) => {
      liteLlmModelsCache = {
        fetchedAt: Date.now(),
        limit: sourceLimit,
        models,
      };
      return models;
    })
    .catch((error) => {
      console.warn('[litellm] Public model catalog failed:', error);
      return [];
    })
    .finally(() => {
      liteLlmModelsPromise = null;
    });

  const models = await liteLlmModelsPromise;
  return models.slice(0, limit);
}

export async function getOpenRouterUsageRankings(
  limit = OPENROUTER_USAGE_DEFAULT_LIMIT,
): Promise<OpenRouterUsageRanking[]> {
  const sourceLimit = Math.max(limit, OPENROUTER_USAGE_DEFAULT_LIMIT);
  const now = Date.now();
  if (
    openRouterUsageCache &&
    openRouterUsageCache.limit >= limit &&
    now - openRouterUsageCache.fetchedAt < OPENROUTER_CACHE_TTL_MS
  ) {
    return openRouterUsageCache.rankings.slice(0, limit);
  }

  openRouterUsagePromise ??= fetchOpenRouterUsageRankings(sourceLimit)
    .then((rankings) => {
      openRouterUsageCache = {
        fetchedAt: Date.now(),
        limit: sourceLimit,
        rankings,
      };
      return rankings;
    })
    .catch((error) => {
      console.warn('[openrouter] Public rankings fetch failed:', error);
      return [];
    })
    .finally(() => {
      openRouterUsagePromise = null;
    });

  const rankings = await openRouterUsagePromise;
  return rankings.slice(0, limit);
}

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
      return [];
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
  const [openRouterModels, huggingFaceModels, liteLlmModels] = await Promise.all([
    getOpenRouterModels(),
    getHuggingFaceModels(),
    getLiteLlmModels(),
  ]);
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

const buildHuggingFaceLookupKeys = (model: HuggingFaceHubModel): string[] => {
  const idParts = model.model_id.split('/');
  const slug = idParts.slice(1).join('/');
  const candidates = [
    model.model_id,
    slug,
    slug.replace(/-/g, ' '),
    model.author && slug ? `${model.author} ${slug}` : null,
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

const buildLiteLlmLookupKeys = (model: LiteLLMCatalogModel): string[] => {
  const withoutProvider = model.model_id.includes('/')
    ? model.model_id.split('/').slice(1).join('/')
    : model.model_id;
  const candidates = [
    model.model_id,
    withoutProvider,
    withoutProvider.replace(/-/g, ' '),
    model.provider && withoutProvider ? `${model.provider} ${withoutProvider}` : null,
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

const buildOpenRouterUsageLookupKeys = (ranking: OpenRouterUsageRanking): string[] => {
  const withoutProvider = ranking.model_permaslug.includes('/')
    ? ranking.model_permaslug.split('/').slice(1).join('/')
    : ranking.model_permaslug;
  const withoutDateSuffix = withoutProvider.replace(/-\d{8}$/g, '');
  const candidates = [
    ranking.model_permaslug,
    ranking.variant_permaslug,
    withoutProvider,
    withoutProvider.replace(/-/g, ' '),
    withoutDateSuffix,
    withoutDateSuffix.replace(/-/g, ' '),
    ranking.provider && withoutProvider ? `${ranking.provider} ${withoutProvider}` : null,
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

export function enrichModelsWithPublicCatalogData(
  models: AaModel[],
  catalogs: PublicCatalogModels,
): AaModel[] {
  const openRouterEnriched = enrichModelsWithOpenRouterData(
    models,
    catalogs.openRouterModels,
  );

  const huggingFaceLookup = new Map<string, HuggingFaceHubModel>();
  catalogs.huggingFaceModels.forEach((huggingFaceModel) => {
    buildHuggingFaceLookupKeys(huggingFaceModel).forEach((key) => {
      if (!huggingFaceLookup.has(key)) huggingFaceLookup.set(key, huggingFaceModel);
    });
  });

  const liteLlmLookup = new Map<string, LiteLLMCatalogModel>();
  catalogs.liteLlmModels.forEach((liteLlmModel) => {
    buildLiteLlmLookupKeys(liteLlmModel).forEach((key) => {
      if (!liteLlmLookup.has(key)) liteLlmLookup.set(key, liteLlmModel);
    });
  });
  const openRouterUsageLookup = new Map<string, OpenRouterUsageRanking>();
  catalogs.openRouterUsageRankings.forEach((usageRanking) => {
    buildOpenRouterUsageLookupKeys(usageRanking).forEach((key) => {
      if (!openRouterUsageLookup.has(key)) openRouterUsageLookup.set(key, usageRanking);
    });
  });
  const openRouterEndpointLookup = new Map<string, OpenRouterEndpointSummary>();
  catalogs.openRouterEndpointSummaries.forEach((summary) => {
    const normalized = normalizeModelLookupKey(summary.openrouter_id);
    if (normalized) {
      openRouterEndpointLookup.set(normalized, summary);
      openRouterEndpointLookup.set(normalized.replace(/\s+/g, ''), summary);
    }
  });

  return openRouterEnriched.map((model) => {
    const keys = buildAaLookupKeys(model);
    const huggingFaceMatch = keys
      .map((key) => huggingFaceLookup.get(key))
      .find((candidate): candidate is HuggingFaceHubModel => Boolean(candidate));
    const liteLlmMatch = keys
      .map((key) => liteLlmLookup.get(key))
      .find((candidate): candidate is LiteLLMCatalogModel => Boolean(candidate));
    const openRouterUsageMatch = keys
      .map((key) => openRouterUsageLookup.get(key))
      .find((candidate): candidate is OpenRouterUsageRanking => Boolean(candidate));
    const endpointKeys = [
      model.openrouter_id,
      model.openrouter_id?.split('/').slice(1).join('/'),
      ...keys,
    ]
      .flatMap((candidate) => {
        const normalized = normalizeModelLookupKey(candidate);
        return normalized ? [normalized, normalized.replace(/\s+/g, '')] : [];
      });
    const openRouterEndpointMatch = endpointKeys
      .map((key) => openRouterEndpointLookup.get(key))
      .find((candidate): candidate is OpenRouterEndpointSummary => Boolean(candidate));

    return {
      ...model,
      ...(openRouterEndpointMatch
        ? {
            openrouter_endpoint_provider_count: openRouterEndpointMatch.provider_count,
            openrouter_endpoint_providers: openRouterEndpointMatch.providers,
            openrouter_endpoint_quantizations: openRouterEndpointMatch.quantizations,
            openrouter_endpoint_min_prompt_price_1m:
              openRouterEndpointMatch.min_prompt_price_1m,
            openrouter_endpoint_min_completion_price_1m:
              openRouterEndpointMatch.min_completion_price_1m,
          }
        : {}),
      ...(openRouterUsageMatch
        ? {
            openrouter_usage_rank: openRouterUsageMatch.rank,
            openrouter_usage_tokens: openRouterUsageMatch.total_tokens,
            openrouter_usage_requests: openRouterUsageMatch.request_count,
            openrouter_usage_share: openRouterUsageMatch.usage_share,
            openrouter_usage_variant: openRouterUsageMatch.variant,
            openrouter_usage_change: openRouterUsageMatch.change,
          }
        : {}),
      ...(huggingFaceMatch
        ? {
            hf_model_id: huggingFaceMatch.model_id,
            hf_author: huggingFaceMatch.author,
            hf_downloads: huggingFaceMatch.downloads,
            hf_likes: huggingFaceMatch.likes,
            hf_pipeline_tag: huggingFaceMatch.pipeline_tag,
            hf_library_name: huggingFaceMatch.library_name,
            hf_last_modified: huggingFaceMatch.last_modified,
            hf_tags: huggingFaceMatch.tags,
          }
        : {}),
      ...(liteLlmMatch
        ? {
            litellm_model_id: liteLlmMatch.model_id,
            litellm_provider: liteLlmMatch.provider,
            litellm_mode: liteLlmMatch.mode,
            litellm_max_input_tokens: liteLlmMatch.max_input_tokens,
            litellm_max_output_tokens: liteLlmMatch.max_output_tokens,
            litellm_input_price_1m: liteLlmMatch.input_price_1m,
            litellm_output_price_1m: liteLlmMatch.output_price_1m,
            litellm_supports_vision: liteLlmMatch.supports_vision,
            litellm_supports_function_calling: liteLlmMatch.supports_function_calling,
            litellm_supports_reasoning: liteLlmMatch.supports_reasoning,
            litellm_supports_prompt_caching: liteLlmMatch.supports_prompt_caching,
            litellm_supports_system_messages: liteLlmMatch.supports_system_messages,
            litellm_supports_web_search: liteLlmMatch.supports_web_search,
          }
        : {}),
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
