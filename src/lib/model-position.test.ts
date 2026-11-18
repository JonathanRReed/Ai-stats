import { expect, test } from "bun:test";
import {
  chooseCostMeasure,
  describeDifference,
  dominates,
  familyLine,
  findDominators,
  paretoIds,
  positionCohortKey,
  positionCounts,
  positionPopulations,
  positionSummary,
  toPositionPoint,
  type PositionRecord,
} from "./model-position";

const rec = (id: string, index: number | null, taskCost: number | null, extra: Partial<PositionRecord> = {}): PositionRecord => ({
  id,
  name: id,
  provider: "Lab",
  family: id,
  reasoning: "unknown",
  index,
  taskCost,
  blendedPrice: taskCost,
  indexVersion: "5",
  performancePrompt: "long",
  observedAt: "2026-11-18T00:00:00Z",
  ...extra,
});
const point = (record: PositionRecord) => toPositionPoint(record, "task")!;

test("dominance needs at least as good on both and strictly better on one", () => {
  expect(dominates({ x: 1, y: 50 }, { x: 2, y: 40 })).toBe(true);
  expect(dominates({ x: 2, y: 50 }, { x: 2, y: 40 })).toBe(true); // same cost, higher Index
  expect(dominates({ x: 1, y: 40 }, { x: 2, y: 40 })).toBe(true); // same Index, cheaper
  expect(dominates({ x: 2, y: 40 }, { x: 2, y: 40 })).toBe(false); // exact tie
  expect(dominates({ x: 3, y: 50 }, { x: 2, y: 40 })).toBe(false); // higher but dearer
});

test("an exact tie neither dominates nor is dominated, and both stay on the Pareto line", () => {
  const population = [point(rec("a", 40, 2)), point(rec("b", 40, 2)), point(rec("c", 30, 3))];
  expect(findDominators(population[0], population).total).toBe(0);
  expect(paretoIds(population).sort()).toEqual(["a", "b"]);
  expect(findDominators(population[2], population).total).toBe(2);
});

test("cohorts never mix: a different index version or prompt cannot dominate", () => {
  const records = [
    rec("target", 40, 2),
    rec("v4", 60, 1, { indexVersion: "4" }),
    rec("short", 60, 1, { performancePrompt: "short" }),
    rec("unversioned", 60, 1, { indexVersion: null }),
    rec("peer", 45, 1.5),
  ];
  const groups = positionPopulations(records, "task");
  expect([...groups.keys()].sort()).toEqual(["4:long", "5:long", "5:short"]);
  const population = groups.get("5:long")!;
  const target = population.find((p) => p.id === "target")!;
  // Even if a caller passes a mixed list, other cohorts are ignored.
  const mixed = [...groups.values()].flat();
  expect(findDominators(target, mixed).nearest.map((c) => c.point.id)).toEqual(["peer"]);
  expect(positionCohortKey({ indexVersion: "5", performancePrompt: null })).toBe("5:unknown");
});

test("missing or zero values are not placed, and the cost measure falls back", () => {
  expect(toPositionPoint(rec("a", null, 2), "task")).toBeNull();
  expect(toPositionPoint(rec("a", 40, null), "task")).toBeNull();
  expect(toPositionPoint(rec("a", 40, 0), "task")).toBeNull();
  expect(chooseCostMeasure(rec("a", 40, 2))).toBe("task");
  expect(chooseCostMeasure(rec("a", 40, null, { blendedPrice: 3 }))).toBe("blended");
  expect(chooseCostMeasure(rec("a", 40, 0, { blendedPrice: 0 }))).toBeNull();
  expect(chooseCostMeasure(rec("a", null, 2))).toBeNull();
});

test("dominators come nearest first and respect the limit", () => {
  const target = point(rec("t", 40, 4));
  const population = [
    target,
    point(rec("far", 70, 0.5)),
    point(rec("near", 41, 3.8)),
    point(rec("mid", 50, 2)),
    point(rec("loser", 30, 5)),
  ];
  const result = findDominators(target, population, 2);
  expect(result.total).toBe(3);
  expect(result.nearest.map((c) => c.point.id)).toEqual(["near", "mid"]);
  expect(result.nearest[0].indexGap).toBeCloseTo(1);
  expect(result.nearest[0].costRatio).toBeCloseTo(0.95);
});

test("differences are written exactly", () => {
  expect(describeDifference({ indexGap: 3.1, costRatio: 0.4 })).toBe("3.1 points higher, 40% of the cost");
  expect(describeDifference({ indexGap: 0, costRatio: 0.5 })).toBe("Same Index, 50% of the cost");
  expect(describeDifference({ indexGap: 1, costRatio: 1 })).toBe("1 point higher, same cost");
  expect(describeDifference({ indexGap: 2, costRatio: 0.998 })).toBe("2 points higher, 99.8% of the cost");
  expect(describeDifference({ indexGap: -1.5, costRatio: 0.05 })).toBe("1.5 points lower, 5% of the cost");
});

test("the family line joins reasoning levels in ascending effort within the cohort", () => {
  const records = [
    rec("x-high", 50, 4, { family: "X", reasoning: "high" }),
    rec("x-low", 40, 1, { family: "X", reasoning: "low" }),
    rec("x-med", 45, 2, { family: "X", reasoning: "medium" }),
    rec("x-other-lab", 45, 2, { family: "X", provider: "Other", reasoning: "medium" }),
    rec("y", 45, 2),
  ];
  const population = positionPopulations(records, "task").get("5:long")!;
  const target = population.find((p) => p.id === "x-med")!;
  expect(familyLine(target, population).map((p) => p.id)).toEqual(["x-low", "x-med", "x-high"]);
});

test("the summary sentence follows the counts", () => {
  const target = point(rec("t", 40, 4));
  const population = [target, point(rec("a", 50, 2)), point(rec("b", 30, 1)), point(rec("c", 60, 8))];
  const counts = positionCounts(target, population);
  expect(counts).toEqual({ total: 4, higher: 2, cheaper: 2, dominating: 1 });
  expect(positionSummary("T", counts, "task")).toBe(
    "Among 4 current Artificial Analysis records with both an Intelligence Index and a cost per task, 2 score higher than T and 2 cost less. 1 record scores at least as high for no more, so it is not on the Pareto line.",
  );
  expect(positionSummary("T", { total: 4, higher: 1, cheaper: 2, dominating: 0 }, "blended")).toContain("on the Pareto line for these two measures");
});
