import { expect, test } from "bun:test";
import { buildModelVariantRows } from "./model-variants";

const record = (slug: string, name: string, provider: string, index: number | null) => ({
  slug, name, provider, path: `/models/${slug}`,
  pricing: [{ key: "price_1m_blended_3_to_1", label: "", value: 2, unit: "USD", source: "Artificial Analysis" }],
  speed: [{ key: "median_output_tokens_per_second", label: "", value: 50, unit: "tokens per second", source: "Artificial Analysis" }],
  indexes: [{ key: "aa_intelligence_index", label: "", value: index, unit: "points", source: "Artificial Analysis" }],
}) as Parameters<typeof buildModelVariantRows>[0][number];

test("variants of one family are listed in ascending reasoning effort", () => {
  const rows = buildModelVariantRows([
    record("a-max", "Alpha (Max)", "Lab", 60), record("a-low", "Alpha (Low)", "Lab", 40), record("a-high", "Alpha (High)", "Lab", 55),
  ]);
  expect(rows.get("a-low")?.map((row) => row.slug)).toEqual(["a-low", "a-high", "a-max"]);
  expect(rows.get("a-max")?.[0]).toMatchObject({ reasoning: "low", index: 40, blendedPrice: 2, outputSpeed: 50 });
});

test("a single record and same-named families from other labs are not compared", () => {
  const rows = buildModelVariantRows([
    record("solo", "Solo", "Lab", 30), record("a-low", "Alpha (Low)", "Lab", 40), record("b-low", "Alpha (Low)", "Other", 41),
  ]);
  expect(rows.has("solo")).toBe(false);
  expect(rows.has("a-low")).toBe(false);
  expect(rows.has("b-low")).toBe(false);
});

test("a missing measurement stays missing", () => {
  const rows = buildModelVariantRows([record("a-low", "Alpha (Low)", "Lab", null), record("a-high", "Alpha (High)", "Lab", 50)]);
  expect(rows.get("a-high")?.[0].index).toBeNull();
});
