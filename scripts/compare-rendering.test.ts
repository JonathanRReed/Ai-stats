/// <reference types="bun" />

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/pages/compare.astro", "utf8");
const initialApiSource = readFileSync(
  "src/pages/api/compare-initial.json.ts",
  "utf8",
);

test("the compare page keeps the loading skeleton and branded empty state in source", () => {
  expect(source).toContain('class="chart-container is-loading" id="price-chart"');
  expect(source).toContain('class="chart-container is-loading" id="performance-chart"');
  expect(source).toContain('className = "no-data chart-empty"');
  expect(source).toContain("No models selected");
  expect(source).toContain("Pick models to compare");
});

test("the compare page keeps the guidance that there is no single overall rank", () => {
  expect(source).toContain("There is no single overall rank here.");
  expect(source).toContain("Coding, math, reasoning, long-context review, and agent tool use often point to different winners");
});

test("the compare page starts with a compact task lens and explicit evidence coverage", () => {
  expect(source).toContain('id="compare-task-preset"');
  expect(source).toContain("Task lens");
  expect(source).toContain('id="compare-evidence-coverage"');
  expect(source).toContain("Metric coverage");
  expect(source).toContain('id="compare-evidence-mode"');
  expect(source).toContain("DEFAULT_TASK_PRESETS");
  expect(source).toContain('id="compare-selected-count"');
  expect(source).toContain("selectedStatEl.textContent = String(selected.size);");
});

test("illustrative Epoch fallback is labeled and never selected as a source-backed default", () => {
  expect(source).toContain("Illustrative fallback");
  expect(source).toContain("price estimates are synthetic");
  expect(source).toContain(
    "const selectedModels = validModels.length > 0 ? validModels.slice(0, 3) : [];",
  );
  expect(source).toContain(
    "const selected = new Set(usingIllustrativeFallback ? [] : modelsState.slice(0, 3).map((m) => m.id));",
  );
  expect(initialApiSource).toContain("validModels: validModels.map(compactCompareModelForClient)");
  expect(initialApiSource).toContain("isIllustrativeFallback: true");
  expect(initialApiSource).toContain('priceEvidence: "synthetic-estimate"');
  expect(source).not.toContain("aa_intelligence_index: model.eci_score");
  expect(initialApiSource).not.toContain("aa_intelligence_index: model.eci_score");
});

test("Epoch scores do not use fuzzy token fallback across source identities", () => {
  expect(source).not.toContain("tokens.every((token) => alias.includes(token))");
  expect(initialApiSource).not.toContain("tokens.every((token) => alias.includes(token))");
});
