import type { AaModel, EpochBenchmark, EpochBenchmarkRun } from './supabase';

type FetchOpts = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  includeEpoch?: boolean;
};

export type LiveSnapshot = {
  aaModels: AaModel[];
  epochBenchmarks: EpochBenchmark[];
  epochRuns: EpochBenchmarkRun[];
};

const CLIENT_AA_MODEL_SELECT_COLUMNS = [
  'id',
  'name',
  'slug',
  'creator_id',
  'creator_name',
  'creator_slug',
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
  'first_seen',
  'last_seen',
] as const;

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toStringOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const toStringOrEmpty = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const normalizeAaModel = (row: Record<string, unknown>): AaModel => ({
  id: toStringOrEmpty(row.id),
  name: toStringOrNull(row.name),
  slug: toStringOrNull(row.slug),
  creator_id: toStringOrNull(row.creator_id),
  creator_name: toStringOrNull(row.creator_name),
  creator_slug: toStringOrNull(row.creator_slug),
  evaluations: (row.evaluations as Record<string, unknown> | null) ?? null,
  aa_intelligence_index: toNumberOrNull(row.aa_intelligence_index),
  aa_coding_index: toNumberOrNull(row.aa_coding_index),
  aa_math_index: toNumberOrNull(row.aa_math_index),
  mmlu_pro: toNumberOrNull(row.mmlu_pro),
  gpqa: toNumberOrNull(row.gpqa),
  hle: toNumberOrNull(row.hle),
  livecodebench: toNumberOrNull(row.livecodebench),
  scicode: toNumberOrNull(row.scicode),
  math_500: toNumberOrNull(row.math_500),
  aime: toNumberOrNull(row.aime),
  pricing: (row.pricing as Record<string, unknown> | null) ?? null,
  price_1m_blended_3_to_1: toNumberOrNull(row.price_1m_blended_3_to_1),
  price_1m_input_tokens: toNumberOrNull(row.price_1m_input_tokens),
  price_1m_output_tokens: toNumberOrNull(row.price_1m_output_tokens),
  median_output_tokens_per_second: toNumberOrNull(row.median_output_tokens_per_second),
  median_time_to_first_token_seconds: toNumberOrNull(row.median_time_to_first_token_seconds),
  median_time_to_first_answer_token: toNumberOrNull(row.median_time_to_first_answer_token),
  first_seen: toStringOrEmpty(row.first_seen),
  last_seen: toStringOrEmpty(row.last_seen),
  company_name: toStringOrNull(row.creator_name),
});

const normalizeEpochBenchmark = (row: Record<string, unknown>): EpochBenchmark => ({
  id: Number(row.id) || 0,
  slug: toStringOrEmpty(row.slug),
  name: toStringOrEmpty(row.name),
  description: toStringOrNull(row.description),
  category: toStringOrNull(row.category),
  source_url: toStringOrNull(row.source_url),
});

const normalizeEpochRun = (
  row: Record<string, unknown>,
  benchmarkMap: Map<number, EpochBenchmark>,
): EpochBenchmarkRun => {
  const benchmarkId = Number(row.benchmark_id) || 0;
  const benchmark = benchmarkMap.get(benchmarkId);

  return {
    id: Number(row.id) || 0,
    model_version: toStringOrEmpty(row.model_version),
    benchmark_id: benchmarkId,
    score: toNumberOrNull(row.score),
    release_date: toStringOrNull(row.release_date),
    organization: toStringOrNull(row.organization),
    country: toStringOrNull(row.country),
    stderr: toNumberOrNull(row.stderr),
    benchmark_name: benchmark?.name ?? undefined,
    benchmark_slug: benchmark?.slug ?? undefined,
  };
};

export async function fetchLiveSnapshot(opts: FetchOpts = {}): Promise<LiveSnapshot | null> {
  const supabaseUrl = opts.supabaseUrl ?? import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = opts.supabaseAnonKey ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  const includeEpoch = opts.includeEpoch ?? true;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[live-data] Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY; skipping live refresh.');
    return null;
  }

  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    Accept: 'application/json',
  };

  const aaModelsUrl = new URL('/rest/v1/aa_models', supabaseUrl);
  aaModelsUrl.searchParams.set('select', CLIENT_AA_MODEL_SELECT_COLUMNS.join(','));
  aaModelsUrl.searchParams.set('order', 'aa_intelligence_index.desc.nullslast');

  const epochBenchmarksUrl = new URL('/rest/v1/epoch_benchmarks', supabaseUrl);
  epochBenchmarksUrl.searchParams.set('select', 'id,slug,name,description,category,source_url');
  epochBenchmarksUrl.searchParams.set('order', 'name.asc');

  const epochRunsUrl = new URL('/rest/v1/epoch_benchmark_runs', supabaseUrl);
  epochRunsUrl.searchParams.set(
    'select',
    'id,model_version,benchmark_id,score,release_date,organization,country,stderr',
  );
  epochRunsUrl.searchParams.set('order', 'score.desc.nullslast');

  try {
    const requests: Promise<Response>[] = [
      fetch(aaModelsUrl.toString(), { headers, cache: 'no-store' }),
    ];
    if (includeEpoch) {
      requests.push(fetch(epochBenchmarksUrl.toString(), { headers, cache: 'no-store' }));
      requests.push(fetch(epochRunsUrl.toString(), { headers, cache: 'no-store' }));
    }
    const responses = await Promise.all(requests);
    const aaModelsRes = responses[0];
    const epochBenchmarksRes = includeEpoch ? responses[1] : null;
    const epochRunsRes = includeEpoch ? responses[2] : null;

    if (!aaModelsRes.ok || (epochBenchmarksRes && !epochBenchmarksRes.ok) || (epochRunsRes && !epochRunsRes.ok)) {
      const epochBenchmarksStatus = epochBenchmarksRes ? epochBenchmarksRes.status : 'skipped';
      const epochRunsStatus = epochRunsRes ? epochRunsRes.status : 'skipped';
      throw new Error(
        `Live fetch failed: aa=${aaModelsRes.status} epochBenchmarks=${epochBenchmarksStatus} epochRuns=${epochRunsStatus}`,
      );
    }

    const aaModelsRaw = (await aaModelsRes.json()) as Record<string, unknown>[];
    const aaModels = aaModelsRaw.map(normalizeAaModel);
    if (!includeEpoch) {
      return { aaModels, epochBenchmarks: [], epochRuns: [] };
    }

    const epochBenchmarksRaw = (await epochBenchmarksRes!.json()) as Record<string, unknown>[];
    const epochRunsRaw = (await epochRunsRes!.json()) as Record<string, unknown>[];
    const epochBenchmarks = epochBenchmarksRaw.map(normalizeEpochBenchmark);
    const benchmarkMap = new Map(epochBenchmarks.map((benchmark) => [benchmark.id, benchmark]));
    const epochRuns = epochRunsRaw.map((row) => normalizeEpochRun(row, benchmarkMap));

    return { aaModels, epochBenchmarks, epochRuns };
  } catch (error) {
    console.warn('[live-data] Failed to fetch live snapshot; using server snapshot.', error);
    return null;
  }
}
