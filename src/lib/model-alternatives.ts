import { compareTo, familyKey, type Comparison, type PositionPoint } from "./model-position";

/**
 * Two short lists built only from recorded values, inside windows the page states:
 * similar Index for less, and higher Index at a similar cost. Other reasoning levels of the
 * same family are left out (the reasoning-level table already lists them), and so are
 * records whose cost is zero or missing (they never become PositionPoints).
 */

/** Index window for "similar score": within this many points, either side, inclusive. */
export const INDEX_WINDOW_POINTS = 2;
/** Cost window for "similar price": between 1/ratio and ratio times this cost, inclusive. */
export const COST_WINDOW_RATIO = 1.25;
export const ALTERNATIVES_LIMIT = 5;

const EPSILON = 1e-9;

const peersOf = (target: PositionPoint, population: PositionPoint[]): PositionPoint[] => {
  const family = familyKey(target.record);
  return population.filter(
    (point) => point.cohortKey === target.cohortKey && point.id !== target.id && familyKey(point.record) !== family && point.x > 0,
  );
};

export const withinIndexWindow = (target: PositionPoint, point: PositionPoint, window = INDEX_WINDOW_POINTS): boolean =>
  Math.abs(point.y - target.y) <= window + EPSILON;

export const withinCostWindow = (target: PositionPoint, point: PositionPoint, ratio = COST_WINDOW_RATIO): boolean => {
  const relative = point.x / target.x;
  return relative <= ratio + EPSILON && relative >= 1 / ratio - EPSILON;
};

/** Index within the window and a strictly lower cost, cheapest first. */
export function similarScoreForLess(target: PositionPoint, population: PositionPoint[], limit = ALTERNATIVES_LIMIT): Comparison[] {
  const peers = peersOf(target, population);
  return peers
    .filter((point) => withinIndexWindow(target, point) && point.x < target.x)
    .sort((a, b) => a.x - b.x || b.y - a.y || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit))
    .map((point) => compareTo(target, point, peers.concat(target)));
}

/** Cost within the window and a strictly higher Index, highest first. */
export function higherScoreAtSimilarCost(target: PositionPoint, population: PositionPoint[], limit = ALTERNATIVES_LIMIT): Comparison[] {
  const peers = peersOf(target, population);
  return peers
    .filter((point) => withinCostWindow(target, point) && point.y > target.y)
    .sort((a, b) => b.y - a.y || a.x - b.x || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit))
    .map((point) => compareTo(target, point, peers.concat(target)));
}

/** "within 2 points" and "between 80% and 125%" for the page copy. */
export const indexWindowText = (window = INDEX_WINDOW_POINTS): string => `within ${window} Index ${window === 1 ? "point" : "points"} either way`;
export const costWindowText = (ratio = COST_WINDOW_RATIO): string =>
  `between ${Math.round(100 / ratio)}% and ${Math.round(ratio * 100)}% of this record’s cost`;
