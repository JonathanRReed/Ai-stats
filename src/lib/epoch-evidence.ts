import { getEpochBenchmarks, getEpochBenchmarkRuns, getHydratedEpochModels, supabase } from './supabase';
import { getPublicEpochSnapshot } from './epoch-snapshot';
import { preferPublishedEpoch } from './epoch-selection';

async function readEpochEvidence() {
  const [published, receipt] = await Promise.all([
    getPublicEpochSnapshot(),
    supabase?.from('epoch_data_files').select('fetched_at').order('fetched_at', { ascending: false }).limit(1),
  ]);
  const fetchedAt = !receipt?.error ? receipt?.data?.[0]?.fetched_at ?? null : null;
  // The small receipt decides whether thousands of database rows need loading.
  if (published && preferPublishedEpoch(published, fetchedAt, fetchedAt ? 1 : 0)) return published;
  const [epochBenchmarks, epochRuns] = await Promise.all([getEpochBenchmarks(), getEpochBenchmarkRuns()]);
  if (published && preferPublishedEpoch(published, fetchedAt, epochRuns.length)) return published;
  return { fetchedAt, epochBenchmarks, epochRuns, epochModels: await getHydratedEpochModels(epochRuns) };
}

let cached: ReturnType<typeof readEpochEvidence> | undefined;
/** One selected dataset and timestamp for charts, comparisons, API, and health. */
export const getEpochEvidence = () => cached ??= readEpochEvidence();
