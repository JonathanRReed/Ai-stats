import { expect, test } from "bun:test";
import {
  axisScale, buildLatencySpeed, buildRoutePrices, buildUsageScore, logAxis, marketLaneRoutes, relativeGap, usageTotals, type MarketRecord,
} from "./market-data";
import type { UsageSnapshot } from "./openrouter-usage";

const record = (id: string, name: string, options: { index?: number | null; openRouterId?: string | null; ttft?: number | null; speed?: number | null } = {}): MarketRecord => ({
  id, name, provider: "Lab", path: `/models/${id}`, aaSlug: id, lastSeen: "2026-11-18T13:00:00Z",
  aaEvidenceNote: "AA Index v5. Speed and latency use the AA API default, 10,000 input tokens.",
  indexes: [{ key: "aa_intelligence_index", label: "", value: options.index ?? null, unit: "points", source: "Artificial Analysis" }],
  speed: [
    { key: "median_output_tokens_per_second", label: "", value: options.speed ?? null, unit: "tokens per second", source: "Artificial Analysis" },
    { key: "median_time_to_first_token_seconds", label: "", value: options.ttft ?? null, unit: "seconds", source: "Artificial Analysis" },
  ],
  catalog: { openRouterId: options.openRouterId ?? null },
});

const snapshot = (rows: [string, string, string][]): UsageSnapshot => ({
  schemaVersion: 1, asOf: "2026-10-30T13:39:39Z", startDate: "2026-10-28", endDate: "2026-10-29", period: "day", filters: {}, estimated: false,
  rows: rows.map(([date, modelPermaslug, totalTokens]) => ({ date, modelPermaslug, totalTokens })), missingDays: [],
  sourceUrl: "https://openrouter.ai/rankings", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
});

test("usage totals sum each model's daily buckets and ignore the aggregate bucket", () => {
  const totals = usageTotals(snapshot([["2026-10-28", "a/x-2026", "100"], ["2026-10-29", "a/x-2026", "50"], ["2026-10-29", "other", "999"]]));
  expect(totals.get("a/x-2026")).toEqual({ permaslug: "a/x-2026", tokens: 150, daysListed: 2 });
  expect(totals.has("other")).toBe(false);
});

test("usage joins only through the reviewed OpenRouter id and that model's own permaslug", () => {
  const records = [
    record("bound", "Bound Model", { index: 50, openRouterId: "a/bound" }),
    record("direct", "Direct Model", { index: 40, openRouterId: "a/direct" }),
    // Same name as a usage key, but no reviewed binding: never matched by name.
    record("unbound", "x-2026", { index: 45 }),
    record("quiet", "Quiet Model", { index: 30, openRouterId: "a/quiet" }),
    record("unscored", "Unscored", { openRouterId: "a/bound" }),
  ];
  const usage = snapshot([["2026-10-28", "a/bound-20260101", "100"], ["2026-10-28", "a/direct", "10"], ["2026-10-28", "a/x-2026", "5"]]);
  const result = buildUsageScore(records, usage, [{ openrouter_id: "a/bound", canonical_slug: "a/bound-20260101" }, { openrouter_id: "a/quiet", canonical_slug: "a/quiet-2026" }]);
  expect(result.points.map((point) => [point.id, point.permaslug, point.tokens])).toEqual([["bound", "a/bound-20260101", 100], ["direct", "a/direct", 10]]);
  expect(result.scoredModels).toBe(4);
  expect(result.excluded).toEqual({ "no-openrouter-binding": 1, "not-in-usage-dataset": 1 });
  expect(result.window).toEqual({ startDate: "2026-10-28", endDate: "2026-10-29", asOf: "2026-10-30T13:39:39Z", missingDays: 0 });
});

test("with no usage snapshot every bound model is left out and nothing is invented", () => {
  const result = buildUsageScore([record("bound", "Bound", { index: 50, openRouterId: "a/bound" })], null, []);
  expect(result.points).toEqual([]);
  expect(result.window).toBeNull();
  expect(result.excluded["not-in-usage-dataset"]).toBe(1);
});

test("relative gap is undefined for a missing or zero list price", () => {
  expect(relativeGap(10, 4)).toBeCloseTo(0.6);
  expect(relativeGap(10, 10)).toBe(0);
  expect(relativeGap(0, 0)).toBeNull();
  expect(relativeGap(null, 1)).toBeNull();
  expect(relativeGap(1, null)).toBeNull();
});

