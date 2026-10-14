export type SuggestionPoint = {
  id: string;
  modelId: string;
  x: number;
  y: number;
  provider?: string;
  family: string;
  cohortKey: string | null;
  indexVersion: string | null;
};

function compareVersions(leftVersion: string, rightVersion: string): number {
  const left = leftVersion.split('.').map(Number);
  const right = rightVersion.split('.').map(Number);

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return leftVersion.localeCompare(rightVersion);
}

function qualityOrder(
  left: SuggestionPoint,
  right: SuggestionPoint,
  direction: 'min' | 'max',
): number {
  return right.y - left.y
    || (direction === 'min' ? left.x - right.x : right.x - left.x)
    || left.modelId.localeCompare(right.modelId);
}

function isValidPoint(point: SuggestionPoint): boolean {
  return Number.isFinite(point.x)
    && point.x >= 0
    && Number.isFinite(point.y)
    && Boolean(point.cohortKey)
    && typeof point.indexVersion === 'string'
    && /^\d+(?:\.\d+)*$/.test(point.indexVersion);
}

/** Return deterministic, measured-only suggestions from one latest compatible cohort. */
export function suggestedModelFrontier(
  points: SuggestionPoint[],
  direction: 'min' | 'max' = 'min',
  limit = 100,
): { modelIds: string[]; totalFrontierModels: number; truncated: boolean } {
  const size = Math.max(0, Math.min(100, Math.floor(limit)));
  if (size === 0) return { modelIds: [], totalFrontierModels: 0, truncated: false };

  const validPoints = points.filter(isValidPoint);
  const latestVersion = validPoints
    .map(point => point.indexVersion!)
    .sort(compareVersions)
    .at(-1);
  const latestPoints = validPoints.filter(point => point.indexVersion === latestVersion);
  const cohorts = new Map<string, SuggestionPoint[]>();

  for (const point of latestPoints) {
    const cohort = cohorts.get(point.cohortKey!) ?? [];
    cohort.push(point);
    cohorts.set(point.cohortKey!, cohort);
  }

  const chosenCohort = [...cohorts]
    .sort(([leftKey, left], [rightKey, right]) =>
      right.length - left.length || leftKey.localeCompare(rightKey))[0]?.[1] ?? [];
  const rows = [...new Map(
    chosenCohort
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(point => [point.modelId, point]),
  ).values()];
  const frontier = rows
    .filter(point => !rows.some(other =>
      other.modelId !== point.modelId
      && (direction === 'min' ? other.x <= point.x : other.x >= point.x)
      && other.y >= point.y
      && (other.x !== point.x || other.y !== point.y)))
    .sort((left, right) => qualityOrder(left, right, direction));
  return {
    modelIds: frontier.slice(0, size).map(point => point.modelId),
    totalFrontierModels: frontier.length,
    truncated: frontier.length > size,
  };
}

export function suggestedModels(points: SuggestionPoint[], direction: 'min' | 'max' = 'min', limit = 100): string[] {
  return suggestedModelFrontier(points, direction, limit).modelIds;
}
