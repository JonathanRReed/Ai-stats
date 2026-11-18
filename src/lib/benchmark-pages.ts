/**
 * Build-time benchmark pages: one static URL per Epoch/publisher benchmark with runs and per
 * Artificial Analysis metric with a current value.
 *
 * Everything here is pure so the logic can be tested without a database; loading lives in
 * src/lib/benchmark-pages-data.ts. Scores keep their own scale. Runs are only ordered together
 * when they share a metric, unit and benchmark version (the Compare score key), and runs under
 * different conditions are labelled as such rather than silently merged.
 */
import { epochConditionKey } from './epoch-observations';
import { benchmarkPath } from './site-routes';
import type { BenchmarkAttribution } from './benchmark-catalog';
import { SITE_ORIGIN } from './model-pages';
import { AUTHOR_REF } from './author';

export type BenchmarkSource = 'artificial-analysis' | 'epoch-ai' | 'publisher';
export const BENCHMARK_SOURCE_LABELS: Record<BenchmarkSource, string> = {
  'artificial-analysis': 'Artificial Analysis',
  'epoch-ai': 'Epoch AI Benchmarking Hub',
  publisher: 'Original publishers',
};

export type RunConditions = Record<string, string | number | boolean> | null;

/** One recorded score, already on the scale it is displayed on (fractions become percent). */
export type BenchmarkRun = {
  id: string;
  modelKey: string;
  modelName: string;
  lab: string | null;
  modelPath: string | null;
  value: number;
  stderr: number | null;
  unit: 'percent' | 'native' | 'points';
  metric: string | null;
  version: string | null;
  conditions: RunConditions;
  conditionKey: string;
  conditionLabel: string;
  releaseDate: string | null;
  evaluationDate: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
};

export type LeaderRow = BenchmarkRun & { runsForModel: number };

export type StepPoint = { date: string; value: number; runId: string; modelName: string; basis: 'release' | 'evaluation' };
export type BestScoreSteps = {
  /** Every dated run, oldest first. */
  dated: StepPoint[];
  /** Runs that set a new best, oldest first. */
  records: StepPoint[];
  releaseDated: number;
  evaluationDated: number;
  undated: number;
  /** True when there are enough dated runs and records to draw an honest step line. */
  drawable: boolean;
};

export type BenchmarkCohort = {
  key: string;
  metric: string | null;
  unit: BenchmarkRun['unit'];
  version: string | null;
  higherIsBetter: boolean;
  runs: BenchmarkRun[];
  leaderboard: LeaderRow[];
  conditionCount: number;
  stderrCoverage: 'all' | 'some' | 'none';
  steps: BestScoreSteps;
  scaleMax: number;
  scaleMin: number;
};

export type BenchmarkFact = { label: string; value: string };

export type BenchmarkPage = {
  /** Epoch slug or AA metric key, as other lanes pass it to benchmarkPath(). */
  slug: string;
  pathSlug: string;
  path: string;
  name: string;
  source: BenchmarkSource;
  sourceLabel: string;
  attribution: BenchmarkAttribution;
  description: string | null;
  facts: BenchmarkFact[];
  compareHref: string;
  cohorts: BenchmarkCohort[];
  runCount: number;
  modelCount: number;
  firstDate: string | null;
  lastDate: string | null;
  fetchedAt: string | null;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const validDate = (value: string | null | undefined): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

/** Fractions are shown as percent, the same convention Compare uses. */
export function displayScale(score: number, unit: 'native' | 'percent' | 'fraction' | 'points' | null | undefined): {
  value: number; unit: BenchmarkRun['unit'];
} {
  if (unit === 'fraction') return { value: score * 100, unit: 'percent' };
  if (unit === 'percent') return { value: score, unit: 'percent' };
  if (unit === 'points') return { value: score, unit: 'points' };
  return { value: score, unit: 'native' };
}

export function conditionLabel(conditions: RunConditions): string {
  if (conditions === null) return 'Not recorded';
  const entries = Object.entries(conditions).sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(' · ') : 'None recorded';
}

/** Same identity as Compare's epochScoreKey: metric, unit (fraction counts as percent), version. */
export const cohortKey = (run: Pick<BenchmarkRun, 'metric' | 'unit' | 'version'>, higherIsBetter: boolean): string =>
  JSON.stringify([run.metric ?? 'Unknown metric', run.unit, ...(run.version ? [run.version] : []), higherIsBetter ? 'higher' : 'lower']);

const better = (a: number, b: number, higherIsBetter: boolean) => (higherIsBetter ? a > b : a < b);

/** Orders two runs best first: score, then a recorded (smaller) standard error, then id. */
export function compareRuns(a: BenchmarkRun, b: BenchmarkRun, higherIsBetter: boolean): number {
  if (a.value !== b.value) return better(a.value, b.value, higherIsBetter) ? -1 : 1;
  if ((a.stderr === null) !== (b.stderr === null)) return a.stderr === null ? 1 : -1;
  if (a.stderr !== null && b.stderr !== null && a.stderr !== b.stderr) return a.stderr - b.stderr;
  return a.id.localeCompare(b.id);
}

/** The best recorded run for each model, best first. Other runs stay in the full table. */
export function bestRunPerModel(runs: BenchmarkRun[], higherIsBetter: boolean): LeaderRow[] {
  const groups = new Map<string, BenchmarkRun[]>();
  for (const run of runs) {
    const group = groups.get(run.modelKey) ?? [];
    group.push(run);
    groups.set(run.modelKey, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...[...group].sort((a, b) => compareRuns(a, b, higherIsBetter))[0], runsForModel: group.length }))
    .sort((a, b) => compareRuns(a, b, higherIsBetter));
}

