import { expect, test } from "bun:test";
import {
  costWindowText,
  higherScoreAtSimilarCost,
  indexWindowText,
  similarScoreForLess,
} from "./model-alternatives";
import { toPositionPoint, type PositionRecord } from "./model-position";

const rec = (id: string, index: number | null, cost: number | null, extra: Partial<PositionRecord> = {}): PositionRecord => ({
  id,
  name: id,
  provider: "Lab",
  family: id,
  reasoning: "unknown",
  index,
  taskCost: cost,
  blendedPrice: cost,
  indexVersion: "5",
  performancePrompt: "long",
  observedAt: null,
  ...extra,
});
const points = (records: PositionRecord[]) => records.map((r) => toPositionPoint(r, "task")).filter((p) => p !== null);

test("similar score for less: inclusive Index window, strictly cheaper, cheapest first", () => {
  const population = points([
    rec("t", 50, 4),
    rec("edge-up", 52, 3),
    rec("edge-down", 48, 1),
    rec("outside", 52.5, 0.5),
    rec("same-cost", 50, 4),
    rec("dearer", 50, 5),
    rec("cheap", 49, 2),
  ]);
  const ids = similarScoreForLess(population[0], population).map((c) => c.point.id);
  expect(ids).toEqual(["edge-down", "cheap", "edge-up"]);
});

test("higher score at a similar cost: inclusive 80% to 125% window, highest first", () => {
  const population = points([
    rec("t", 50, 4),
    rec("at-125", 55, 5),
    rec("at-80", 53, 3.2),
    rec("past-125", 70, 5.01),
    rec("below-80", 70, 3.19),
    rec("same-index", 50, 4.1),
    rec("lower", 49, 4),
  ]);
  const ids = higherScoreAtSimilarCost(population[0], population).map((c) => c.point.id);
  expect(ids).toEqual(["at-125", "at-80"]);
});

test("same-family reasoning levels, other cohorts and zero-cost records are left out", () => {
  const population = points([
    rec("t", 50, 4, { family: "X", reasoning: "high" }),
    rec("x-low", 49, 1, { family: "X", reasoning: "low" }),
    rec("x-other-lab", 49, 1.5, { family: "X", provider: "Other" }),
    rec("v4", 49, 1, { indexVersion: "4" }),
    rec("free", 49, 0),
    rec("missing", 49, null),
    rec("no-index", null, 1),
  ]);
  expect(similarScoreForLess(population[0], population).map((c) => c.point.id)).toEqual(["x-other-lab"]);
});

test("lists respect the limit and ties order by id", () => {
  const population = points([rec("t", 50, 4), rec("b", 51, 2), rec("a", 51, 2), rec("c", 50, 3)]);
  expect(similarScoreForLess(population[0], population, 2).map((c) => c.point.id)).toEqual(["a", "b"]);
});

test("windows are stated in words", () => {
  expect(indexWindowText()).toBe("within 2 Index points either way");
  expect(costWindowText()).toBe("between 80% and 125% of this record’s cost");
});
