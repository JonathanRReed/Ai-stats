import { expect, test } from "bun:test";
import { rankModelFamilies } from "./model-family-ranking";

const row = (id: string, score: number | null, extra: Record<string, unknown> = {}) => ({
  id, name: id, company_name: "Anthropic", source: "aa", current_source_member: true,
  aa_intelligence_index: score, ...extra,
});

test("families use one best measured variant per exact source/provider/family before top-five", () => {
  const rows = [
    row("Opus (Low)", 70, { reasoning: "low" }),
    row("Opus (High)", 90, { reasoning: "high" }),
    row("Claude Opus (Max)", 99, { company_name: "Other Provider", reasoning: "max" }),
    row("Missing (High)", null, { reasoning: "high" }),
    ...Array.from({ length: 6 }, (_, index) => row(`Family ${index}`, 80 - index)),
  ];
  const ranked = rankModelFamilies(rows, "aa_intelligence_index", { limit: 5 });
  expect(ranked).toHaveLength(5);
  const anthopicFamily = ranked.find((family) => family.provider === "Anthropic");
  expect(anthopicFamily?.best.id).toBe("Opus (High)");
  expect(anthopicFamily?.variants.map((model) => model.id)).toContain("Opus (Low)");
  expect(ranked.some((family) => family.variants.some((model) => model.id === "Missing (High)"))).toBe(false);
  expect(ranked.some((family) => family.provider === "Other Provider")).toBe(true);
});

test("reasoning and family search filters run before family ranking", () => {
  const rows = [row("Opus (Low)", 70, { reasoning: "low" }), row("Opus (High)", 90, { reasoning: "high" }), row("Sonnet (High)", 95, { reasoning: "high" })];
  const filtered = rankModelFamilies(rows, "aa_intelligence_index", { query: "opu", reasoning: ["low"] });
  expect(filtered).toHaveLength(1);
  expect(filtered[0].best.id).toBe("Opus (Low)");
});

test("all-variant mode orders scored records and lower-is-better metrics correctly", () => {
  const rows = [row("Opus (Low)", 4, { reasoning: "low" }), row("Opus (High)", 2, { reasoning: "high" }), row("Sonnet", 3)];
  const ranked = rankModelFamilies(rows, "aa_intelligence_index", { higherIsBetter: false, mode: "variants", limit: 2 });
  expect(ranked.map((family) => family.best.id)).toEqual(["Opus (High)", "Sonnet"]);
});

test("same family labels stay separate across source, provider, and missing metric values", () => {
  const rows = [row("Opus (Low)", 10), row("Opus (High)", 11, { company_name: "OpenAI" }), row("Opus (Max)", 12, { source: "other" })];
  expect(rankModelFamilies(rows, "aa_intelligence_index")).toHaveLength(3);
  expect(rankModelFamilies(rows, "price_1m_input_tokens")).toHaveLength(0);
});