const runDate = (run: BenchmarkRun): { date: string; basis: StepPoint['basis'] } | null =>
  validDate(run.releaseDate) ? { date: run.releaseDate.slice(0, 10), basis: 'release' }
    : validDate(run.evaluationDate) ? { date: run.evaluationDate.slice(0, 10), basis: 'evaluation' } : null;

/**
 * Running best score against date. A run is dated by its model's release date when recorded,
 * otherwise by its evaluation date; undated runs are counted and left out.
 */
export function bestScoreSteps(runs: BenchmarkRun[], higherIsBetter: boolean, minimumDated = 6): BestScoreSteps {
  const dated: StepPoint[] = [];
  let undated = 0;
  for (const run of runs) {
    const when = runDate(run);
    if (!when) { undated += 1; continue; }
    dated.push({ date: when.date, value: run.value, runId: run.id, modelName: run.modelName, basis: when.basis });
  }
  dated.sort((a, b) => a.date.localeCompare(b.date) || (a.value === b.value ? a.runId.localeCompare(b.runId) : better(a.value, b.value, higherIsBetter) ? -1 : 1));
  const records: StepPoint[] = [];
  for (const point of dated) {
    const current = records[records.length - 1];
    if (!current || better(point.value, current.value, higherIsBetter)) records.push(point);
  }
  const dates = new Set(dated.map((point) => point.date));
  return {
    dated,
    records,
    releaseDated: dated.filter((point) => point.basis === 'release').length,
    evaluationDated: dated.filter((point) => point.basis === 'evaluation').length,
    undated,
    drawable: dated.length >= minimumDated && records.length >= 2 && dates.size >= 3,
  };
}

const stderrCoverage = (runs: BenchmarkRun[]): BenchmarkCohort['stderrCoverage'] => {
  const count = runs.filter((run) => run.stderr !== null).length;
  return count === 0 ? 'none' : count === runs.length ? 'all' : 'some';
};

/** Scale for bars: percent runs from 0 to 100, other units from 0 (or the lowest value) to the highest. */
export function cohortScale(runs: BenchmarkRun[]): { min: number; max: number } {
  const highs = runs.map((run) => run.value + (run.stderr ?? 0));
  const lows = runs.map((run) => run.value - (run.stderr ?? 0));
  if (runs.length && runs.every((run) => run.unit === 'percent')) {
    return { min: Math.min(0, ...lows), max: Math.max(100, ...highs) };
  }
  const max = highs.length ? Math.max(...highs) : 1;
  const min = Math.min(0, ...lows);
  return { min, max: max > min ? max : min + 1 };
}

