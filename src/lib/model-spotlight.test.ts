/// <reference types="bun" />

import { expect, test } from "bun:test";
import type { AaModel } from "./supabase";
import {
  isCurrentMeasuredModel,
  selectBenchmarkSnapshotModels,
} from "./model-spotlight";

const model = (
  id: string,
  provider: string,
  firstSeen: string,
  overrides: Partial<AaModel> = {},
): AaModel => ({
  id,
  name: id,
  slug: id,
  creator_id: null,
  creator_name: provider,
  creator_slug: provider.toLowerCase().replace(/\s+/g, "-"),
  company_name: provider,
  evaluations: null,
  aa_intelligence_index: 70,
  aa_coding_index: 65,
  aa_math_index: null,
  mmlu_pro: null,
  gpqa: 60,
  hle: null,
  livecodebench: null,
  scicode: null,
  math_500: null,
  aime: null,
  pricing: null,
  price_1m_blended_3_to_1: 3,
  price_1m_input_tokens: 2,
  price_1m_output_tokens: 6,
  median_output_tokens_per_second: 80,
  median_time_to_first_token_seconds: 0.2,
  median_time_to_first_answer_token: 0.4,
  first_seen: firstSeen,
  last_seen: firstSeen,
  ...overrides,
});

test("isCurrentMeasuredModel excludes incomplete zero operational telemetry", () => {
  expect(
    isCurrentMeasuredModel(
      model("placeholder", "Amazon", "2026-08-30", {
        price_1m_blended_3_to_1: 0,
        median_output_tokens_per_second: 0,
      }),
    ),
  ).toBe(false);
});

test("isCurrentMeasuredModel excludes obscure providers without adoption evidence", () => {
  expect(isCurrentMeasuredModel(model("obscure", "Unknown Lab", "2026-08-30"))).toBe(false);
  expect(
    isCurrentMeasuredModel(
      model("adopted", "Unknown Lab", "2026-08-30", {
        openrouter_usage_tokens: 2_000_000,
      }),
    ),
  ).toBe(true);
});

test("isCurrentMeasuredModel does not accept a provider that only contains a famous name", () => {
  expect(
    isCurrentMeasuredModel(model("spoofed", "Not OpenAI Research", "2026-08-30")),
  ).toBe(false);
});

test("isCurrentMeasuredModel requires a recent observation receipt", () => {
  expect(
    isCurrentMeasuredModel(
      model("stale", "OpenAI", "2025-01-01", {
        last_seen: "2025-01-02",
      }),
      Date.parse("2026-09-01T00:00:00Z"),
    ),
  ).toBe(false);
});

test("selectBenchmarkSnapshotModels keeps one evidence-rich measured model per provider", () => {
  const selected = selectBenchmarkSnapshotModels([
    model("openai-old", "OpenAI", "2026-08-20", { aa_intelligence_index: 95 }),
    model("openai-new", "OpenAI", "2026-08-30", { aa_intelligence_index: 80 }),
    model("anthropic-new", "Anthropic", "2026-08-29"),
    model("google-new", "Google", "2026-08-28"),
  ]);

  expect(selected.map((candidate) => candidate.id)).toEqual([
    "openai-old",
    "anthropic-new",
    "google-new",
  ]);
});

test("selectBenchmarkSnapshotModels prioritizes evidence coverage before recency", () => {
  const selected = selectBenchmarkSnapshotModels([
    model("qwen-new-sparse", "Alibaba", "2026-08-30", {
      aa_intelligence_index: 90,
      gpqa: null,
    }),
    model("qwen-covered", "Alibaba", "2026-08-20", {
      aa_intelligence_index: 75,
      gpqa: 60,
    }),
  ]);

  expect(selected.map((candidate) => candidate.id)).toEqual(["qwen-covered"]);
});

test("selectBenchmarkSnapshotModels uses AA intelligence as the quality tie-break", () => {
  const selected = selectBenchmarkSnapshotModels([
    model("qwen-weaker", "Alibaba", "2026-08-30", { aa_intelligence_index: 60 }),
    model("qwen-stronger", "Alibaba", "2026-08-30", { aa_intelligence_index: 85 }),
  ]);

  expect(selected.map((candidate) => candidate.id)).toEqual(["qwen-stronger"]);
});

test("selectBenchmarkSnapshotModels caps the splash at six providers", () => {
  const selected = selectBenchmarkSnapshotModels([
    model("openai", "OpenAI", "2026-08-30"),
    model("anthropic", "Anthropic", "2026-08-29"),
    model("google", "Google", "2026-08-28"),
    model("deepseek", "DeepSeek", "2026-08-27"),
    model("xai", "xAI", "2026-08-26"),
    model("mistral", "Mistral", "2026-08-25"),
    model("amazon", "Amazon", "2026-08-24"),
  ]);

  expect(selected).toHaveLength(6);
});
