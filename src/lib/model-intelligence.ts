export type TaskPreset = {
  id: string;
  label: string;
  weights: Record<string, number>;
  minimumCoverage: number;
  metricDirections?: Record<string, MetricDirection>;
  budget?: number | null;
  budgetMetricKey?: string;
};

export type ModelEvidence = {
  id: string;
  label?: string | null;
  metrics: Record<string, number | null | undefined>;
};

export type RankedCandidate = {
  model: ModelEvidence;
  score: number;
  coverage: number;
  presentMetricKeys: string[];
  missingMetricKeys: string[];
  weights: Record<string, number>;
};

export type MetricDirection = "higher-is-better" | "lower-is-better";

export type ParetoFrontierOptions = {
  qualityMetricKey?: string;
  priceMetricKey?: string;
};

/** Shared, inspectable defaults for neutral, task-oriented evidence views. */
export const DEFAULT_TASK_PRESETS: TaskPreset[] = [
  {
    id: "coding",
    label: "Coding evidence",
    weights: {
      aa_coding_index: 0.5,
      livecodebench: 0.3,
      price_1m_blended_3_to_1: 0.2,
    },
    metricDirections: {
      price_1m_blended_3_to_1: "lower-is-better",
    },
    minimumCoverage: 2,
    budgetMetricKey: "price_1m_blended_3_to_1",
  },
  {
    id: "reasoning",
    label: "Reasoning and research evidence",
    weights: {
      aa_intelligence_index: 0.45,
      gpqa: 0.3,
      hle: 0.25,
    },
    // Current Artificial Analysis rows reliably publish the aggregate index,
    // while older GPQA and HLE joins are often absent. Keep those gaps visible
    // instead of turning a valid current evidence view into an empty state.
    minimumCoverage: 1,
    budgetMetricKey: "price_1m_blended_3_to_1",
  },
  {
    id: "fast-value",
    label: "Speed, cost, and intelligence",
    weights: {
      aa_intelligence_index: 0.35,
      median_output_tokens_per_second: 0.35,
      price_1m_blended_3_to_1: 0.3,
    },
    metricDirections: {
      median_output_tokens_per_second: "higher-is-better",
      price_1m_blended_3_to_1: "lower-is-better",
    },
    minimumCoverage: 2,
    budgetMetricKey: "price_1m_blended_3_to_1",
  },
];

const isMetricValue = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const compareById = (a: ModelEvidence, b: ModelEvidence): number =>
  a.id.localeCompare(b.id);

const getWeightedMetricKeys = (weights: Record<string, number>): string[] =>
  Object.keys(weights).filter((key) => {
    const weight = weights[key];
    return typeof weight === "number" && Number.isFinite(weight) && weight > 0;
  });

const hasBudget = (preset: TaskPreset): preset is TaskPreset & { budget: number } =>
  typeof preset.budget === "number" && Number.isFinite(preset.budget);

const normalizeMetric = (
  value: number,
  values: number[],
  direction: MetricDirection,
): number => {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) return 1;

  const span = maximum - minimum;
  return direction === "lower-is-better"
    ? (maximum - value) / span
    : (value - minimum) / span;
};

