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

function distance(
  left: SuggestionPoint,
  right: SuggestionPoint,
  scale: { unit: number; maxX: number; minY: number; maxY: number },
): number {
  const transformX = (value: number) => Math.log1p(value / scale.unit);
  const normalizedXDistance = (transformX(left.x) - transformX(right.x)) / scale.maxX;
  const normalizedYDistance = (left.y - right.y) / (scale.maxY - scale.minY);
  return normalizedXDistance ** 2 + normalizedYDistance ** 2;
}

/** Return deterministic, measured-only suggestions from one latest compatible cohort. */
export function suggestedModels(
  points: SuggestionPoint[],
  direction: 'min' | 'max' = 'min',
  limit = 8,
): string[] {
  const size = Math.max(0, Math.min(10, Math.floor(limit)));
  if (size === 0) return [];

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
  const chosen: SuggestionPoint[] = [];
  const add = (point: SuggestionPoint | undefined) => {
    if (point && chosen.length < size && !chosen.some(row => row.modelId === point.modelId)) {
      chosen.push(point);
    }
  };

  add(frontier[0]);
  add([...frontier].sort((left, right) =>
    (direction === 'min' ? left.x - right.x : right.x - left.x)
    || qualityOrder(left, right, direction))[0]);

  const positiveX = rows.filter(point => point.x > 0).map(point => point.x);
  const unit = positiveX.length ? Math.min(...positiveX) : 1;
  const transformX = (value: number) => Math.log1p(value / unit);
  const scale = {
    unit,
    maxX: Math.max(1, ...rows.map(point => transformX(point.x))),
    minY: Math.min(0, ...rows.map(point => point.y)),
    maxY: Math.max(1, ...rows.map(point => point.y)),
  };

  while (chosen.length < size) {
    const remaining = frontier.filter(point =>
      !chosen.some(row => row.modelId === point.modelId));
    if (remaining.length === 0) break;

    remaining.sort((left, right) => {
      const leftDistance = Math.min(...chosen.map(row => distance(left, row, scale)));
      const rightDistance = Math.min(...chosen.map(row => distance(right, row, scale)));
      return rightDistance - leftDistance || qualityOrder(left, right, direction);
    });
    add(remaining[0]);
  }

  while (chosen.length < size) {
    const remaining = rows.filter(point =>
      !chosen.some(row => row.modelId === point.modelId));
    if (remaining.length === 0) break;

    const providers = new Set(chosen.map(point => point.provider ?? point.family));
    const families = new Set(chosen.map(point => point.family));
    remaining.sort((left, right) =>
      Number(providers.has(left.provider ?? left.family))
        - Number(providers.has(right.provider ?? right.family))
      || Number(families.has(left.family)) - Number(families.has(right.family))
      || qualityOrder(left, right, direction));
    add(remaining[0]);
  }

  return chosen.map(point => point.modelId);
}
