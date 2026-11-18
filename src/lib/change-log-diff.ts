/**
 * Build-time differ over dated snapshot versions of one source.
 *
 * A result is identified by what it measures, not by the source's row id (Epoch has
 * re-keyed rows between exports): benchmark, model name as the source writes it,
 * benchmark version, metric, unit and conditions. A score revision is reported only
 * when that identity is unique in two consecutive versions and the stored score
 * changed; both values and both retrieval dates are kept. "First recorded" uses the coarser
 * benchmark and model pair, so a field the pipeline started exporting later does not turn
 * every existing result into a new one.
 */

export type HistoryRun = {
  benchmarkSlug: string;
  benchmarkName: string;
  model: string;
  score: number | null;
  unit: string | null;
  version: string | null;
  metric: string | null;
  conditions: Record<string, unknown> | null;
};

export type HistoryVersion = {
  /** Stable source key, for example "epoch-ai" or "livebench". */
  source: string;
  /** The snapshot's own retrieval timestamp, not the commit time. */
  fetchedAt: string;
  runs: HistoryRun[];
};

export type ScoreRevision = {
  source: string; benchmarkSlug: string; benchmarkName: string; model: string;
  unit: string | null; metric: string | null; version: string | null; conditions: Record<string, unknown> | null;
  before: number; after: number; beforeFetchedAt: string; afterFetchedAt: string;
};

export type FirstRecorded = {
  source: string; benchmarkSlug: string; benchmarkName: string;
  fetchedAt: string; previousFetchedAt: string; count: number; models: string[];
};

export type HistoryDiff = {
  revisions: ScoreRevision[];
  firstRecorded: FirstRecorded[];
  /** Every distinct retrieval in the window, including the baseline. */
  refreshes: {source: string; fetchedAt: string}[];
  /** The earliest version, used only as the comparison base. */
  baseline: string | null;
  versions: number;
};

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
};

/** The identity of a measurement, independent of the source's row id. */
export const runKey = (run: HistoryRun): string =>
  JSON.stringify([run.benchmarkSlug, run.model, run.version, run.metric, run.unit, stable(run.conditions ?? null)]);

/** A model's results on one benchmark, used for "first recorded": schema fields added later never make an old result look new. */
export const pairKey = (run: Pick<HistoryRun, 'benchmarkSlug' | 'model'>): string => JSON.stringify([run.benchmarkSlug, run.model]);

/** Equal within binary floating-point noise only; any stored change beyond that is a revision. */
export const sameScore = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

type Indexed = {runs: Map<string, HistoryRun>; ambiguous: Set<string>};
const index = (version: HistoryVersion): Indexed => {
  const runs = new Map<string, HistoryRun>(), ambiguous = new Set<string>();
  for (const run of version.runs) {
    const key = runKey(run);
    if (runs.has(key)) ambiguous.add(key); else runs.set(key, run);
  }
  return {runs, ambiguous};
};

/**
 * Diff the versions of one source in retrieval order. Versions sharing a fetchedAt are one
 * retrieval (the file was rewritten without a new fetch) and only the last copy is used.
 */
export function diffHistory(input: HistoryVersion[]): HistoryDiff {
  const byFetch = new Map<string, HistoryVersion>();
  for (const version of input) if (Number.isFinite(Date.parse(version.fetchedAt))) byFetch.set(version.fetchedAt, version);
  const versions = [...byFetch.values()].sort((a, b) => Date.parse(a.fetchedAt) - Date.parse(b.fetchedAt));
  const revisions: ScoreRevision[] = [], firstRecorded: FirstRecorded[] = [];
  const seenPairs = new Set<string>();
  let previous: (Indexed & {version: HistoryVersion}) | null = null;
  for (const version of versions) {
    const current = {...index(version), version};
    if (previous) {
      const fresh = new Map<string, FirstRecorded>();
      const counted = new Set<string>();
      for (const run of version.runs) {
        const pair = pairKey(run);
        if (seenPairs.has(pair) || counted.has(pair)) continue;
        counted.add(pair);
        const group = fresh.get(run.benchmarkSlug) ?? {source: version.source, benchmarkSlug: run.benchmarkSlug, benchmarkName: run.benchmarkName,
            fetchedAt: version.fetchedAt, previousFetchedAt: previous.version.fetchedAt, count: 0, models: []};
        group.count++;
        group.models.push(run.model);
        fresh.set(run.benchmarkSlug, group);
      }
      for (const [key, run] of current.runs) {
        const before = previous.runs.get(key);
        if (!before || previous.ambiguous.has(key) || current.ambiguous.has(key)) continue;
        if (before.score === null || run.score === null || !Number.isFinite(before.score) || !Number.isFinite(run.score)) continue;
        if (sameScore(before.score, run.score)) continue;
        revisions.push({source: version.source, benchmarkSlug: run.benchmarkSlug, benchmarkName: run.benchmarkName, model: run.model,
          unit: run.unit, metric: run.metric, version: run.version, conditions: run.conditions,
          before: before.score, after: run.score, beforeFetchedAt: previous.version.fetchedAt, afterFetchedAt: version.fetchedAt});
      }
      for (const group of fresh.values()) group.models.sort((a, b) => a.localeCompare(b));
      firstRecorded.push(...[...fresh.values()].sort((a, b) => b.count - a.count || a.benchmarkName.localeCompare(b.benchmarkName)));
    }
    for (const run of version.runs) seenPairs.add(pairKey(run));
    previous = current;
  }
  return {
    revisions, firstRecorded,
    refreshes: versions.map((version) => ({source: version.source, fetchedAt: version.fetchedAt})),
    baseline: versions[0]?.fetchedAt ?? null,
    versions: versions.length,
  };
}