export function buildCohorts(runs: BenchmarkRun[], higherIsBetter: (run: BenchmarkRun) => boolean): BenchmarkCohort[] {
  const groups = new Map<string, { higher: boolean; runs: BenchmarkRun[] }>();
  for (const run of runs) {
    if (!finite(run.value)) continue;
    const higher = higherIsBetter(run);
    const key = cohortKey(run, higher);
    const group = groups.get(key) ?? { higher, runs: [] };
    group.runs.push(run);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      const sorted = [...group.runs].sort((a, b) => compareRuns(a, b, group.higher));
      const first = sorted[0];
      const scale = cohortScale(sorted);
      return {
        key,
        metric: first.metric,
        unit: first.unit,
        version: first.version,
        higherIsBetter: group.higher,
        runs: sorted,
        leaderboard: bestRunPerModel(sorted, group.higher),
        conditionCount: new Set(sorted.map((run) => run.conditionKey)).size,
        stderrCoverage: stderrCoverage(sorted),
        steps: bestScoreSteps(sorted, group.higher),
        scaleMin: scale.min,
        scaleMax: scale.max,
      };
    })
    // Most runs first; a newer version string wins ties so the current cohort leads.
    .sort((a, b) => b.runs.length - a.runs.length || (b.version ?? '').localeCompare(a.version ?? '', undefined, { numeric: true }) || a.key.localeCompare(b.key));
}

export function benchmarkCompareHref(source: BenchmarkSource, slug: string): string {
  const metric = source === 'artificial-analysis' ? slug : `epoch_${slug}`;
  return `/compare?${new URLSearchParams({ chart: 'benchmark', metric }).toString()}`;
}

export function dateRange(runs: BenchmarkRun[]): { first: string | null; last: string | null } {
  const dates = runs.map(runDate).filter((value): value is NonNullable<typeof value> => value !== null).map((value) => value.date).sort();
  return { first: dates[0] ?? null, last: dates[dates.length - 1] ?? null };
}

export function makeRun(input: Omit<BenchmarkRun, 'conditionKey' | 'conditionLabel'>): BenchmarkRun {
  return { ...input, conditionKey: epochConditionKey(input.conditions), conditionLabel: conditionLabel(input.conditions) };
}

export function assembleBenchmarkPage(input: {
  slug: string; name: string; source: BenchmarkSource; attribution: BenchmarkAttribution; description: string | null;
  facts: BenchmarkFact[]; runs: BenchmarkRun[]; higherIsBetter: (run: BenchmarkRun) => boolean; fetchedAt: string | null;
}): BenchmarkPage {
  const path = benchmarkPath(input.slug);
  const cohorts = buildCohorts(input.runs, input.higherIsBetter);
  const scored = cohorts.flatMap((cohort) => cohort.runs);
  const range = dateRange(scored);
  return {
    slug: input.slug,
    pathSlug: path.slice(path.lastIndexOf('/') + 1),
    path,
    name: input.name,
    source: input.source,
    sourceLabel: BENCHMARK_SOURCE_LABELS[input.source],
    attribution: input.attribution,
    description: input.description,
    facts: input.facts,
    compareHref: benchmarkCompareHref(input.source, input.slug),
    cohorts,
    runCount: scored.length,
    modelCount: new Set(scored.map((run) => run.modelKey)).size,
    firstDate: range.first,
    lastDate: range.last,
    fetchedAt: input.fetchedAt,
  };
}

/** Two inputs must never land on one URL; fail the build instead of dropping a page. */
export function assertUniqueBenchmarkPaths(pages: Pick<BenchmarkPage, 'slug' | 'path'>[]): void {
  const seen = new Map<string, string>();
  for (const page of pages) {
    const other = seen.get(page.path);
    if (other !== undefined) throw new Error(`Benchmark pages ${other} and ${page.slug} share the path ${page.path}`);
    seen.set(page.path, page.slug);
  }
}

/** Numbers on the benchmark's own scale. */
export function formatScore(value: number, unit: BenchmarkRun['unit']): string {
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : Math.abs(value) >= 1 ? 2 : 3;
  const text = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: unit === 'native' ? 0 : Math.min(1, digits) }).format(value);
  return unit === 'percent' ? `${text}%` : text;
}
export function formatStderr(value: number, unit: BenchmarkRun['unit']): string {
  const digits = Math.abs(value) >= 10 ? 1 : Math.abs(value) >= 1 ? 1 : 2;
  const text = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
  return unit === 'percent' ? `± ${text} pp` : `± ${text}`;
}
export const unitLabel = (unit: BenchmarkRun['unit'], metric: string | null): string =>
  unit === 'percent' ? 'percent' : unit === 'points' ? 'index points' : metric ? `${metric}, source scale` : 'source scale';