test("route rows are sorted by the larger relative gap and need a complete price pair", () => {
  const catalog = [
    { openrouter_id: "a/small", name: "Lab: Small Gap", prompt_price_1m: 10, completion_price_1m: 20, fetched_at: "2026-10-30T00:00:00Z" },
    { openrouter_id: "a/big", name: "Lab: Big Gap", prompt_price_1m: 10, completion_price_1m: 20, fetched_at: "2026-10-30T00:00:00Z" },
    { openrouter_id: "a/output-only", name: "Lab: Output Only", prompt_price_1m: null, completion_price_1m: 8 },
    { openrouter_id: "a/none", name: "Lab: No Routes", prompt_price_1m: 1, completion_price_1m: 2 },
    { openrouter_id: "a/pricier", name: "Lab: Pricier Route", prompt_price_1m: 1, completion_price_1m: 2 },
  ];
  const summaries = [
    { openrouter_id: "a/small", min_prompt_price_1m: 9, min_completion_price_1m: 20, provider_count: 2, fetched_at: "2026-11-18T00:00:00Z" },
    { openrouter_id: "a/big", min_prompt_price_1m: 9, min_completion_price_1m: 5, provider_count: 3 },
    { openrouter_id: "a/output-only", min_prompt_price_1m: 1, min_completion_price_1m: 6 },
    { openrouter_id: "a/none", min_prompt_price_1m: null, min_completion_price_1m: null, provider_count: 0 },
    { openrouter_id: "a/pricier", min_prompt_price_1m: 1.5, min_completion_price_1m: null },
    { openrouter_id: "a/not-in-catalog", min_prompt_price_1m: 1, min_completion_price_1m: 1 },
  ];
  const result = buildRoutePrices(catalog, summaries, [{ path: "/models/big", catalog: { openRouterId: "a/big" } }]);
  expect(result.rows.map((row) => row.openRouterId)).toEqual(["a/big", "a/output-only", "a/small", "a/pricier"]);
  expect(result.withoutPair).toBe(2);
  const big = result.rows[0];
  expect(big.name).toBe("Big Gap");
  expect(big.path).toBe("/models/big");
  expect(big.output).toEqual({ list: 20, cheapest: 5, gap: 0.75 });
  expect(result.rows.find((row) => row.openRouterId === "a/output-only")?.input).toEqual({ list: null, cheapest: 1, gap: null });
  expect(result.rows.find((row) => row.openRouterId === "a/small")).toMatchObject({ path: null, listFetchedAt: "2026-10-30T00:00:00Z", routeFetchedAt: "2026-11-18T00:00:00Z" });
  // A route priced above the list price is kept with its negative gap, not clamped.
  expect(result.rows.at(-1)?.input.gap).toBeCloseTo(-0.5);
});

test("the shared log axis gives no position to zero or missing prices", () => {
  const axis = logAxis([0, null, 0.5, 20]);
  expect(axis?.min).toBe(0.1);
  expect(axis?.max).toBe(100);
  expect(axis?.position(0)).toBeNull();
  expect(axis?.position(null)).toBeNull();
  expect(axis?.position(1)).toBeCloseTo(100 / 3);
  expect(logAxis([0, null])).toBeNull();
});

test("latency and speed need both medians; missing values are counted, not zeroed", () => {
  const result = buildLatencySpeed([
    record("slow", "Slow", { ttft: 4, speed: 40 }), record("fast", "Fast", { ttft: 0.4, speed: 200 }),
    record("half", "Half", { ttft: 0.5 }), record("none", "None"),
  ]);
  expect(result.points.map((point) => point.id)).toEqual(["fast", "slow"]);
  expect(result.missing).toBe(2);
  expect(result.notes).toHaveLength(1);
});

test("the lane lists its routes for nav and sitemap wiring", () => {
  expect(marketLaneRoutes().map((route) => route.path)).toEqual(["/market", "/changes", "/changes.xml"]);
});

test("log axis scale places only positive values and ticks at 1-2-5 steps over short spans", () => {
  const scale = axisScale([0.3, 40], true);
  expect(scale.domain).toEqual([0.2, 50]);
  expect(scale.fraction(0.2)).toBeCloseTo(0);
  expect(scale.fraction(50)).toBeCloseTo(1);
  expect(scale.fraction(0)).toBeNull();
  expect(scale.ticks.map((tick) => tick.value)).toEqual([0.2, 0.5, 1, 2, 5, 10, 20, 50]);
  expect(axisScale([0.001, 1000], true).ticks.map((tick) => tick.value)).toEqual([0.001, 0.01, 0.1, 1, 10, 100, 1000]);
});

test("linear axis scale starts at zero and uses round steps", () => {
  const scale = axisScale([12, 73], false);
  expect(scale.domain).toEqual([0, 80]);
  expect(scale.ticks.map((tick) => tick.value)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80]);
  expect(scale.fraction(40)).toBe(0.5);
});

test("tightened log bounds still get their end ticks", () => {
  const scale = axisScale([6, 1500], true);
  expect(scale.domain).toEqual([5, 2000]);
  expect(scale.ticks.map((tick) => tick.value)).toEqual([5, 10, 20, 50, 100, 200, 500, 1000, 2000]);
});
