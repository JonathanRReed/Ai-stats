import { paretoFrontiers, type ExplorerModel } from "./compare-series";
import { reasoningRank } from "./compare-family-lines";

/**
 * Where one model page sits against every current AA record on two measures:
 * the AA Intelligence Index (higher is better) and a cost (lower is better).
 *
 * Pure functions only. The build-time loader (model-position-data.ts) feeds them
 * the catalog once per build, and the tests feed them fixtures.
 */

export type CostMeasure = "task" | "blended";

export const COST_MEASURES: Record<CostMeasure, { label: string; axis: string; short: string; unit: string }> = {
  task: { label: "Cost per task", axis: "Cost per AA Index task (USD, log scale)", short: "cost per task", unit: "per task" },
  blended: {
    label: "Blended token price",
    axis: "Blended price (USD per 1M tokens, 3:1 input/output, log scale)",
    short: "blended token price",
    unit: "per 1M tokens",
  },
};

export type PositionRecord = {
  id: string;
  name: string;
  provider: string;
  family: string;
  reasoning: string;
  index: number | null;
  taskCost: number | null;
  blendedPrice: number | null;
  indexVersion: string | null;
  performancePrompt: string | null;
  observedAt: string | null;
};

export type PositionPoint = { id: string; x: number; y: number; cohortKey: string; record: PositionRecord };

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const orNull = (value: number | null | undefined): number | null => (finite(value) ? value : null);

export function toPositionRecord(model: ExplorerModel): PositionRecord {
  return {
    id: model.id,
    name: model.name,
    provider: model.provider ?? model.family,
    family: model.family,
    reasoning: model.reasoning ?? "unknown",
    index: orNull(model.intelligence),
    taskCost: orNull(model.aaTaskCost),
    blendedPrice: orNull(model.priceBlended),
    indexVersion: model.indexVersion ?? null,
    performancePrompt: model.performancePrompt ?? null,
    observedAt: model.observedAt ?? null,
  };
}

/**
 * The same cohort rule as buildCompareSeries for cost charts: records compare only within
 * one verified AA index version and performance prompt. Unversioned records join no cohort.
 */
export function positionCohortKey(record: Pick<PositionRecord, "indexVersion" | "performancePrompt">): string | null {
  if (typeof record.indexVersion !== "string" || !/^\d+(?:\.\d+)*$/.test(record.indexVersion)) return null;
  return `${record.indexVersion}:${record.performancePrompt ?? "unknown"}`;
}

export const costOf = (record: PositionRecord, measure: CostMeasure): number | null =>
  measure === "task" ? record.taskCost : record.blendedPrice;

/**
 * A record can be placed when it has an Index, a positive cost and a cohort.
 * A recorded cost of zero cannot sit on a log axis and is not treated as free.
 */
export function toPositionPoint(record: PositionRecord, measure: CostMeasure): PositionPoint | null {
  const cost = costOf(record, measure);
  const cohortKey = positionCohortKey(record);
  if (!finite(record.index) || !finite(cost) || cost <= 0 || !cohortKey) return null;
  return { id: record.id, x: cost, y: record.index, cohortKey, record };
}

/** Cost per task when AA recorded one for this record, otherwise the blended token price. */
export function chooseCostMeasure(record: PositionRecord): CostMeasure | null {
  if (toPositionPoint(record, "task")) return "task";
  if (toPositionPoint(record, "blended")) return "blended";
  return null;
}

/** Every placeable record in one measure, grouped by cohort. */
export function positionPopulations(records: PositionRecord[], measure: CostMeasure): Map<string, PositionPoint[]> {
  const groups = new Map<string, PositionPoint[]>();
  for (const record of records) {
    const point = toPositionPoint(record, measure);
    if (!point) continue;
    const group = groups.get(point.cohortKey) ?? [];
    group.push(point);
    groups.set(point.cohortKey, group);
  }
  return groups;
}

/** a dominates b: Index at least as high and cost no higher, strictly better on one. */
export function dominates(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return a.y >= b.y && a.x <= b.x && (a.y > b.y || a.x < b.x);
}

/** Pareto ids for one cohort, in ascending cost. */
export function paretoIds(population: PositionPoint[]): string[] {
  const groups = paretoFrontiers(population, "min");
  return Object.values(groups).flat();
}

export type FamilyKeyed = Pick<PositionRecord, "provider" | "family">;
export const familyKey = (record: FamilyKeyed): string => JSON.stringify([record.provider, record.family]);

