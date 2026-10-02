import { getEpochBenchmarks, getEpochBenchmarkRuns, getHydratedEpochModels, supabase } from './supabase';
import { getPublicEpochSnapshot } from './epoch-snapshot';
import { chooseValidatedEpoch } from './epoch-selection';
import { decodeEpochCache } from './epoch-cache';

type EpochEvidence = NonNullable<Awaited<ReturnType<typeof getPublicEpochSnapshot>>>;
type EpochSources = {
  published: () => Promise<EpochEvidence | null>;
  cache: () => Promise<{ found: boolean; evidence: EpochEvidence | null }>;
  receipt: () => Promise<string | null>;
  legacy: (fetchedAt: string | null) => Promise<EpochEvidence>;
};

async function readValidatedEpochCache(): Promise<{ found: boolean; evidence: EpochEvidence | null }> {
  if (!supabase) return { found: false, evidence: null };
  try {
    const { data, error } = await supabase.from('source_snapshot_cache')
      .select('source_key,fetched_at,payload,record_count').eq('source_key', 'epoch-ai').maybeSingle();
    if (error || !data) return { found: false, evidence: null };
    const snapshot = decodeEpochCache(data);
    return { found: true, evidence: snapshot ? await getPublicEpochSnapshot(snapshot) : null };
  } catch { return { found: false, evidence: null }; }
}

const defaultSources: EpochSources = {
  published: getPublicEpochSnapshot,
  cache: readValidatedEpochCache,
  receipt: async () => {
    const receipt = await supabase?.from('epoch_data_files').select('fetched_at')
      .order('fetched_at', { ascending: false }).limit(1);
    return !receipt?.error ? receipt?.data?.[0]?.fetched_at ?? null : null;
  },
  legacy: async fetchedAt => {
    const [epochBenchmarks, epochRuns] = await Promise.all([getEpochBenchmarks(), getEpochBenchmarkRuns()]);
    return { fetchedAt, epochBenchmarks, epochRuns, epochModels: await getHydratedEpochModels(epochRuns) };
  },
};

export async function readEpochEvidence(sources: EpochSources = defaultSources): Promise<EpochEvidence> {
  const [published, cache] = await Promise.all([
    sources.published().catch(() => null),
    sources.cache().catch(() => ({ found: true, evidence: null })),
  ]);
  // Only validated cache data or the checked artifact may serve this reader.
  // Legacy tables can be midway through an import even when their receipt is newer.
  return chooseValidatedEpoch(published, cache.found ? cache.evidence : null) ??
    { fetchedAt: null, epochBenchmarks: [], epochRuns: [], epochModels: [] };
}

let cached: ReturnType<typeof readEpochEvidence> | undefined;
/** One selected dataset and timestamp for charts, comparisons, API, and health. */
export const getEpochEvidence = () => cached ??= readEpochEvidence();