export const rankComparableModels = (
  models: ModelEvidence[],
  preset: TaskPreset,
): RankedCandidate[] => {
  const metricKeys = getWeightedMetricKeys(preset.weights);
  const budgetMetricKey = preset.budgetMetricKey ?? "price";
  const eligibleModels = models.filter((model) => {
    if (!hasBudget(preset)) return true;
    const price = model.metrics[budgetMetricKey];
    return isMetricValue(price) && price <= preset.budget;
  });

  const coverageCandidates = eligibleModels
    .map((model) => {
      const presentMetricKeys = metricKeys.filter((key) =>
        isMetricValue(model.metrics[key]),
      );
      return { model, presentMetricKeys };
    })
    .filter(({ presentMetricKeys }) => presentMetricKeys.length >= preset.minimumCoverage);

  const valuesByMetric = new Map<string, number[]>();
  metricKeys.forEach((key) => {
    valuesByMetric.set(
      key,
      coverageCandidates
        .map(({ model }) => model.metrics[key])
        .filter(isMetricValue),
    );
  });

  return coverageCandidates
    .map(({ model, presentMetricKeys }) => {
      const weightedScore = presentMetricKeys.reduce((sum, key) => {
        const value = model.metrics[key];
        const values = valuesByMetric.get(key) ?? [];
        if (!isMetricValue(value) || !values.length) return sum;
        const direction = preset.metricDirections?.[key] ?? "higher-is-better";
        return sum + normalizeMetric(value, values, direction) * preset.weights[key];
      }, 0);
      const totalWeight = presentMetricKeys.reduce(
        (sum, key) => sum + preset.weights[key],
        0,
      );

      return {
        model,
        score: totalWeight ? weightedScore / totalWeight : 0,
        coverage: presentMetricKeys.length,
        presentMetricKeys,
        missingMetricKeys: metricKeys.filter(
          (key) => !presentMetricKeys.includes(key),
        ),
        weights: { ...preset.weights },
      };
    })
    .sort((a, b) => {
      const scoreDifference = b.score - a.score;
      if (scoreDifference !== 0) return scoreDifference;

      const coverageDifference = b.coverage - a.coverage;
      if (coverageDifference !== 0) return coverageDifference;

      return compareById(a.model, b.model);
    });
};

export const findComparableCoverageLeader = (
  models: ModelEvidence[],
  metricKeys: string[],
  minimumCoverage: number,
): RankedCandidate | null => {
  const weights = Object.fromEntries(metricKeys.map((key) => [key, 1]));
  const candidates = models
    .map((model) => {
      const presentMetricKeys = metricKeys.filter((key) =>
        isMetricValue(model.metrics[key]),
      );
      const total = presentMetricKeys.reduce(
        (sum, key) => sum + (model.metrics[key] as number),
        0,
      );

      return {
        model,
        score: presentMetricKeys.length ? total / presentMetricKeys.length : 0,
        coverage: presentMetricKeys.length,
        presentMetricKeys,
        missingMetricKeys: metricKeys.filter(
          (key) => !presentMetricKeys.includes(key),
        ),
        weights,
      };
    })
    .filter((candidate) => candidate.coverage >= minimumCoverage)
    .sort((a, b) => {
      const scoreDifference = b.score - a.score;
      if (scoreDifference !== 0) return scoreDifference;

      const coverageDifference = b.coverage - a.coverage;
      if (coverageDifference !== 0) return coverageDifference;

      return compareById(a.model, b.model);
    });

  return candidates[0] ?? null;
};

export const buildParetoFrontier = (
  models: ModelEvidence[],
  options: ParetoFrontierOptions = {},
): ModelEvidence[] => {
  const qualityMetricKey = options.qualityMetricKey ?? "quality";
  const priceMetricKey = options.priceMetricKey ?? "price";
  const comparableModels = models.filter((model) =>
    isMetricValue(model.metrics[qualityMetricKey]) &&
    isMetricValue(model.metrics[priceMetricKey]),
  );

  return comparableModels
    .filter((candidate) => {
      const quality = candidate.metrics[qualityMetricKey] as number;
      const price = candidate.metrics[priceMetricKey] as number;

      return !comparableModels.some((other) => {
        if (other.id === candidate.id) return false;

        const otherQuality = other.metrics[qualityMetricKey] as number;
        const otherPrice = other.metrics[priceMetricKey] as number;
        return (
          otherQuality >= quality &&
          otherPrice <= price &&
          (otherQuality > quality || otherPrice < price)
        );
      });
    })
    .sort((a, b) => {
      const priceDifference =
        (a.metrics[priceMetricKey] as number) -
        (b.metrics[priceMetricKey] as number);
      if (priceDifference !== 0) return priceDifference;

      const qualityDifference =
        (b.metrics[qualityMetricKey] as number) -
        (a.metrics[qualityMetricKey] as number);
      if (qualityDifference !== 0) return qualityDifference;

      return compareById(a, b);
    });
};
