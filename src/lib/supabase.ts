import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AA_MODEL_SELECT_COLUMNS } from './aa-model-columns';

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
  id: number;
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
  id: number;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  source_url: string | null;
};

export type EpochBenchmarkRun = {
  id: number;
  model_version: string;
  benchmark_id: number;
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
};

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
  return (data ?? []).map((model: any) => ({
    ...model,
    company_name: model.creator_name ?? null,
  })) as AaModel[];
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
    .select('*')
    .order('eci_score', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[supabase] getEpochModels error:', error);
    return [];
  }

  return (data ?? []) as EpochModel[];
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
    .select('*')
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
