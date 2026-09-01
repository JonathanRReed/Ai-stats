/// <reference types="bun" />

import { expect, test } from "bun:test";
import type { AaModel } from "./supabase";
import { toModelDrawerPayload } from "./model-api";

test("toModelDrawerPayload omits bulky source records not used by the drawer", () => {
  const payload = toModelDrawerPayload({
    id: "model-1",
    name: "Current model",
    slug: "current-model",
    creator_id: "creator-1",
    creator_name: "OpenAI",
    creator_slug: "openai",
    company_name: "OpenAI",
    evaluations: { large: "record" },
    pricing: { large: "record" },
    aa_intelligence_index: 90,
    aa_coding_index: 88,
    aa_math_index: 80,
    mmlu_pro: 75,
    gpqa: 82,
    hle: 40,
    livecodebench: 70,
    scicode: 65,
    math_500: 95,
    aime: 90,
    price_1m_blended_3_to_1: 4,
    price_1m_input_tokens: 2,
    price_1m_output_tokens: 10,
    median_output_tokens_per_second: 120,
    median_time_to_first_token_seconds: 0.1,
    median_time_to_first_answer_token: 0.2,
    first_seen: "2026-08-30",
    last_seen: "2026-08-31",
    hf_model_id: "openai/current-model",
    hf_tags: ["large", "unused"],
    litellm_model_id: "openai/current-model",
    openrouter_id: "openai/current-model",
    openrouter_name: "Current model",
    openrouter_supported_parameters: ["tools"],
  } as AaModel);

  expect(payload).toMatchObject({
    id: "model-1",
    name: "Current model",
    company_name: "OpenAI",
    price_1m_blended_3_to_1: 4,
    openrouter_id: "openai/current-model",
  });
  expect(payload).not.toHaveProperty("evaluations");
  expect(payload).not.toHaveProperty("pricing");
  expect(payload).not.toHaveProperty("hf_tags");
  expect(payload).not.toHaveProperty("hf_model_id");
  expect(payload).not.toHaveProperty("litellm_model_id");
});
