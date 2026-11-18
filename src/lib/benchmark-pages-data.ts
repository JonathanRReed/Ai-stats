/**
 * Loads benchmark pages once per build from the shared catalog. Coverage: every Epoch or
 * publisher benchmark with a scored run (the same list Compare offers) and every Artificial
 * Analysis metric in AA_METRIC_LABELS with at least one current value.
 */
import { getModelCatalogData } from './model-catalog-data';
import { getModelPageRecords } from './model-pages-data';
import {
  AA_BENCHMARK_ATTRIBUTION,
  EPOCH_BENCHMARK_LABELS,
  getCompareBenchmarkLabel,
  getEpochBenchmarkAttribution,
  getEpochBenchmarksWithRuns,
} from './benchmark-catalog';
import { AA_METRIC_LABELS } from './compare-state';
import { resolveEpochModelDisplayName } from './epoch-model-display-name';
import type { ExplorerModel } from './compare-series';
import type { EpochBenchmark, EpochBenchmarkRun } from './supabase';
import {
  assembleBenchmarkPage,
  assertUniqueBenchmarkPaths,
  displayScale,
  makeRun,
  type BenchmarkFact,
  type BenchmarkPage,
  type BenchmarkRun,
  type BenchmarkSource,
} from './benchmark-pages';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const httpUrl = (value: unknown): string | null => {
  const candidate = text(value);
  return candidate && /^https?:\/\//u.test(candidate) ? candidate : null;
};

const EPOCH_FACTS: Array<[string, string]> = [
  ['benchmark', 'Name in the source file'],
  ['score_column', 'Score column'],
  ['score_ceiling', 'Score ceiling, as recorded'],
  ['random_baseline', 'Random baseline, as recorded'],
  ['release_date', 'Benchmark release date'],
  ['superseded_by', 'Superseded by'],
  ['version', 'Version'],
  ['collection_method', 'Collection method'],
];

export function epochBenchmarkFacts(benchmark: EpochBenchmark): BenchmarkFact[] {
  const metadata = benchmark.metadata ?? {};
  return EPOCH_FACTS.flatMap(([key, label]) => {
    const value = text(metadata[key]);
    return value ? [{ label, value }] : [];
  });
}

/** Epoch and publisher runs for one benchmark, projected onto its display scale. */
export function epochPageRuns(
  benchmark: EpochBenchmark,
  runs: EpochBenchmarkRun[],
  names: Readonly<Record<string, string>>,
  labs: Readonly<Record<string, string>>,
): BenchmarkRun[] {
  return runs
    .filter((run) => run.benchmark_slug === benchmark.slug && finite(run.score))
    .map((run) => {
      const scaled = displayScale(run.score as number, run.score_unit ?? 'native');
      return makeRun({
        id: run.id,
        modelKey: run.model_version,
        modelName: resolveEpochModelDisplayName(run.model_version, names),
        lab: text(run.organization) ?? labs[run.model_version] ?? null,
        modelPath: null,
        value: scaled.value,
        stderr: finite(run.stderr) && run.stderr >= 0 ? displayScale(run.stderr, run.score_unit ?? 'native').value : null,
        unit: scaled.unit,
        metric: text(run.score_metric),
        version: text(run.benchmark_version),
        conditions: run.conditions ?? null,
        releaseDate: text(run.release_date),
        evaluationDate: text(run.evaluation_date),
        sourceName: text(run.source_name) && !httpUrl(run.source_name) ? text(run.source_name) : null,
        sourceUrl: httpUrl(run.source_link) ?? httpUrl(run.source_name),
      });
    });
}

export const AA_INDEX_KEYS = new Set(['aa_intelligence_index', 'aa_coding_index', 'aa_agentic_index', 'aa_math_index']);
export const aaMetricValue = (model: ExplorerModel, key: string): number | null => {
  const value = key === 'aa_intelligence_index' ? model.intelligence : key === 'aa_coding_index' ? model.coding : model.metrics?.[key];
  return finite(value) ? value : null;
};
export const aaBenchmarkName = (key: string): string =>
  AA_INDEX_KEYS.has(key) ? `Artificial Analysis ${AA_METRIC_LABELS[key]}` : `${AA_METRIC_LABELS[key]} (Artificial Analysis)`;

/** Current AA rows with a value for one metric. Index versions stay separate cohorts. */
export function aaPageRuns(
  key: string,
  models: ExplorerModel[],
  releaseDates: Readonly<Record<string, string>>,
  pages: ReadonlyMap<string, { path: string; provider: string }>,
): BenchmarkRun[] {
  const rows = models
    .filter((model) => model.source === 'aa' && model.current !== false)
    .map((model) => ({ model, value: aaMetricValue(model, key) }))
    .filter((row): row is { model: ExplorerModel; value: number } => row.value !== null);
  const index = AA_INDEX_KEYS.has(key);
  const fraction = !index && rows.length > 0 && rows.every((row) => row.value >= 0 && row.value <= 1);
  return rows.map(({ model, value }) => {
    const scaled = displayScale(value, index ? 'points' : fraction ? 'fraction' : 'native');
    const page = pages.get(model.id);
    return makeRun({
      id: model.id,
      modelKey: model.id,
      modelName: model.name,
      lab: page?.provider ?? text(model.provider),
      modelPath: page?.path ?? null,
      value: scaled.value,
      stderr: null,
      unit: scaled.unit,
      metric: AA_METRIC_LABELS[key],
      version: index && model.indexVersion ? `Index v${model.indexVersion}` : null,
      conditions: null,
      releaseDate: releaseDates[model.id] ?? null,
      evaluationDate: null,
      sourceName: 'Artificial Analysis',
      sourceUrl: httpUrl(model.sourceUrl),
    });
  });
}

