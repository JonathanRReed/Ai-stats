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
  expect(source).toContain("There is no single overall rank here");
  expect(source).toContain("Coding, math, reasoning, long-context review, and agent tool use measure different capabilities");
});

test("the compare page starts with compact controls and explicit comparable coverage", () => {
  expect(source).toContain('id="compare-task-preset"');
  expect(source).toContain("Compare by");
  expect(source).toContain('id="compare-evidence-coverage"');
  expect(source).toContain("Comparable rows");
  expect(source).toContain('id="compare-evidence-mode"');
  expect(source).toContain("DEFAULT_TASK_PRESETS");
  expect(source).toContain('id="compare-selected-count"');
  expect(source).toContain("selectedStatEl.textContent = String(selected.size);");
});

test("the initial performance chart follows the default task preset", () => {
  expect(source).toContain(
    "const initialPerformanceMetric = preferredMetricForPreset(defaultTaskPreset);",
  );
  expect(source).toContain(
    'selected={value === initialPerformanceMetric}',
  );
  expect(source).toContain(
    '<span class="benchmark-picker-value">{initialPerformanceMetricLabel}</span>',
  );
  expect(source).not.toContain('selected={value === "mmlu_pro"}');
});

test("the compare page describes measured data as a build-time snapshot", () => {
  expect(source).toContain(
    "Selections start from priced models and named measurements captured by this build.",
  );
  expect(source).not.toContain("live data can replace the snapshot");
});

test("the compare page revalidates its stable initial-data URL", () => {
  expect(source).toContain('fetch("/api/compare-initial.json")');
  expect(source).not.toContain(
    'fetch("/api/compare-initial.json", {\n      cache: "force-cache",\n    })',
  );
});

test("benchmark-only Epoch fallback is labeled, unpriced, and never selected as a default", () => {
  expect(source).toContain("Benchmark-only Epoch rows");
  expect(source).toContain("shown without price estimates");
  expect(source).toContain(
    "const curatedSelectedModels = selectBenchmarkSnapshotModels(validModels, 3);",
  );
  expect(source).toContain(
    "const selectedModels = validModels.length > 0",
  );
  expect(source).toContain(
    "usingIllustrativeFallback\n        ? []",
  );
  expect(initialApiSource).toContain("validModels: validModels.map(compactCompareModelForClient)");
  expect(initialApiSource).toContain("isIllustrativeFallback: true");
  expect(initialApiSource).toContain('priceEvidence: "unavailable"');
  expect(source).not.toContain("synthetic-estimate");
  expect(initialApiSource).not.toContain("synthetic-estimate");
  expect(source).not.toContain("aa_intelligence_index: model.eci_score");
  expect(initialApiSource).not.toContain("aa_intelligence_index: model.eci_score");
  expect(initialApiSource).toContain("validModels as AaModel[]");
  expect(initialApiSource).toContain("first_seen: null");
  expect(initialApiSource).toContain("release_date:");
});

test("Epoch metrics keep source-native units unless the source explicitly identifies a percentage", () => {
  expect(source).not.toContain('metricName.includes("score")');
  expect(source).not.toContain('metricName.includes("average")');
  expect(initialApiSource).toContain("? 'mixed'");
});

test("Epoch scores do not use fuzzy token fallback across source identities", () => {
  expect(source).not.toContain("tokens.every((token) => alias.includes(token))");
  expect(initialApiSource).not.toContain("tokens.every((token) => alias.includes(token))");
});