/** Round tick values covering [min, max]. */
export function linearTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const rough = (max - min) / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const ratio = rough / power;
  const step = (ratio <= 1.5 ? 1 : ratio <= 3 ? 2 : ratio <= 7 ? 5 : 10) * power;
  const ticks: number[] = [];
  for (let value = Math.ceil(min / step - 1e-9) * step; value <= max + step * 1e-9; value += step) ticks.push(Number(value.toPrecision(12)));
  return ticks;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Calendar ticks: years for long spans, then half-years, quarters or months. */
export function timeTicks(minMs: number, maxMs: number, maxTicks = 12): Array<{ ms: number; label: string }> {
  const span = (maxMs - minMs) / (365.25 * 864e5);
  const months = [1, 3, 6, 12, 24, 60].find((step) => (span * 12) / step <= maxTicks) ?? 120;
  const start = new Date(minMs);
  let year = start.getUTCFullYear(), month = Math.ceil(start.getUTCMonth() / months) * months;
  const ticks: Array<{ ms: number; label: string }> = [];
  for (let guard = 0; guard < 200; guard += 1) {
    if (month >= 12) { year += Math.floor(month / 12); month %= 12; }
    const ms = Date.UTC(year, month, 1);
    if (ms > maxMs) break;
    if (ms >= minMs) ticks.push({ ms, label: months >= 12 ? String(year) : month === 0 ? `${MONTHS[month]} ${year}` : MONTHS[month] });
    month += months;
  }
  return ticks;
}

export const benchmarkPageTitle = (page: Pick<BenchmarkPage, 'name'>): string => {
  const detailed = `${page.name} results by model, with sources | AI Stats`;
  if (detailed.length <= 70) return detailed;
  const short = `${page.name} results | AI Stats`;
  return short.length <= 70 ? short : page.name;
};

export function benchmarkPageDescription(page: BenchmarkPage): string {
  const via = page.attribution.viaName && page.attribution.viaName !== page.attribution.sourceName ? ` via ${page.attribution.viaName}` : '';
  const span = page.firstDate && page.lastDate ? `, models dated ${page.firstDate} to ${page.lastDate}` : '';
  return `${page.name}: ${page.runCount} recorded ${page.runCount === 1 ? 'run' : 'runs'} across ${page.modelCount} ${page.modelCount === 1 ? 'model' : 'models'}${span}. Best run per model, standard errors where recorded, and every run with its conditions and source (${page.attribution.sourceName}${via}).`;
}

/** Nodes appended to the page graph. The Layout already emits WebSite, WebPage, and the author. */
export function buildBenchmarkJsonLd(page: BenchmarkPage): Record<string, unknown>[] {
  const url = `${SITE_ORIGIN}${page.path}`;
  const basedOn = [...new Set([page.attribution.sourceUrl, page.attribution.viaUrl].filter((value): value is string => Boolean(value)))];
  return [
    {
      '@type': 'Dataset',
      '@id': `${url}#dataset`,
      name: `${page.name} results on AI Stats`,
      description: benchmarkPageDescription(page),
      url,
      creator: AUTHOR_REF,
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      isBasedOn: basedOn,
      ...(page.attribution.license ? { license: page.attribution.license } : {}),
      ...(page.firstDate && page.lastDate ? { temporalCoverage: `${page.firstDate}/${page.lastDate}` } : {}),
      ...(page.fetchedAt ? { dateModified: page.fetchedAt.slice(0, 10) } : {}),
      variableMeasured: page.cohorts.map((cohort) => ({
        '@type': 'PropertyValue',
        name: [cohort.metric ?? 'Score', cohort.version].filter(Boolean).join(', '),
        unitText: unitLabel(cohort.unit, cohort.metric),
        description: `${cohort.runs.length} runs, ${cohort.higherIsBetter ? 'higher is better' : 'lower is better'}`,
      })),
      inLanguage: 'en-US',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'AI Stats', item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Benchmarks', item: `${SITE_ORIGIN}/benchmarks` },
        { '@type': 'ListItem', position: 3, name: page.name, item: url },
      ],
    },
  ];
}

/** Axis ticks: whole numbers stay whole ("80%", not "80.0%"). */
export function formatTick(value: number, unit: BenchmarkRun['unit']): string {
  const text = Number.isInteger(value) ? new Intl.NumberFormat('en-US').format(value) : formatScore(value, unit).replace(/%$/, '');
  return unit === 'percent' ? `${text}%` : text;
}
