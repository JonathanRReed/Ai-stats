/**
 * Build-time selection of the daily game's chart points and candidate pool.
 * Pure: the page passes in the catalog records it already loaded.
 */
import { isAutomaticCandidate } from './automatic-selection';
import type { ExplorerModel } from './compare-series';
import { familySlug } from './site-routes';
import { placeablePool, type GameAxis, type GameCandidate, type GameData, type GamePoint } from './daily-game';

/** Families from the top of the Index ranking only, so answers are recognisable. */
export const GAME_POOL_SIZE = 60;
/** Cost per task is the primary axis; below this many measured records the chart falls back to blended price. */
export const MIN_TASK_COST_RECORDS = 20;

const finitePositive = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isoDay = (value: string | null | undefined): string | null =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(Date.parse(value.slice(0, 10))) ? value.slice(0, 10) : null;

export type ReleaseSource = { id: string; source_metadata?: { release_date?: string | null } | null };

export function buildGameData(records: ExplorerModel[], releases: ReleaseSource[], pagePaths: Map<string, string>, poolSize = GAME_POOL_SIZE): GameData {
  const measured = records.filter((model) => model.source === 'aa' && model.current === true && typeof model.intelligence === 'number' && Number.isFinite(model.intelligence));
  // One Index version per chart: the most common numeric version, ties to the newest.
  const versions = new Map<string, number>();
  for (const model of measured) if (model.indexVersion && /^\d+(?:\.\d+)*$/.test(model.indexVersion)) versions.set(model.indexVersion, (versions.get(model.indexVersion) ?? 0) + 1);
  const indexVersion = [...versions].sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0]?.[0] ?? null;
  const cohort = indexVersion ? measured.filter((model) => model.indexVersion === indexVersion) : measured;
  const paid = cohort.filter(isAutomaticCandidate);
  const axis: GameAxis = paid.filter((model) => finitePositive(model.aaTaskCost)).length >= MIN_TASK_COST_RECORDS ? 'task-cost' : 'blended-price';
  const xOf = (model: ExplorerModel) => (axis === 'task-cost' ? model.aaTaskCost : model.priceBlended);
  const releaseById = new Map(releases.map((row) => [row.id, isoDay(row.source_metadata?.release_date)]));

  // Family keys: slug of the family name, qualified by lab only when two labs share a name.
  const labsByFamily = new Map<string, Set<string>>();
  for (const model of cohort) labsByFamily.set(model.family, (labsByFamily.get(model.family) ?? new Set()).add(model.provider ?? 'Unknown'));
  // "+" is spelled out so that "Command A" and "Command A+" stay two answers, as they do on the matchup pages.
  const spelled = (family: string) => family.replace(/\+/g, ' plus ');
  const keyOf = (model: ExplorerModel) => (labsByFamily.get(model.family)!.size > 1 ? familySlug(`${spelled(model.family)} ${model.provider ?? ''}`) : familySlug(spelled(model.family)));

  const plotted = paid.filter((model) => finitePositive(xOf(model)));
  const points: GamePoint[] = plotted.map((model) => ({ id: model.id, family: keyOf(model), x: xOf(model)!, y: model.intelligence!, release: releaseById.get(model.id) ?? null }));

  const reasoningByFamily = new Map<string, Set<string>>();
  for (const model of cohort) reasoningByFamily.set(keyOf(model), (reasoningByFamily.get(keyOf(model)) ?? new Set()).add(model.reasoning ?? 'unknown'));
  const representative = new Map<string, ExplorerModel>();
  for (const model of plotted) {
    const key = keyOf(model), current = representative.get(key);
    if (!current || model.intelligence! > current.intelligence! || (model.intelligence === current.intelligence && xOf(model)! < xOf(current)!)) representative.set(key, model);
  }
  const candidates: GameCandidate[] = [...representative].map(([key, model]) => ({
    key, family: model.family, name: model.name, provider: model.provider ?? 'Unknown', index: model.intelligence!, cost: xOf(model)!,
    blendedPrice: finitePositive(model.priceBlended) ? model.priceBlended : null,
    speed: finitePositive(model.outputSpeed) ? model.outputSpeed : null,
    release: releaseById.get(model.id) ?? null,
    reasoningLevels: reasoningByFamily.get(key)?.size ?? 1,
    path: pagePaths.get(model.id) ?? null, pointId: model.id,
  })).sort((a, b) => b.index - a.index || a.key.localeCompare(b.key)).slice(0, poolSize);

  const dates = plotted.map((model) => isoDay(model.observedAt)).filter((value): value is string => value !== null).sort();
  return { axis, indexVersion, dataDate: dates.at(-1) ?? null, points, candidates, placeable: placeablePool(candidates, points).map((candidate) => candidate.key) };
}
