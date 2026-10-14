import { buildCompareSeries, type CompareSeries, type ExplorerModel } from './compare-series';
import { parseCompareState } from './compare-state';

export const OVERVIEW_METRICS = ['task-cost', 'cost-intelligence'] as const;
export type OverviewMetric = typeof OVERVIEW_METRICS[number];
export const UNKNOWN_VERSION = 'unknown';
export function retainAvailableProvider(current:string,available:string[]):string{
  return current&&available.includes(current)?current:'';
}

const isKnownVersion = (value: string | null | undefined): value is string =>
  Boolean(value && /^\d+(?:\.\d+)*$/.test(value));

export function compareIndexVersions(left: string, right: string): number {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference) return difference;
  }
  return left.localeCompare(right);
}

export function overviewCohorts(models: ExplorerModel[]): string[] {
  const known = [...new Set(models.filter(model => model.source === 'aa' && model.current === true &&
    isKnownVersion(model.indexVersion)).map(model => model.indexVersion!))].sort(compareIndexVersions).reverse();
  const hasUnknown = models.some(model => model.source === 'aa' && model.current === true && !isKnownVersion(model.indexVersion));
  return [...known, ...(hasUnknown ? [UNKNOWN_VERSION] : [])];
}

export function defaultOverviewMetric(models: ExplorerModel[]): OverviewMetric {
  const latest = overviewCohorts(models).find(version => version !== UNKNOWN_VERSION);
  return latest && buildOverviewSeries(models, 'task-cost', latest).points.length > 0
    ? 'task-cost'
    : 'cost-intelligence';
}

export function buildOverviewSeries(
  models: ExplorerModel[],
  metric: OverviewMetric,
  cohort: string,
  scale: 'linear' | 'log' = 'log',
): CompareSeries {
  const inCohort = models.filter(model => model.source === 'aa' && model.current === true &&
    (cohort === UNKNOWN_VERSION ? !isKnownVersion(model.indexVersion) : model.indexVersion === cohort));
  const state = parseCompareState(new URLSearchParams(), inCohort, inCohort.map(model => model.id), metric);
  return buildCompareSeries({ models: inCohort, observations: [] }, { ...state, modelIds: inCohort.map(model => model.id), chart: metric, scale });
}

export function latestObservationDate(series: CompareSeries): string | null {
  const values = series.points.map(point => point.receipt.observedAt)
    .filter((value): value is string => Boolean(value && Number.isFinite(Date.parse(value))))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return values[0] ?? null;
}

export function overviewObservationDate(models: ExplorerModel[], cohort: string): string | null {
  const values = models.filter(model => model.source === 'aa' && model.current === true &&
    (cohort === UNKNOWN_VERSION ? !isKnownVersion(model.indexVersion) : model.indexVersion === cohort))
    .map(model => model.observedAt)
    .filter((value): value is string => Boolean(value && Number.isFinite(Date.parse(value))))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return values[0] ?? null;
}

