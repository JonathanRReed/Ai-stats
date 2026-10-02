import type { EpochBenchmarkRun } from './supabase';
import type { EpochObservation } from './epoch-observations';
export type ComparisonEvidence<T> = {
  schemaVersion: 2;
  models: T[];
  observations: EpochObservation[];
};

import { parseFiniteMetricValue } from './metric-values';

export function buildCompareEvidence<T>(models: T[], observations: EpochObservation[]): ComparisonEvidence<T> {
  return { schemaVersion: 2, models: [...models], observations: [...observations] };
}

export function availableForMetric(model: object, metric: string): boolean {
  const record = model as Record<string, unknown>;
  if (metric === 'price-pair') {
    return ['price_1m_input_tokens', 'price_1m_output_tokens'].every(key => {
      const value = parseFiniteMetricValue(record[key]);
      return value !== null && value >= 0;
    });
  }
  const value = parseFiniteMetricValue(record[metric]);
  return value !== null && (!metric.includes('price') || value >= 0);
}

const key = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Compatibility scalar map: incompatible units and ambiguous runs remain unavailable. */
export function buildEpochScoreIndex(
  observations: EpochObservation[],
  aliasesByVersion: Record<string, string[]>,
): {
  scores: Record<string, Record<string, number>>;
  ambiguities: Record<string, Record<string, number>>;
  receipts: Record<string, Record<string, EpochObservation>>;
  units: Record<string, 'native' | 'percent' | 'mixed'>;
} {
  const forms = (value: string) => {
    const normalized = key(value);
    return normalized ? [...new Set([normalized, normalized.replace(/\s+/g, '')])] : [];
  };
  const versions = new Set([...Object.keys(aliasesByVersion), ...observations.map(row => row.modelVersion)]);
  const owners = new Map<string, Set<string>>();
  const exactOwners = new Map<string, Set<string>>();
  const addOwner = (map: Map<string, Set<string>>, alias: string, version: string) => {
    const values = map.get(alias) ?? new Set<string>();
    values.add(version);
    map.set(alias, values);
  };
  for (const version of versions) {
    for (const alias of forms(version)) addOwner(exactOwners, alias, version);
    for (const alias of [version, ...(aliasesByVersion[version] ?? [])].flatMap(forms)) {
      addOwner(owners, alias, version);
    }
  }
  const groups = new Map<string, Map<string, EpochObservation[]>>();
  const unitSets = new Map<string, Set<string>>();
  for (const observation of observations) {
    if (observation.value === null || !Number.isFinite(observation.value)) continue;
    const displayUnit = observation.unit === 'fraction' ? 'percent' : observation.unit;
    const units = unitSets.get(observation.benchmarkSlug) ?? new Set<string>();
    units.add(displayUnit + ':' + (observation.metricKey ?? 'unknown'));
    unitSets.set(observation.benchmarkSlug, units);
    const aliases = new Set([observation.modelVersion, ...(aliasesByVersion[observation.modelVersion] ?? [])]
      .flatMap(value => { const normalized = key(value); return normalized ? [normalized, normalized.replace(/\s+/g, '')] : []; }));
    for (const alias of aliases) {
      const exact = exactOwners.get(alias);
      if (exact?.size === 1 ? !exact.has(observation.modelVersion) : (owners.get(alias)?.size ?? 0) !== 1) continue;
      let benchmarks = groups.get(alias);
      if (!benchmarks) { benchmarks = new Map(); groups.set(alias, benchmarks); }
      const rows = benchmarks.get(observation.benchmarkSlug) ?? [];
      rows.push(observation);
      benchmarks.set(observation.benchmarkSlug, rows);
    }
  }
  const units: Record<string, 'native' | 'percent' | 'mixed'> = Object.fromEntries(
    [...unitSets].map(([slug, values]) => [slug, values.size === 1
      ? ([...values][0].startsWith('percent:') ? 'percent' : 'native') : 'mixed']));
  const scores: Array<[string, Record<string, number>]> = [];
  const ambiguities: Array<[string, Record<string, number>]> = [];
  const receipts: Array<[string, Record<string, EpochObservation>]> = [];
  for (const [alias, benchmarks] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const values: Array<[string, number]> = [];
    const conflicts: Array<[string, number]> = [];
    const evidence: Array<[string, EpochObservation]> = [];
    for (const [benchmark, rows] of [...benchmarks].sort(([a], [b]) => a.localeCompare(b))) {
      if (rows.length !== 1 || units[benchmark] === 'mixed') { conflicts.push([benchmark, rows.length]); continue; }
      const row = rows[0];
      values.push([benchmark, row.value! * (row.unit === 'fraction' ? 100 : 1)]);
      evidence.push([benchmark, row]);
    }
    if (values.length) {
      scores.push([alias, Object.fromEntries(values)]);
      receipts.push([alias, Object.fromEntries(evidence)]);
    }
    if (conflicts.length) ambiguities.push([alias, Object.fromEntries(conflicts)]);
  }
  return { scores: Object.fromEntries(scores), ambiguities: Object.fromEntries(ambiguities),
    receipts: Object.fromEntries(receipts), units };
}

export function fromEpochRuns(runs: EpochBenchmarkRun[], fetchedAt: string | null = null): EpochObservation[] {
  return runs.map(run => ({
    id: run.id, modelVersion: run.model_version,
    benchmarkSlug: run.benchmark_slug ?? run.benchmark_id,
    metricKey: run.score_metric ?? null,
    unit: run.score_unit ?? (/percent|%/i.test(run.score_metric ?? '') ? 'percent' : 'native'),
    value: parseFiniteMetricValue(run.score), conditions: run.conditions ?? null,
    evaluationDate: run.evaluation_date ?? null, sourceUrl: run.source_link ?? null,
    fetchedAt, snapshotId: null,
  }));
}

export function comparisonEvidenceDate(model: object, metricKey: string, receipt?: EpochObservation): {
  kind: 'evaluated' | 'retrieved' | 'observed' | 'unknown'; value: string | null;
} {
  const valid = (value: unknown): value is string =>
    typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (metricKey.startsWith('epoch_')) {
    if (valid(receipt?.evaluationDate)) return { kind: 'evaluated', value: receipt.evaluationDate };
    if (valid(receipt?.fetchedAt)) return { kind: 'retrieved', value: receipt.fetchedAt };
    return { kind: 'unknown', value: null };
  }
  const value = (model as Record<string, unknown>).last_seen;
  return valid(value) ? { kind: 'observed', value } : { kind: 'unknown', value: null };
}

export function priceChartMaximum(values: Array<number | null>): number {
  const maximum = Math.max(0, ...values.filter((value): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0));
  return maximum > 0 ? Math.min(Number.MAX_VALUE, maximum * 1.2) : 1;
}
