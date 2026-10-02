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
