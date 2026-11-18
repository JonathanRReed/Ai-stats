/**
 * Build-time loader for the "Where it sits" chart and the lists beside it.
 *
 * Every model page shares the same background: all current AA records in one cohort, their
 * Pareto line, and the axes. That geometry is computed once per (cost measure, cohort) and
 * cached for the whole build; each page only adds its own family line and ringed point.
 */
import { getModelCatalogData } from "./model-catalog-data";
import { getModelPageRecords } from "./model-pages-data";
import { plotGeometry } from "./compare-geometry";
import { modelPagePath } from "./model-pages";
import {
  chooseCostMeasure,
  COST_MEASURES,
  familyLine,
  findDominators,
  paretoIds,
  positionCounts,
  positionPopulations,
  positionSummary,
  toPositionPoint,
  toPositionRecord,
  type Comparison,
  type CostMeasure,
  type PositionPoint,
  type PositionRecord,
} from "./model-position";
import { higherScoreAtSimilarCost, similarScoreForLess } from "./model-alternatives";

export type ChartSize = "wide" | "narrow";

/** Wide fits beside the lists on desktop; narrow is drawn at phone width so text stays 11px. */
export const CHART_SIZES: Record<ChartSize, { width: number; height: number; top: number; right: number; left: number }> = {
  wide: { width: 720, height: 400, top: 16, right: 20, left: 52 },
  narrow: { width: 358, height: 320, top: 16, right: 12, left: 40 },
};

type Plotted = { id: string; cx: number; cy: number };
type Tick = { value: number; label: string; position: number };

export type SharedChart = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  xTicks: Tick[];
  yTicks: Tick[];
  dots: Plotted[];
  positions: Map<string, Plotted>;
  /** "x,y x,y" for the dashed Pareto polyline. */
  frontierPath: string;
};

type Group = {
  measure: CostMeasure;
  population: PositionPoint[];
  frontier: Set<string>;
  charts: Record<ChartSize, SharedChart>;
  /** Latest AA observation date in the cohort, YYYY-MM-DD. */
  dataDate: string | null;
};

export type ModelPosition = {
  measure: CostMeasure;
  measureLabel: string;
  axisLabel: string;
  unit: string;
  name: string;
  index: number;
  cost: number;
  indexVersion: string | null;
  onFrontier: boolean;
  summary: string;
  dataDate: string | null;
  cohortSize: number;
  family: string;
  familyCount: number;
  charts: Record<ChartSize, SharedChart & { familyPath: string | null; target: Plotted }>;
  dominators: { total: number; items: Comparison[] };
  cheaperSimilar: Comparison[];
  higherSimilar: Comparison[];
  pathById: Map<string, string>;
};

const isoDay = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const path = (points: Plotted[]): string => points.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(" ");

function buildChart(population: PositionPoint[], frontierIds: string[], size: ChartSize): SharedChart {
  const s = CHART_SIZES[size];
  const geometry = plotGeometry(
    population.map((p) => ({ id: p.id, x: p.x, y: p.y })),
    "scatter",
    "log",
    s.width,
    s.height,
    s.top,
    s.right,
    s.left,
  );
  const dots = geometry.points.map(({ id, cx, cy }) => ({ id, cx, cy }));
  const positions = new Map(dots.map((dot) => [dot.id, dot]));
  const frontier = frontierIds.map((id) => positions.get(id)).filter((p): p is Plotted => p !== undefined);
  return {
    width: geometry.width,
    height: geometry.height,
    left: geometry.left,
    right: geometry.right,
    top: geometry.top,
    bottom: geometry.bottom,
    xTicks: geometry.xTicks,
    yTicks: geometry.yTicks,
    dots,
    positions,
    frontierPath: path(frontier),
  };
}

type Context = {
  records: Map<string, PositionRecord>;
  populations: Record<CostMeasure, Map<string, PositionPoint[]>>;
  groups: Map<string, Group>;
  pathById: Map<string, string>;
};

async function loadContext(): Promise<Context> {
  const [catalog, pages] = await Promise.all([getModelCatalogData(), getModelPageRecords()]);
  const current = catalog.records.filter((model) => model.source === "aa" && model.current === true).map(toPositionRecord);
  const pathById = new Map(pages.map((page) => [page.id, page.path]));
  // Fall back to the AA slug when a catalog row has no page record of its own.
  for (const model of catalog.records) {
    if (model.source === "aa" && model.slug && !pathById.has(model.id)) pathById.set(model.id, modelPagePath(model.slug));
  }
  return {
    records: new Map(current.map((record) => [record.id, record])),
    populations: { task: positionPopulations(current, "task"), blended: positionPopulations(current, "blended") },
    groups: new Map(),
    pathById,
  };
}

let context: Promise<Context> | undefined;
const getContext = () => (context ??= loadContext().catch((error) => { context = undefined; throw error; }));

function groupFor(ctx: Context, measure: CostMeasure, cohortKey: string): Group {
  const key = `${measure}|${cohortKey}`;
  const cached = ctx.groups.get(key);
  if (cached) return cached;
  const population = ctx.populations[measure].get(cohortKey) ?? [];
  const frontierIds = paretoIds(population);
  const dates = population.map((p) => isoDay(p.record.observedAt)).filter((d): d is string => d !== null).sort();
  const group: Group = {
    measure,
    population,
    frontier: new Set(frontierIds),
    charts: { wide: buildChart(population, frontierIds, "wide"), narrow: buildChart(population, frontierIds, "narrow") },
    dataDate: dates.at(-1) ?? null,
  };
  ctx.groups.set(key, group);
  return group;
}

/** Null when the record has no Index or no positive cost: the page then omits the section. */
export async function getModelPosition(recordId: string): Promise<ModelPosition | null> {
  const ctx = await getContext();
  const record = ctx.records.get(recordId);
  if (!record) return null;
  const measure = chooseCostMeasure(record);
  if (!measure) return null;
  const target = toPositionPoint(record, measure)!;
  const group = groupFor(ctx, measure, target.cohortKey);
  const line = familyLine(target, group.population);
  const dominators = findDominators(target, group.population, 6);
  const withFamily = (chart: SharedChart) => {
    const members = line.map((p) => chart.positions.get(p.id)).filter((p): p is Plotted => p !== undefined);
    return { ...chart, familyPath: members.length > 1 ? path(members) : null, target: chart.positions.get(target.id)! };
  };
  return {
    measure,
    measureLabel: COST_MEASURES[measure].label,
    axisLabel: COST_MEASURES[measure].axis,
    unit: COST_MEASURES[measure].unit,
    name: record.name,
    index: target.y,
    cost: target.x,
    indexVersion: record.indexVersion,
    onFrontier: group.frontier.has(target.id),
    summary: positionSummary(record.name, positionCounts(target, group.population), measure),
    dataDate: group.dataDate,
    cohortSize: group.population.length,
    family: record.family,
    familyCount: line.length,
    charts: { wide: withFamily(group.charts.wide), narrow: withFamily(group.charts.narrow) },
    dominators: { total: dominators.total, items: dominators.nearest },
    cheaperSimilar: similarScoreForLess(target, group.population),
    higherSimilar: higherScoreAtSimilarCost(target, group.population),
    pathById: ctx.pathById,
  };
}
