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
  "aa_agentic_index",
  "gpqa",
  "hle",
  "livecodebench",
] as const;

const normalizeProvider = (value: string | null | undefined): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const hasRecordedMetric = (value:number|null|undefined):boolean => typeof value==='number'&&Number.isFinite(value)&&value>=0;

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

const qualityEvidenceCount = (model: AaModel): number =>
  QUALITY_METRIC_KEYS.filter((key) => hasRecordedMetric(model[key])).length;

export const isCurrentMeasuredModel = (
  model: AaModel,
  referenceTime = Date.now(),
): boolean => {
  const lastSeen = toTimestamp(model.last_seen);
  const observationAge = referenceTime - lastSeen;

  return (
    model.current_source_member !== false &&
    lastSeen > 0 &&
    observationAge >= -MAX_FUTURE_CLOCK_SKEW_MS &&
    observationAge <= MAX_OBSERVATION_AGE_MS &&
    qualityEvidenceCount(model) >= 1
  );
};

export const selectBenchmarkSnapshotModels = (
  models: AaModel[],
  limit = 6,
): AaModel[] => {
  const selectedProviders = new Set<string>();

  return models
    .filter((model) => isCurrentMeasuredModel(model) && hasRecordedMetric(model.aa_intelligence_index))
    .sort((a, b) => {
      const qualityDifference =
        Number(b.aa_intelligence_index ?? 0) -
        Number(a.aa_intelligence_index ?? 0);
      if (qualityDifference !== 0) return qualityDifference;

      // Coverage is a tie-breaker, never a way for a heavily measured weak
      // model to displace a stronger model in the first-screen snapshot.
      const evidenceDifference = qualityEvidenceCount(b) - qualityEvidenceCount(a);
      if (evidenceDifference !== 0) return evidenceDifference;

      // first_seen is the closest available release/arrival signal. last_seen
      // is an ingestion receipt and should only break a true tie.
      const firstSeenDifference = toTimestamp(b.first_seen) - toTimestamp(a.first_seen);
      if (firstSeenDifference !== 0) return firstSeenDifference;

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
