export type EpochObservation = {
  id: string;
  modelVersion: string;
  benchmarkSlug: string;
  metricKey: string | null;
  unit: 'native' | 'percent' | 'fraction';
  value: number | null;
  conditions: Record<string, string | number | boolean> | null;
  evaluationDate: string | null;
  sourceUrl: string | null;
  fetchedAt: string | null;
  snapshotId: string | null;
};
export type EpochSelection = {
  modelVersion: string;
  benchmarkSlug: string;
  metricKey?: string;
  conditionKey?: string;
};

export const epochConditionKey = (conditions: EpochObservation['conditions']): string =>
  conditions === null ? 'unknown' :
    JSON.stringify(Object.entries(conditions).sort(([a], [b]) => a.localeCompare(b)));

export function selectComparableEpoch(
  observations: EpochObservation[],
  selection: EpochSelection,
): {
  observations: EpochObservation[];
  excluded: Array<{ id: string; reason: string }>;
  requiresChoice: boolean;
  hasUnknownConditions: boolean;
} {
  const selected: EpochObservation[] = [];
  const excluded: Array<{ id: string; reason: string }> = [];
  for (const observation of observations) {
    let reason: string | null = null;
    if (observation.modelVersion !== selection.modelVersion) reason = 'model';
    else if (observation.benchmarkSlug !== selection.benchmarkSlug) reason = 'benchmark';
    else if (selection.metricKey !== undefined && observation.metricKey !== selection.metricKey) reason = 'metric';
    else if (selection.conditionKey !== undefined &&
      epochConditionKey(observation.conditions) !== selection.conditionKey) reason = 'conditions';
    else if (observation.value === null || !Number.isFinite(observation.value)) reason = 'score';
    if (reason) excluded.push({ id: observation.id, reason });
    else selected.push(observation);
  }
  selected.sort((a, b) => a.id.localeCompare(b.id));
  excluded.sort((a, b) => a.id.localeCompare(b.id) || a.reason.localeCompare(b.reason));
  return {
    observations: selected,
    excluded,
    requiresChoice: selected.length > 1,
    hasUnknownConditions: selected.some(row => row.conditions === null),
  };
}
