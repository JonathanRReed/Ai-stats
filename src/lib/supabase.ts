import { createClient } from '@supabase/supabase-js';

// Public client for server-side fetching (Astro on the server).
// Uses anon key; RLS allows read on public.aa_models.
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[supabase] Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

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
  // Select only required columns to minimize payload size
  const select = [
    'id',
    'name',
    'creator_name',
    'aa_intelligence_index',
    'aa_coding_index',
    'aa_math_index',
    'mmlu_pro',
    'gpqa',
    'hle',
    'livecodebench',
    'scicode',
    'math_500',
    'aime',
    'price_1m_blended_3_to_1',
    'price_1m_input_tokens',
    'price_1m_output_tokens',
    'median_output_tokens_per_second',
    'median_time_to_first_token_seconds',
    'median_time_to_first_answer_token',
  ].join(',');

  const { data, error } = await supabase
    .from('aa_models')
    .select(select)
    .order('aa_intelligence_index', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[supabase] getModels error:', error);
    throw error;
  }

  // Map and add derived fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const models = (data ?? []).map((model: any) => ({
    ...model,
    company_name: model.creator_name ?? null,
  })) as AaModel[];

  return models;
}
