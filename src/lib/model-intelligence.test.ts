/// <reference types="bun" />

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import * as modelIntelligence from "./model-intelligence";
import {
  buildParetoFrontier,
  findComparableCoverageLeader,
  rankComparableModels,
  type TaskPreset,
} from "./model-intelligence";

test("default task presets disclose weights, coverage, and comparable metric directions", () => {
  const DEFAULT_TASK_PRESETS = (
    modelIntelligence as typeof modelIntelligence & { DEFAULT_TASK_PRESETS?: TaskPreset[] }
  ).DEFAULT_TASK_PRESETS ?? [];
  expect(DEFAULT_TASK_PRESETS.map((preset) => preset.id)).toEqual([
    "coding",
    "reasoning",
    "fast-value",
  ]);
  expect(DEFAULT_TASK_PRESETS.every((preset) => preset.minimumCoverage >= 2)).toBe(true);
  expect(DEFAULT_TASK_PRESETS.find((preset) => preset.id === "coding")).toMatchObject({
    weights: {
      aa_coding_index: 0.5,
      livecodebench: 0.3,
      price_1m_blended_3_to_1: 0.2,
    },
    metricDirections: {
      price_1m_blended_3_to_1: "lower-is-better",
    },
  });
  expect(
    DEFAULT_TASK_PRESETS.every(
      (preset) => preset.budgetMetricKey === "price_1m_blended_3_to_1",
    ),
  ).toBe(true);
});

test("rankComparableModels excludes a one-metric perfect row below required coverage", () => {
  const preset: TaskPreset = {
    id: "reasoning",
    label: "Reasoning",
    weights: { math: 1, science: 1 },
    minimumCoverage: 2,
  };

  const ranked = rankComparableModels(
    [
      {
        id: "one-metric-perfect",
        metrics: { math: 100, science: null },
      },
      {
        id: "comparable-coverage",
        metrics: { math: 80, science: 80 },
      },
    ],
    preset,
  );

  expect(ranked.map((candidate) => candidate.model.id)).toEqual([
    "comparable-coverage",
  ]);
});

test("rankComparableModels excludes evidence above the budget", () => {
  const ranked = rankComparableModels(
    [
      { id: "within-budget", metrics: { quality: 70, price: 8 } },
      { id: "over-budget", metrics: { quality: 99, price: 13 } },
    ],
    {
      id: "budgeted-quality",
      label: "Budgeted quality",
      weights: { quality: 1 },
      minimumCoverage: 1,
      budget: 10,
      budgetMetricKey: "price",
    },
  );

  expect(ranked.map((candidate) => candidate.model.id)).toEqual([
    "within-budget",
  ]);
});

test("rankComparableModels excludes models with missing required price", () => {
  const ranked = rankComparableModels(
    [
      { id: "priced", metrics: { quality: 70, price: 8 } },
      { id: "missing-price", metrics: { quality: 99, price: null } },
    ],
    {
      id: "budgeted-quality",
      label: "Budgeted quality",
      weights: { quality: 1 },
      minimumCoverage: 1,
      budget: 10,
      budgetMetricKey: "price",
    },
  );

  expect(ranked.map((candidate) => candidate.model.id)).toEqual(["priced"]);
});

test("rankComparableModels prefers lower latency and price when configured", () => {
  const ranked = rankComparableModels(
    [
      {
        id: "slow-expensive",
        metrics: { quality: 90, latency: 2, price: 20 },
      },
      {
        id: "fast-cheap",
        metrics: { quality: 90, latency: 1, price: 10 },
      },
    ],
    {
      id: "interactive",
      label: "Interactive",
      weights: { quality: 1, latency: 1, price: 1 },
      minimumCoverage: 3,
      metricDirections: {
        latency: "lower-is-better",
        price: "lower-is-better",
      },
    },
  );

  expect(ranked.map((candidate) => candidate.model.id)).toEqual([
    "fast-cheap",
    "slow-expensive",
  ]);
});

test("rankComparableModels keeps ties stable by model id", () => {
  const ranked = rankComparableModels(
    [
      { id: "zeta", metrics: { quality: 80 } },
      { id: "alpha", metrics: { quality: 80 } },
    ],
    {
      id: "quality",
      label: "Quality",
      weights: { quality: 1 },
      minimumCoverage: 1,
    },
  );

  expect(ranked.map((candidate) => candidate.model.id)).toEqual([
    "alpha",
    "zeta",
  ]);
});

test("rankComparableModels retains null evidence and accepts a zero metric value", () => {
  const model = {
    id: "partial-zero",
    metrics: { quality: 0, science: null },
  };
  const ranked = rankComparableModels(
    [model],
    {
      id: "quality",
      label: "Quality",
      weights: { quality: 1, science: 1 },
      minimumCoverage: 1,
    },
  );

  expect(ranked[0]).toMatchObject({
    coverage: 1,
    missingMetricKeys: ["science"],
  });
  expect(ranked[0]?.model.metrics.science).toBeNull();
  expect(ranked[0]?.model.metrics.quality).toBe(0);
});

test("rankComparableModels returns the applied preset weights for disclosure", () => {
  const preset: TaskPreset = {
    id: "weighted",
    label: "Weighted",
    weights: { quality: 3, latency: 1 },
    minimumCoverage: 1,
  };

  const ranked = rankComparableModels(
    [{ id: "candidate", metrics: { quality: 70, latency: 1 } }],
    preset,
  );

  expect(ranked[0]?.weights).toEqual({ quality: 3, latency: 1 });
});

test("findComparableCoverageLeader excludes sparse models before averaging", () => {
  const leader = findComparableCoverageLeader(
    [
      { id: "sparse-perfect", metrics: { math: 100, science: null } },
      { id: "complete", metrics: { math: 80, science: 80 } },
    ],
    ["math", "science"],
    2,
  );

  expect(leader?.model.id).toBe("complete");
  expect(leader?.score).toBe(80);
});

test("buildParetoFrontier removes only models dominated on quality and price", () => {
  const frontier = buildParetoFrontier([
    { id: "better-same-cost", metrics: { quality: 80, price: 10 } },
    { id: "dominated", metrics: { quality: 70, price: 10 } },
    { id: "higher-quality-costlier", metrics: { quality: 90, price: 20 } },
    { id: "missing-price", metrics: { quality: 100, price: null } },
  ]);

  expect(frontier.map((model) => model.id)).toEqual([
    "better-same-cost",
    "higher-quality-costlier",
  ]);
});

test("Dashboard snapshot replacement uses the same comparable AA leader helper", () => {
  const dashboard = readFileSync(
    new URL("../components/Dashboard.astro", import.meta.url),
    "utf8",
  );
  const updateTopStripStart = dashboard.indexOf("const updateTopStrip =");
  const updateTopStripEnd = dashboard.indexOf("const topEciModel =", updateTopStripStart);
  const updateTopStrip = dashboard.slice(updateTopStripStart, updateTopStripEnd);

  expect(updateTopStrip).toContain("findAaComparableCoverageLeader(models)");
  expect(updateTopStrip).not.toContain("getAverageScore(");
});
