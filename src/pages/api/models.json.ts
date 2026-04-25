import type { APIRoute } from 'astro';
import {
  AA_MODEL_SELECT_COLUMNS,
  enrichModelsWithPublicCatalogData,
  getPublicCatalogModels,
  normalizeAaModelsForDisplay,
  supabase,
  type AaModel,
} from '../../lib/supabase';

const SEARCH_MAX_LENGTH = 80;
const BENCHMARK_COLUMNS = new Set<keyof AaModel>([
  'mmlu_pro',
  'gpqa',
  'hle',
  'aime',
  'livecodebench',
  'scicode',
  'math_500',
  'aa_intelligence_index',
  'aa_coding_index',
  'aa_math_index',
]);

const sanitizeSearchTerm = (value: string | null): string => {
  return (value ?? '')
    .trim()
    .replace(/[%_*]/g, '')
    .slice(0, SEARCH_MAX_LENGTH);
};

export const GET: APIRoute = async ({ url }) => {
  const searchParams = url.searchParams;
  const search = sanitizeSearchTerm(searchParams.get('search'));
  const benchmark = searchParams.get('benchmark');

  try {
    if (!supabase) {
      throw new Error('Supabase client unavailable');
    }

    let query = supabase
      .from('aa_models')
      .select(AA_MODEL_SELECT_COLUMNS.join(','))
      .order('aa_intelligence_index', { ascending: false, nullsFirst: false });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (benchmark && BENCHMARK_COLUMNS.has(benchmark as keyof AaModel)) {
      query = query.not(benchmark, 'is', null);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const publicCatalogs = await getPublicCatalogModels();
    const models = enrichModelsWithPublicCatalogData(
      normalizeAaModelsForDisplay((data ?? []) as unknown as AaModel[]),
      publicCatalogs,
    );
    const filteredModels = models.map((model) => ({
      ...model,
      company_name: model.creator_name ?? null,
    }));

    return new Response(JSON.stringify(filteredModels), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch models' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
