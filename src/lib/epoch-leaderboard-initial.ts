import type { EpochBenchmark, EpochBenchmarkRun } from './supabase';

type InitialBenchmark = Pick<EpochBenchmark, 'id' | 'slug' | 'name'> & {
  metadata: Pick<NonNullable<EpochBenchmark['metadata']>, 'source_key' | 'benchmark' | 'superseded_by'>;
};

type InitialRun = Pick<EpochBenchmarkRun,
  | 'id'
  | 'model_version'
  | 'organization'
  | 'source_key'
  | 'higher_is_better'
  | 'benchmark_version'
  | 'conditions'
  | 'score_unit'
  | 'score'
  | 'score_metric'
  | 'source_name'
  | 'source_link'
  | 'benchmark_slug'
>;

/** Minimal complete data needed for client-side ranking and paging of Epoch results. */
export function buildInitialEpochLeaderboardData(
  benchmarks: EpochBenchmark[],
  runs: EpochBenchmarkRun[],
  labels: Record<string, string>,
  modelNames: Record<string, string>,
) {
  const compactBenchmarks: InitialBenchmark[] = benchmarks.map(benchmark => ({
    id: benchmark.id,
    slug: benchmark.slug,
    name: benchmark.name,
    metadata: {
      source_key: benchmark.metadata?.source_key ?? null,
      benchmark: benchmark.metadata?.benchmark ?? null,
      superseded_by: benchmark.metadata?.superseded_by ?? null,
    },
  }));
  const compactRuns: InitialRun[] = runs.map(run => ({
    id: run.id,
    model_version: run.model_version,
    organization: run.organization,
    source_key: run.source_key,
    higher_is_better: run.higher_is_better,
    benchmark_version: run.benchmark_version,
    conditions: run.conditions,
    score_unit: run.score_unit,
    score: run.score,
    score_metric: run.score_metric,
    source_name: run.source_name,
    source_link: run.source_link,
    benchmark_slug: run.benchmark_slug,
  }));
  return { benchmarks: compactBenchmarks, runs: compactRuns, labels, modelNames };
}