const latest = (values: Array<string | null | undefined>): string | null => {
  const times = values.filter((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))).map(Date.parse);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
};

/**
 * Compare's label, except that a benchmark without a curated label uses the name in its own
 * source file ("Remote Labor Index") rather than one rebuilt from the slug ("Rli").
 */
export const epochBenchmarkName = (benchmark: EpochBenchmark): string =>
  getCompareBenchmarkLabel({
    ...benchmark,
    name: EPOCH_BENCHMARK_LABELS[benchmark.slug] ?? text(benchmark.metadata?.benchmark) ?? benchmark.name,
  });

const COMPARE_SLUG = /^[a-z0-9_-]{1,120}$/;

async function load(): Promise<BenchmarkPage[]> {
  const [data, records] = await Promise.all([getModelCatalogData(), getModelPageRecords()]);
  const { epochBenchmarks, epochRuns } = data.benchmarks;
  const names: Record<string, string> = {};
  const labs: Record<string, string> = {};
  for (const model of data.epoch.epochModels) {
    const name = text(model.display_name) ?? text(model.model_name);
    if (name) names[model.model_version] = name;
    const lab = text(model.organization);
    if (lab) labs[model.model_version] = lab;
  }
  for (const model of data.publishers.models) {
    names[model.sourceModelId] = model.family;
    if (model.provider && model.provider !== 'Unknown') labs[model.sourceModelId] = model.provider;
  }
  const runsBySlug = new Map<string, EpochBenchmarkRun[]>();
  for (const run of epochRuns) {
    const slug = run.benchmark_slug ?? run.benchmark_id;
    const group = runsBySlug.get(slug) ?? [];
    group.push(run);
    runsBySlug.set(slug, group);
  }

  const pages: BenchmarkPage[] = [];
  for (const benchmark of getEpochBenchmarksWithRuns(epochBenchmarks, epochRuns).filter((row) => COMPARE_SLUG.test(row.slug))) {
    const raw = runsBySlug.get(benchmark.slug) ?? [];
    const direction = new Map(raw.map((run) => [run.id, run.higher_is_better ?? benchmark.slug !== 'btf3_external']));
    const source: BenchmarkSource = benchmark.metadata?.source_key ? 'publisher' : 'epoch-ai';
    pages.push(assembleBenchmarkPage({
      slug: benchmark.slug,
      name: epochBenchmarkName(benchmark),
      source,
      attribution: getEpochBenchmarkAttribution(benchmark, raw),
      description: text(benchmark.description),
      facts: epochBenchmarkFacts(benchmark),
      runs: epochPageRuns(benchmark, raw, names, labs),
      higherIsBetter: (run) => direction.get(run.id) ?? true,
      fetchedAt: source === 'publisher' ? latest(raw.map((run) => run.source_fetched_at)) : data.epoch.fetchedAt,
    }));
  }

  const releaseDates: Record<string, string> = {};
  for (const model of data.aaModels) {
    const date = text(model.source_metadata?.release_date);
    if (date) releaseDates[model.id] = date;
  }
  const pageById = new Map(records.map((record) => [record.id, { path: record.path, provider: record.provider }]));
  for (const key of Object.keys(AA_METRIC_LABELS)) {
    const runs = aaPageRuns(key, data.records, releaseDates, pageById);
    if (!runs.length) continue;
    const versions = [...new Set(runs.map((run) => run.version).filter((value): value is string => value !== null))];
    pages.push(assembleBenchmarkPage({
      slug: key,
      name: aaBenchmarkName(key),
      source: 'artificial-analysis',
      attribution: AA_BENCHMARK_ATTRIBUTION,
      description: null,
      facts: [
        { label: 'Metric', value: AA_METRIC_LABELS[key] },
        ...(versions.length ? [{ label: 'Index version', value: versions.join(', ') }] : []),
        { label: 'Rows', value: 'Current Artificial Analysis models only' },
      ],
      runs,
      higherIsBetter: () => true,
      fetchedAt: latest(data.records.filter((model) => model.source === 'aa' && model.current !== false).map((model) => model.observedAt)),
    }));
  }
  assertUniqueBenchmarkPaths(pages);
  return pages;
}

let cached: Promise<BenchmarkPage[]> | undefined;
export const getBenchmarkPageData = (): Promise<BenchmarkPage[]> =>
  (cached ??= load().catch((error) => { cached = undefined; throw error; }));

/** The route list for nav, sitemap and cross-links. */
export async function getBenchmarkPages(): Promise<Array<{ slug: string; name: string; path: string; source: BenchmarkSource }>> {
  return (await getBenchmarkPageData()).map(({ slug, name, path, source }) => ({ slug, name, path, source }));
}