/** Other reasoning levels of the target's family in the same population, in ascending effort. */
export function familyLine(target: PositionPoint, population: PositionPoint[]): PositionPoint[] {
  const key = familyKey(target.record);
  const members = population.filter((point) => point.cohortKey === target.cohortKey && familyKey(point.record) === key);
  return members.sort(
    (a, b) => reasoningRank(a.record.reasoning) - reasoningRank(b.record.reasoning) || a.x - b.x || a.id.localeCompare(b.id),
  );
}

export type Comparison = {
  point: PositionPoint;
  /** Index points above (positive) or below (negative) the target. */
  indexGap: number;
  /** This record's cost divided by the target's cost. */
  costRatio: number;
  /** Distance on the chart: Index and log cost, each scaled by the population's span. */
  distance: number;
};

const spans = (population: PositionPoint[]) => {
  const ys = population.map((point) => point.y);
  const xs = population.map((point) => Math.log10(point.x));
  return {
    y: Math.max(Math.max(...ys) - Math.min(...ys), 1e-9),
    x: Math.max(Math.max(...xs) - Math.min(...xs), 1e-9),
  };
};

export function compareTo(target: PositionPoint, point: PositionPoint, population: PositionPoint[]): Comparison {
  const span = spans(population.length ? population : [target, point]);
  const dy = (point.y - target.y) / span.y;
  const dx = (Math.log10(point.x) - Math.log10(target.x)) / span.x;
  return { point, indexGap: point.y - target.y, costRatio: point.x / target.x, distance: Math.hypot(dx, dy) };
}

/** Records in the target's cohort that dominate it, nearest on the chart first. */
export function findDominators(target: PositionPoint, population: PositionPoint[], limit = 6): { total: number; nearest: Comparison[] } {
  const peers = population.filter((point) => point.cohortKey === target.cohortKey && point.id !== target.id);
  const beating = peers.filter((point) => dominates(point, target)).map((point) => compareTo(target, point, peers.concat(target)));
  beating.sort((a, b) => a.distance - b.distance || b.indexGap - a.indexGap || a.point.id.localeCompare(b.point.id));
  return { total: beating.length, nearest: beating.slice(0, Math.max(0, limit)) };
}

const trimNumber = (value: number, digits: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, useGrouping: false }).format(value);

/** "3.1 points higher, 40% of the cost" — exact differences, never rounded into a tie. */
export function describeDifference(comparison: Pick<Comparison, "indexGap" | "costRatio">): string {
  const gap = Math.abs(comparison.indexGap);
  const gapText = gap < 1e-9 ? "Same Index" : `${trimNumber(gap, gap < 0.1 ? 2 : 1)} ${gap === 1 ? "point" : "points"} ${comparison.indexGap > 0 ? "higher" : "lower"}`;
  const percent = comparison.costRatio * 100;
  let costText: string;
  if (Math.abs(comparison.costRatio - 1) < 1e-9) costText = "same cost";
  else {
    let digits = percent >= 10 ? 0 : 1;
    // Never print 100% for a cost that differs.
    while (digits < 3 && trimNumber(percent, digits) === "100") digits += 1;
    costText = `${trimNumber(percent, digits)}% of the cost`;
  }
  return `${gapText}, ${costText}`;
}

export type PositionCounts = {
  /** Placeable records in the cohort, the target included. */
  total: number;
  higher: number;
  cheaper: number;
  dominating: number;
};

export function positionCounts(target: PositionPoint, population: PositionPoint[]): PositionCounts {
  const peers = population.filter((point) => point.cohortKey === target.cohortKey && point.id !== target.id);
  return {
    total: peers.length + 1,
    higher: peers.filter((point) => point.y > target.y).length,
    cheaper: peers.filter((point) => point.x < target.x).length,
    dominating: peers.filter((point) => dominates(point, target)).length,
  };
}

const records = (count: number) => `${count} ${count === 1 ? "record" : "records"}`;

/** One or two sentences that say what the chart shows, generated from the counts. */
export function positionSummary(name: string, counts: PositionCounts, measure: CostMeasure): string {
  const short = COST_MEASURES[measure].short;
  const first = `Among ${counts.total} current Artificial Analysis records with both an Intelligence Index and a ${short}, ${counts.higher} score higher than ${name} and ${counts.cheaper} cost less.`;
  const second = counts.dominating
    ? `${records(counts.dominating)} ${counts.dominating === 1 ? "scores" : "score"} at least as high for no more, so it is not on the Pareto line.`
    : `None scores at least as high for no more, so it is on the Pareto line for these two measures.`;
  return `${first} ${second}`;
}
