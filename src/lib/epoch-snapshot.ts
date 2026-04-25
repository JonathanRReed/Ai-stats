import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { hydrateEpochModelsFromRuns } from './data-integrity';
import type { EpochBenchmark, EpochBenchmarkRun, EpochModel } from './supabase';

type PublicEpochSnapshot = {
  benchmarks?: Array<Record<string, unknown>>;
  models?: Array<Record<string, unknown>>;
  runs?: Array<Record<string, unknown>>;
};

const toStringOrEmpty = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const toStringOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeBenchmark = (row: Record<string, unknown>): EpochBenchmark => ({
  id: toStringOrEmpty(row.id || row.slug),
  slug: toStringOrEmpty(row.slug),
  name: toStringOrEmpty(row.name || row.slug),
  description: toStringOrNull(row.description),
  source: toStringOrNull(row.source),
});

const normalizeModel = (row: Record<string, unknown>): EpochModel => ({
  id: toStringOrEmpty(row.id || row.model_version),
  model_version: toStringOrEmpty(row.model_version),
  model_name: toStringOrNull(row.model_name),
  display_name: toStringOrNull(row.display_name),
  organization: toStringOrNull(row.organization),
  country: toStringOrNull(row.country),
  model_accessibility: toStringOrNull(row.model_accessibility),
  release_date: toStringOrNull(row.release_date),
  eci_score: toNumberOrNull(row.eci_score),
  training_compute_flop: toNumberOrNull(row.training_compute_flop),
  training_compute_confidence: toStringOrNull(row.training_compute_confidence),
  description: toStringOrNull(row.description),
});

const normalizeRun = (
  row: Record<string, unknown>,
  benchmarkMap: Map<string, EpochBenchmark>,
): EpochBenchmarkRun => {
  const benchmarkSlug = toStringOrEmpty(row.benchmark_slug || row.benchmark_id);
  const benchmark = benchmarkMap.get(benchmarkSlug);

  return {
    id: toStringOrEmpty(row.id),
    model_version: toStringOrEmpty(row.model_version),
    benchmark_id: benchmark?.id ?? benchmarkSlug,
    score: toNumberOrNull(row.score),
    release_date: toStringOrNull(row.release_date),
    organization: toStringOrNull(row.organization),
    country: toStringOrNull(row.country),
    stderr: toNumberOrNull(row.stderr),
    score_metric: toStringOrNull(row.score_metric),
    source_name: toStringOrNull(row.source_name),
    source_link: toStringOrNull(row.source_link),
    benchmark_name: benchmark?.name ?? toStringOrNull(row.benchmark_name) ?? undefined,
    benchmark_slug: benchmark?.slug ?? benchmarkSlug,
  };
};

export async function getPublicEpochSnapshot(): Promise<{
  epochBenchmarks: EpochBenchmark[];
  epochModels: EpochModel[];
  epochRuns: EpochBenchmarkRun[];
} | null> {
  try {
    const filePath = path.join(
      process.cwd(),
      'public/data/epoch-benchmark-snapshot.json',
    );
    const snapshot = JSON.parse(await readFile(filePath, 'utf8')) as PublicEpochSnapshot;
    const epochBenchmarks = (snapshot.benchmarks ?? []).map(normalizeBenchmark);
    const benchmarkMap = new Map(
      epochBenchmarks.map((benchmark) => [benchmark.slug, benchmark]),
    );
    const epochRuns = (snapshot.runs ?? []).map((row) =>
      normalizeRun(row, benchmarkMap),
    );
    const epochModels = hydrateEpochModelsFromRuns(
      (snapshot.models ?? []).map(normalizeModel),
      epochRuns,
    );

    if (!epochBenchmarks.length || !epochRuns.length) return null;
    return { epochBenchmarks, epochModels, epochRuns };
  } catch {
    return null;
  }
}
