import type { AaModel } from "./supabase";

type DrawerModelSource = AaModel & {
  context_window?: number | null;
  max_output_tokens?: number | null;
};

export const toModelDrawerPayload = (model: DrawerModelSource) => ({
  id: model.id,
  name: model.name,
  slug: model.slug,
  company_name: model.company_name ?? model.creator_name ?? null,
  creator_name: model.creator_name,
  creator_slug: model.creator_slug,
  price_1m_input_tokens: model.price_1m_input_tokens,
  price_1m_output_tokens: model.price_1m_output_tokens,
  price_1m_blended_3_to_1: model.price_1m_blended_3_to_1,
  median_output_tokens_per_second: model.median_output_tokens_per_second,
  median_time_to_first_token_seconds: model.median_time_to_first_token_seconds,
  median_time_to_first_answer_token: model.median_time_to_first_answer_token,
  mmlu_pro: model.mmlu_pro,
  gpqa: model.gpqa,
  hle: model.hle,
  aime: model.aime,
  livecodebench: model.livecodebench,
  scicode: model.scicode,
  math_500: model.math_500,
  aa_intelligence_index: model.aa_intelligence_index,
  aa_coding_index: model.aa_coding_index,
  aa_math_index: model.aa_math_index,
  context_window: model.context_window ?? null,
  max_output_tokens: model.max_output_tokens ?? null,
  first_seen: model.first_seen,
  last_seen: model.last_seen,
  openrouter_id: model.openrouter_id ?? null,
  openrouter_name: model.openrouter_name ?? null,
  openrouter_context_length: model.openrouter_context_length ?? null,
  openrouter_prompt_price_1m: model.openrouter_prompt_price_1m ?? null,
  openrouter_completion_price_1m: model.openrouter_completion_price_1m ?? null,
  openrouter_supported_parameters: model.openrouter_supported_parameters ?? [],
  openrouter_input_modalities: model.openrouter_input_modalities ?? [],
  openrouter_output_modalities: model.openrouter_output_modalities ?? [],
  openrouter_is_free: model.openrouter_is_free ?? false,
});
