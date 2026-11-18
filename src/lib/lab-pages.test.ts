import { expect, test } from "bun:test";
import { buildLabChart, buildLabPage, buildLabPages, buildTimeline, chooseCostAxis, groupFamilies, labModel, type LabModel } from "./lab-pages";
import type { ModelPageRecord } from "./model-pages";

const record = (id: string, name: string, provider: string, index: number | null, blended: number | null = 2) => ({
  id, slug: id, name, provider, path: `/models/${id}`, lastSeenDate: "2026-11-01",
  pricing: [
    { key: "price_1m_input_tokens", label: "", value: 1, unit: "USD", source: "Artificial Analysis" },
    { key: "price_1m_output_tokens", label: "", value: 4, unit: "USD", source: "Artificial Analysis" },
    { key: "price_1m_blended_3_to_1", label: "", value: blended, unit: "USD", source: "Artificial Analysis" },
  ],
  speed: [{ key: "median_output_tokens_per_second", label: "", value: 80, unit: "tokens per second", source: "Artificial Analysis" }],
  context: [{ key: "openrouter_context_length", label: "", value: null, unit: "tokens", source: "OpenRouter" }],
  indexes: [{ key: "aa_intelligence_index", label: "", value: index, unit: "points", source: "Artificial Analysis" }],
}) as unknown as ModelPageRecord;

const model = (id: string, family: string, reasoning: string, index: number | null, taskCost: number | null, blendedPrice: number | null = 2, releaseDate: string | null = null): LabModel => ({
  id, name: id, path: `/models/${id}`, family, reasoning, index, inputPrice: null, outputPrice: null, blendedPrice, taskCost,
  speed: null, context: null, releaseDate, indexVersion: "5",
});

test("one page per provider, each grouping its families in reasoning order", () => {
  const pages = buildLabPages([
    record("a-high", "Alpha (High)", "Lab A", 50), record("a-low", "Alpha (Low)", "Lab A", 40), record("b", "Beta", "Lab A", 30),
    record("z", "Zeta", "Lab Z", null),
  ]);
  expect(pages.map((page) => [page.provider, page.path, page.models.length])).toEqual([["Lab A", "/labs/lab-a", 3], ["Lab Z", "/labs/lab-z", 1]]);
  expect(pages[0].families.map((family) => [family.family, family.models.map((m) => m.reasoning)])).toEqual([["Alpha", ["low", "high"]], ["Beta", ["unknown"]]]);
  expect(pages[0].indexRange).toEqual({ min: 30, max: 50 });
  expect(pages[1].indexRange).toBeNull();
});

test("providers that share a URL fail the build instead of overwriting a page", () => {
  expect(() => buildLabPages([record("a", "A", "Z AI", 1), record("b", "B", "Z.AI", 1)])).toThrow();
});

test("missing values stay missing", () => {
  const row = labModel(record("x", "X", "Lab", null, null));
  expect(row.index).toBeNull();
  expect(row.blendedPrice).toBeNull();
  expect(row.context).toBeNull();
  expect(row.taskCost).toBeNull();
  expect(row.releaseDate).toBeNull();
});

test("the cost axis is task cost when most indexed models have it, never a mix", () => {
  expect(chooseCostAxis([model("a", "A", "low", 40, 1), model("b", "A", "high", 50, 2), model("c", "C", "none", 30, null)])).toBe("task");
  expect(chooseCostAxis([model("a", "A", "low", 40, 1), model("b", "A", "high", 50, null), model("c", "C", "none", 30, null)])).toBe("blended");
  expect(chooseCostAxis([model("a", "A", "low", null, 1)])).toBeNull();
});

test("chart lines join a family's reasoning levels and name what is left off", () => {
  const families = groupFamilies([
    model("a-high", "A", "high", 50, 4), model("a-low", "A", "low", 40, 1), model("b", "B", "none", 30, null), model("c", "C", "none", null, 1),
  ]);
  const chart = buildLabChart(families)!;
  expect(chart.axis).toBe("task");
  expect(chart.lines).toEqual([{ family: "A", points: [
    { id: "a-low", name: "a-low", reasoning: "low", x: 1, y: 40 },
    { id: "a-high", name: "a-high", reasoning: "high", x: 4, y: 50 },
  ] }]);
  expect(chart.omitted.map((row) => [row.model.id, row.reason])).toEqual([["b", "No cost per task recorded"]]);
});

test("the timeline runs newest first by year and keeps undated models apart", () => {
  const { years, undated } = buildTimeline([
    model("old", "A", "none", 10, null, 2, "2024-05-01"), model("new", "A", "none", 20, null, 2, "2025-03-01"),
    model("newer", "A", "none", null, null, 2, "2025-09-01"), model("nodate", "A", "none", 15, null),
  ]);
  expect(years.map((year) => [year.year, year.models.map((m) => m.id)])).toEqual([["2025", ["newer", "new"]], ["2024", ["old"]]]);
  expect(undated.map((m) => m.id)).toEqual(["nodate"]);
});

test("a lab page reads its newest release from recorded dates only", () => {
  const page = buildLabPage("Lab", [record("a", "A", "Lab", 10), record("b", "B", "Lab", 20)], new Map([["a", { releaseDate: "2025-01-02T00:00:00Z", taskCost: 3, indexVersion: "5" }]]));
  expect(page.newestRelease).toBe("2025-01-02");
  expect(page.undated.map((m) => m.id)).toEqual(["b"]);
  expect(page.indexVersions).toEqual(["5"]);
});
