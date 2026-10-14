import type {EpochObservation} from './epoch-observations';

type CatalogRecord = {
  id: string;
  source?: string;
  sourceModelId?: string;
  current?: boolean | null;
};
type RankedObservation = Pick<EpochObservation, 'modelVersion' | 'value'> &
  Partial<Pick<EpochObservation, 'sourceKey' | 'unit' | 'evaluationDate' | 'id'>>;

const sourceIdentity = (row: RankedObservation) =>
  `${row.sourceKey && row.sourceKey !== 'epoch-ai' ? 'publisher' : 'epoch'}:${row.modelVersion}`;

/** Rank one score and condition cohort while keeping publisher records distinct from Epoch identities. */
export function rankedBenchmarkModels(
  catalog: CatalogRecord[],
  observations: RankedObservation[],
  limit = 8,
  higherIsBetter = true,
): string[] {
  const latest = new Map<string, RankedObservation>();
  const timestamp = (row: RankedObservation) => {
    const time = Date.parse(row.evaluationDate ?? '');
    return Number.isFinite(time) ? time : -Infinity;
  };
  for (const row of observations) {
    if (typeof row.value !== 'number' || !Number.isFinite(row.value)) continue;
    const key = sourceIdentity(row);
    const previous = latest.get(key);
    if (!previous || timestamp(row) > timestamp(previous) ||
      (timestamp(row) === timestamp(previous) && (row.id ?? '').localeCompare(previous.id ?? '') < 0)) {
      latest.set(key, row);
    }
  }
  const score = (row: RankedObservation) => row.value! * (row.unit === 'fraction' ? 100 : 1);
  return catalog
    .filter(model => model.current !== false && latest.has(`${model.source}:${model.sourceModelId}`))
    .map(model => ({model, value: score(latest.get(`${model.source}:${model.sourceModelId}`)!)}))
    .sort((a, b) => (higherIsBetter ? -1 : 1) * (a.value - b.value) || a.model.id.localeCompare(b.model.id))
    .slice(0, Math.max(0, Math.floor(limit)))
    .map(({model}) => model.id);
}

export function benchmarkConditionKey(row: Pick<EpochObservation, 'conditions'>): string {
  return row.conditions === null ? 'unknown' :
    JSON.stringify(Object.entries(row.conditions).sort(([a], [b]) => a.localeCompare(b)));
}

/** Choose the best-covered represented setting; never rank across incompatible harnesses. */
export function mostCoveredBenchmarkCondition(
  catalog: CatalogRecord[],
  observations: EpochObservation[],
): string | null {
  const groups = new Map<string, EpochObservation[]>();
  for (const row of observations) {
    const key = benchmarkConditionKey(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups]
    .map(([key, rows]) => ({key, count: rankedBenchmarkModels(catalog, rows, catalog.length).length}))
    .filter(group => group.count > 0)
    .sort((a, b) => b.count - a.count ||
      Number(a.key === 'unknown') - Number(b.key === 'unknown') || a.key.localeCompare(b.key))[0]?.key ?? null;
}
