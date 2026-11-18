// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- untyped browser code moved verbatim from the Dashboard.astro inline script
// @ts-nocheck
// Pure display helpers for the homepage client script (moved unchanged from Dashboard.astro).
import {formatPrice as formatCatalogPrice} from "../../../lib/format-utils";
import {parseFiniteMetricValue} from "../../../lib/metric-values";

export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const toDisplayName = (value, fallback = "-") => {
  const str = String(value ?? "").trim();
  return str || fallback;
};

export const cleanSourceUrl = (value) => {
  const text = String(value || "").trim();
  return /^https?:\/\//.test(text) ? text : null;
};

export const cleanSourceName = (value) => {
  const text = String(value || "").trim();
  if (!text || /^https?:\/\//.test(text)) return null;
  return text;
};

export const formatIndex = (score) => {
  const value = parseFiniteMetricValue(score);
  return value === null ? "N/A" : value.toFixed(1);
};

export const formatScore = (score) => {
  const num = parseFiniteMetricValue(score);
  if (num === null) return "N/A";
  const pct = num <= 1 ? num * 100 : num;
  return `${pct.toFixed(1)}%`;
};

export const formatPrice = formatCatalogPrice;

export const formatCompactNumber = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
};

export const toDrawerModel = (model) => ({
  id: model.id,
  name: model.name,
  slug: model.slug,
  company_name: model.company_name,
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
  context_window: model.context_window,
  max_output_tokens: model.max_output_tokens,
  first_seen: model.first_seen,
  last_seen: model.last_seen,
  openrouter_id: model.openrouter_id,
  openrouter_name: model.openrouter_name,
  openrouter_context_length: model.openrouter_context_length,
  openrouter_prompt_price_1m: model.openrouter_prompt_price_1m,
  openrouter_completion_price_1m: model.openrouter_completion_price_1m,
  openrouter_supported_parameters: model.openrouter_supported_parameters,
  openrouter_input_modalities: model.openrouter_input_modalities,
  openrouter_output_modalities: model.openrouter_output_modalities,
  openrouter_is_free: model.openrouter_is_free,
});

export const formatTps = (tps) => {
  const num = Number(tps);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return num.toFixed(1);
};

export const formatTtft = (ttft) => {
  const num = Number(ttft);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return `${num.toFixed(2)}s`;
};

export const formatContextLength = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "-";
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1)}M`;
  }
  if (num >= 1000) return `${Math.round(num / 1000)}K`;
  return String(num);
};

export const getScoreClass = (score) => {
  const num = parseFiniteMetricValue(score);
  if (num === null) return "score-none";
  const pct = num <= 1 ? num * 100 : num;
  if (pct >= 80) return "score-high";
  if (pct >= 60) return "score-mid";
  if (pct >= 40) return "score-low";
  return "score-poor";
};
