/// <reference types="bun" />

import { expect, test } from "bun:test";
import {
  dedupeAaModelsBySlug,
  findAaComparableCoverageLeader,
  hydrateEpochModelsFromRuns,
  sortAaModelsByIntelligence,
} from "./data-integrity";
import type { AaModel, EpochBenchmarkRun, EpochModel } from "./supabase";

const aaModel = (
  id: string,
  slug: string | null,
  intelligence: number,
  lastSeen: string,
  firstSeen = "2024-01-01",
): AaModel => ({
  id,
  name: `Model ${id}`,
  slug,
  creator_id: null,
  creator_name: null,
  creator_slug: null,
  evaluations: null,
  aa_intelligence_index: intelligence,
  aa_coding_index: null,
  aa_math_index: null,
  mmlu_pro: null,
  gpqa: null,
  hle: null,
  livecodebench: null,
  scicode: null,
  math_500: null,
  aime: null,
  pricing: null,
  price_1m_blended_3_to_1: null,
  price_1m_input_tokens: null,
  price_1m_output_tokens: null,
  median_output_tokens_per_second: null,
  median_time_to_first_token_seconds: null,
  median_time_to_first_answer_token: null,
  first_seen: firstSeen,
  last_seen: lastSeen,
});

const epochModel = (
  id: string,
  modelVersion: string,
  overrides: Partial<EpochModel> = {},
): EpochModel => ({
  id,
  model_version: modelVersion,
  model_name: null,
  display_name: null,
  organization: null,
  country: null,
  model_accessibility: null,
  release_date: null,
  eci_score: null,
  training_compute_flop: null,
  training_compute_confidence: null,
  description: null,
  ...overrides,
});

const epochRun = (
  modelVersion: string,
  benchmarkSlug: string,
  score: number,
  overrides: Partial<EpochBenchmarkRun> = {},
): EpochBenchmarkRun => ({
  id: `${modelVersion}:${benchmarkSlug}`,
  model_version: modelVersion,
  benchmark_id: benchmarkSlug,
  score,
  release_date: "2025-01-01",
  organization: "OpenAI",
  country: "US",
  stderr: null,
  score_metric: "percent",
  source_name: null,
  source_link: null,
  benchmark_name: benchmarkSlug,
  benchmark_slug: benchmarkSlug,
  ...overrides,
});

test("sortAaModelsByIntelligence prefers the higher index and newest seen date", () => {
  const sorted = sortAaModelsByIntelligence([
    aaModel("slow", "slow", 87, "2025-01-03"),
    aaModel("fast", "fast", 92, "2025-01-01"),
    aaModel("tie-newer", "tie-newer", 87, "2025-02-01"),
  ]);

  expect(sorted.map((model) => model.id)).toEqual([
    "fast",
    "tie-newer",
    "slow",
  ]);
});

test("dedupeAaModelsBySlug keeps the freshest duplicate and preserves unkeyed models", () => {
  const deduped = dedupeAaModelsBySlug([
    aaModel("older", "shared", 91, "2025-01-01"),
    aaModel("newer", "shared", 89, "2025-03-01"),
    aaModel("unkeyed", null, 100, "2025-04-01"),
  ]);

  expect(deduped.map((model) => model.id)).toEqual([
    "unkeyed",
    "newer",
  ]);
});

test("findAaComparableCoverageLeader ignores a sparse perfect AA model", () => {
  const sparse = {
    ...aaModel("sparse", "sparse", 90, "2025-01-01"),
    aa_intelligence_index: null,
    mmlu_pro: 100,
  };
  const comparable = {
    ...aaModel("comparable", "comparable", 80, "2025-01-01"),
    mmlu_pro: 0.8,
    gpqa: 0.8,
  };

  const leader = findAaComparableCoverageLeader([sparse, comparable]);

  expect(leader).toMatchObject({
    model: { id: "comparable" },
    avgScore: 80,
  });
});

test("findAaComparableCoverageLeader retains finite zero as comparable evidence", () => {
  const zeroAndMeasured = {
    ...aaModel("zero", "zero", 90, "2025-01-01"),
    aa_intelligence_index: null,
    mmlu_pro: 0,
    gpqa: 0.8,
  };

  const leader = findAaComparableCoverageLeader([zeroAndMeasured]);

  expect(leader).toMatchObject({
    model: { id: "zero" },
    avgScore: 40,
  });
});

test("hydrateEpochModelsFromRuns backfills missing Epoch models from runs and humanizes the version", () => {
  const hydrated = hydrateEpochModelsFromRuns(
    [epochModel("existing", "openrouter/gpt-4o", { eci_score: 92 })],
    [
      epochRun("chutes/gpt-4o-mini_high", "simplebench_external", 0.83, {
        release_date: "2025-04-10",
        organization: "OpenAI",
      }),
      epochRun("openrouter/gpt-4o", "simplebench_external", 0.91),
    ],
  );

  expect(hydrated.map((model) => model.model_version)).toEqual([
    "openrouter/gpt-4o",
    "chutes/gpt-4o-mini_high",
  ]);
  expect(hydrated[1]).toMatchObject({
    id: "run:chutes/gpt-4o-mini_high",
    model_name: "GPT 4o mini",
    display_name: "GPT 4o mini (high)",
    organization: "OpenAI",
    release_date: "2025-04-10",
    description: "Backfilled from Epoch benchmark runs.",
  });
});
