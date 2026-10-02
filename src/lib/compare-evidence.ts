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

/** Compatibility scalar map: ambiguity is unavailable, never an arbitrary winner. */
export function buildEpochScoreIndex(
  observations: EpochObservation[],
  aliasesByVersion: Record<string, string[]>,
): { scores: Record<string, Record<string, number>>; ambiguities: Record<string, Record<string, number>> } {
  const groups = new Map<string, Map<string, EpochObservation[]>>();
  for (const observation of observations) {
    if (observation.value === null || !Number.isFinite(observation.value)) continue;
    const aliases = new Set([observation.modelVersion, ...(aliasesByVersion[observation.modelVersion] ?? [])]
      .flatMap(value => { const normalized = key(value); return normalized ? [normalized, normalized.replace(/\s+/g, '')] : []; }));
    for (const alias of aliases) {
      let benchmarks = groups.get(alias);
      if (!benchmarks) { benchmarks = new Map(); groups.set(alias, benchmarks); }
      const rows = benchmarks.get(observation.benchmarkSlug) ?? [];
      rows.push(observation);
      benchmarks.set(observation.benchmarkSlug, rows);
    }
  }
  const scores: Array<[string, Record<string, number>]> = [];
  const ambiguities: Array<[string, Record<string, number>]> = [];
  for (const [alias, benchmarks] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const values: Array<[string, number]> = [];
    const conflicts: Array<[string, number]> = [];
    for (const [benchmark, rows] of [...benchmarks].sort(([a], [b]) => a.localeCompare(b))) {
      if (rows.length !== 1) { conflicts.push([benchmark, rows.length]); continue; }
      const row = rows[0];
      values.push([benchmark, row.value! * (row.unit === 'fraction' ? 100 : 1)]);
    }
    if (values.length) scores.push([alias, Object.fromEntries(values)]);
    if (conflicts.length) ambiguities.push([alias, Object.fromEntries(conflicts)]);
  }
  return { scores: Object.fromEntries(scores), ambiguities: Object.fromEntries(ambiguities) };
}
