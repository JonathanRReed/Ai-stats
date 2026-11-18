import { expect, test } from "bun:test";
import type { ExplorerModel } from "./compare-series";
import { buildGameData } from "./daily-game-data";

const aa = (id: string, name: string, family: string, overrides: Partial<ExplorerModel> = {}): ExplorerModel => ({
  id, name, family, provider: "Lab", reasoning: "high", source: "aa", sourceModelId: id, current: true,
  intelligence: 40, aaTaskCost: 1, priceBlended: 2, priceInput: 1, priceOutput: 4, outputSpeed: 90,
  indexVersion: "5", observedAt: "2026-11-10T00:00:00Z", ...overrides,
});

test("one candidate per family, represented by its highest-Index record", () => {
  const data = buildGameData([
    aa("a-low", "Alpha (Low)", "Alpha", { intelligence: 30, reasoning: "low" }),
    aa("a-max", "Alpha (Max)", "Alpha", { intelligence: 50, reasoning: "max", aaTaskCost: 3 }),
    aa("b", "Beta", "Beta", { intelligence: 45, provider: "Other", observedAt: "2026-11-12T08:00:00Z" }),
  ], [{ id: "a-max", source_metadata: { release_date: "2026-09-01" } }], new Map([["a-max", "/models/alpha-max"]]));
  expect(data.axis).toBe("blended-price");
  expect(data.candidates.map((item) => item.key)).toEqual(["alpha", "beta"]);
  expect(data.candidates[0]).toMatchObject({ pointId: "a-max", index: 50, reasoningLevels: 2, release: "2026-09-01", path: "/models/alpha-max", cost: 2 });
  expect(data.candidates[1]).toMatchObject({ release: null, path: null });
  expect(data.points).toHaveLength(3);
  expect(data.dataDate).toBe("2026-11-12");
});

test("free, historical, unmeasured and other-version records are left out; missing values stay missing", () => {
  const data = buildGameData([
    aa("free", "Free", "Free", { priceBlended: 0, priceInput: 0, priceOutput: 0 }),
    aa("old", "Old", "Old", { current: false }),
    aa("none", "None", "None", { intelligence: null }),
    aa("v4", "Four", "Four", { indexVersion: "4" }),
    aa("slow", "Slow", "Slow", { outputSpeed: null, priceBlended: null }),
    aa("epoch", "Epoch", "Epoch", { source: "epoch" }),
  ], [], new Map());
  expect(data.candidates.map((item) => item.key)).toEqual([]);
  expect(data.indexVersion).toBe("5");
});

test("cost per task is the axis once enough records have it, and the pool is capped by Index", () => {
  const rows = Array.from({ length: 25 }, (_, index) => aa(`m${index}`, `Model ${index}`, `Model ${index}`, { intelligence: index, aaTaskCost: index + 1 }));
  const data = buildGameData(rows, [], new Map(), 10);
  expect(data.axis).toBe("task-cost");
  expect(data.candidates).toHaveLength(10);
  expect(data.candidates[0]).toMatchObject({ key: "model-24", cost: 25, speed: 90 });
  expect(data.points).toHaveLength(25);
});

test("same family name from two labs stays two candidates", () => {
  const data = buildGameData([aa("x", "Twin", "Twin", { provider: "A" }), aa("y", "Twin", "Twin", { provider: "B", intelligence: 41 })], [], new Map());
  expect(data.candidates.map((item) => item.key).sort()).toEqual(["twin-a", "twin-b"]);
});
