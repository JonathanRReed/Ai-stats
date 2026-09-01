import type { AaModel } from "./supabase";

const ESTABLISHED_PROVIDER_ALIASES = new Map<string, string>([
  ["openai", "openai"],
  ["anthropic", "anthropic"],
  ["googledeepmind", "google"],
  ["google", "google"],
  ["deepseek", "deepseek"],
  ["spacexai", "xai"],
  ["xai", "xai"],
  ["meta", "meta"],
  ["metaai", "meta"],
  ["alibaba", "alibaba"],
  ["alibabacloud", "alibaba"],
  ["qwen", "alibaba"],
  ["zhipu", "zai"],
  ["zhipuai", "zai"],
  ["zai", "zai"],
  ["moonshot", "moonshot"],
  ["kimi", "moonshot"],
  ["mistral", "mistral"],
  ["mistralai", "mistral"],
  ["nvidia", "nvidia"],
  ["amazon", "amazon"],
  ["amazonwebservices", "amazon"],
  ["aws", "amazon"],
  ["cohere", "cohere"],
  ["microsoft", "microsoft"],
  ["microsoftazure", "microsoft"],
  ["bytedance", "bytedance"],
  ["minimax", "minimax"],
]);

const MAX_OBSERVATION_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

const QUALITY_METRIC_KEYS = [
  "aa_intelligence_index",
  "aa_coding_index",
  "gpqa",
  "hle",
  "livecodebench",
] as const;

const normalizeProvider = (value: string | null | undefined): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const hasPositiveMetric = (value: number | null | undefined): boolean => {
  const metric = Number(value);
  return Number.isFinite(metric) && metric > 0;
};

const toTimestamp = (value: string | null | undefined): number => {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const providerName = (model: AaModel): string =>
  model.company_name ?? model.creator_name ?? "";

const canonicalProvider = (model: AaModel): string | null => {
  const normalized = normalizeProvider(providerName(model));
  return ESTABLISHED_PROVIDER_ALIASES.get(normalized) ?? null;
};

const hasAdoptionEvidence = (model: AaModel): boolean =>
  Number(model.openrouter_usage_tokens ?? 0) >= 1_000_000 ||
  Number(model.openrouter_endpoint_provider_count ?? 0) >= 3 ||
  Number(model.hf_downloads ?? 0) >= 500_000;

const qualityEvidenceCount = (model: AaModel): number =>
  QUALITY_METRIC_KEYS.filter((key) => hasPositiveMetric(model[key])).length;

const qualityScore = (model: AaModel): number => {
  const values = QUALITY_METRIC_KEYS.map((key) => Number(model[key])).filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
};

export const isCurrentMeasuredModel = (
  model: AaModel,
  referenceTime = Date.now(),
): boolean => {
  const firstSeen = toTimestamp(model.first_seen);
  const lastSeen = toTimestamp(model.last_seen);
  const observationAge = referenceTime - lastSeen;

  return (
    firstSeen > 0 &&
    lastSeen > 0 &&
    observationAge >= -MAX_FUTURE_CLOCK_SKEW_MS &&
    observationAge <= MAX_OBSERVATION_AGE_MS &&
    hasPositiveMetric(model.price_1m_blended_3_to_1) &&
    hasPositiveMetric(model.median_output_tokens_per_second) &&
    qualityEvidenceCount(model) >= 2 &&
    (canonicalProvider(model) !== null || hasAdoptionEvidence(model))
  );
};

export const selectBenchmarkSnapshotModels = (
  models: AaModel[],
  limit = 6,
): AaModel[] => {
  const selectedProviders = new Set<string>();

  return models
    .filter((model) => isCurrentMeasuredModel(model))
    .sort((a, b) => {
      const evidenceDifference = qualityEvidenceCount(b) - qualityEvidenceCount(a);
      if (evidenceDifference !== 0) return evidenceDifference;

      const qualityDifference =
        Number(b.aa_intelligence_index ?? 0) -
        Number(a.aa_intelligence_index ?? 0);
      if (qualityDifference !== 0) return qualityDifference;

      const broaderQualityDifference = qualityScore(b) - qualityScore(a);
      if (broaderQualityDifference !== 0) return broaderQualityDifference;

      const observationDifference = toTimestamp(b.last_seen) - toTimestamp(a.last_seen);
      if (observationDifference !== 0) return observationDifference;

      return a.id.localeCompare(b.id);
    })
    .filter((model) => {
      const key = canonicalProvider(model) ?? normalizeProvider(providerName(model));
      if (!key || selectedProviders.has(key)) return false;
      selectedProviders.add(key);
      return true;
    })
    .slice(0, Math.max(0, limit));
};
