import type { APIRoute } from 'astro';
import {
  getModels,
  getPublicCatalogModels,
  enrichModelsWithPublicCatalogData,
} from '../../lib/supabase';
import {
  VALUABLE_FREE_BENCHMARK_SLUGS,
  getEpochBenchmarksWithRuns,
  getEpochBenchmarkLabel,
} from '../../lib/benchmark-catalog';
import { getEpochEvidence } from '../../lib/epoch-evidence';
import {
  compareOptionalMetricValues,
  hasFiniteMetricValue,
} from '../../lib/metric-values';
import { selectBenchmarkSnapshotModels } from '../../lib/model-spotlight';
import type { AaModel } from '../../lib/supabase';

type CompareModelRecord = Record<string, unknown>;
type EpochDemoModel = {
  id: string;
  name: string;
  slug: string;
  creator_name: string | null | undefined;
  creator_slug: string;
  company_name: string | null | undefined;
  aa_intelligence_index: number | null | undefined;
  price_1m_blended_3_to_1: null;
  price_1m_input_tokens: null;
  price_1m_output_tokens: null;
  median_output_tokens_per_second: null;
  median_time_to_first_answer_token: null;
  isIllustrativeFallback: true;
  priceEvidence: 'unavailable';
  first_seen: null;
  last_seen: null;
  release_date: string | null;
};

const normalizeModelKey = (value: string | null | undefined): string => {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const compactCompareModelForClient = (model: CompareModelRecord) => ({
  id: model.id,
  name: model.name,
  slug: model.slug,
  company_name: model.company_name,
  aa_intelligence_index: model.aa_intelligence_index,
  aa_coding_index: model.aa_coding_index,
  aa_math_index: model.aa_math_index,
  mmlu_pro: model.mmlu_pro,
  gpqa: model.gpqa,
  hle: model.hle,
  livecodebench: model.livecodebench,
  scicode: model.scicode,
  math_500: model.math_500,
  aime: model.aime,
  price_1m_blended_3_to_1: model.price_1m_blended_3_to_1,
  price_1m_input_tokens: model.price_1m_input_tokens,
  price_1m_output_tokens: model.price_1m_output_tokens,
  median_output_tokens_per_second: model.median_output_tokens_per_second,
  median_time_to_first_answer_token: model.median_time_to_first_answer_token,
  openrouter_id: model.openrouter_id,
  openrouter_context_length: model.openrouter_context_length,
  openrouter_prompt_price_1m: model.openrouter_prompt_price_1m,
  openrouter_supported_parameters: model.openrouter_supported_parameters,
  openrouter_input_modalities: model.openrouter_input_modalities,
  openrouter_output_modalities: model.openrouter_output_modalities,
  openrouter_endpoint_provider_count: model.openrouter_endpoint_provider_count,
  openrouter_usage_tokens: model.openrouter_usage_tokens,
  hf_model_id: model.hf_model_id,
  hf_downloads: model.hf_downloads,
  hf_likes: model.hf_likes,
  litellm_model_id: model.litellm_model_id,
  litellm_max_input_tokens: model.litellm_max_input_tokens,
  litellm_input_price_1m: model.litellm_input_price_1m,
  litellm_supports_vision: model.litellm_supports_vision,
  litellm_supports_function_calling: model.litellm_supports_function_calling,
  litellm_supports_reasoning: model.litellm_supports_reasoning,
  litellm_supports_prompt_caching: model.litellm_supports_prompt_caching,
  litellm_supports_web_search: model.litellm_supports_web_search,
  isIllustrativeFallback: model.isIllustrativeFallback,
  priceEvidence: model.priceEvidence,
  first_seen: model.first_seen,
  last_seen: model.last_seen,
  release_date: model.release_date,
});

const collectInitialEpochLookup = (model: CompareModelRecord) => {
  const keys = new Set<string>();
  const register = (candidate: string | null | undefined) => {
    const normalized = normalizeModelKey(candidate);
    if (!normalized) return;
    keys.add(normalized);
    keys.add(normalized.replace(/\s+/g, ''));
  };

  register(String(model.name ?? ''));
  register(String(model.slug ?? ''));

  const normalizedName = normalizeModelKey(String(model.name ?? ''));
  const normalizedCompany = normalizeModelKey(String(model.company_name ?? ''));
  if (
    normalizedName &&
    normalizedCompany &&
    normalizedName.startsWith(`${normalizedCompany} `)
  ) {
    register(normalizedName.slice(normalizedCompany.length).trim());
  }

  return { keys };
};

export const GET: APIRoute = async () => {
  const [baseModels, publicCatalogs, epochEvidence] =
    await Promise.all([
      getModels(),
      getPublicCatalogModels(),
      getEpochEvidence(),
    ]);
  const models = enrichModelsWithPublicCatalogData(baseModels, publicCatalogs);
  const { epochBenchmarks, epochRuns, epochModels } = epochEvidence;

  const epochAliasesByModelVersion: Record<string, string[]> = {};
  epochModels.forEach((model) => {
    if (!model.model_version) return;
    const aliases = new Set<string>();
    [model.model_version, model.model_name, model.display_name].forEach(
      (candidate) => {
        const normalized = normalizeModelKey(candidate);
        if (!normalized) return;
        aliases.add(normalized);
        aliases.add(normalized.replace(/\s+/g, ''));
      },
    );
    if (aliases.size > 0) {
      epochAliasesByModelVersion[model.model_version] = Array.from(aliases);
    }
  });

  const epochBenchmarksWithData = getEpochBenchmarksWithRuns(
    epochBenchmarks,
    epochRuns,
  );
  const availableBenchmarks: Record<string, string> = {
    mmlu_pro: 'MMLU Pro',
    gpqa: 'GPQA',
    hle: 'HLE',
    aa_math_index: 'Math Index',
    aa_coding_index: 'Coding Index',
    aa_intelligence_index: 'Intelligence Index',
    livecodebench: 'LiveCodeBench',
    scicode: 'SciCode',
    math_500: 'Math 500',
    aime: 'AIME',
    elo: 'ELO Rating',
  };
  epochBenchmarksWithData.forEach((benchmark) => {
    availableBenchmarks[`epoch_${benchmark.slug}`] =
      `${getEpochBenchmarkLabel(benchmark)} (Epoch)`;
  });

  const epochScoresByModel: Record<string, Record<string, number>> = {};
  const registerEpochScore = (
    aliasKey: string,
    benchmarkSlug: string,
    score: number,
  ) => {
    if (!aliasKey) return;
    epochScoresByModel[aliasKey] ??= {};
    epochScoresByModel[aliasKey][benchmarkSlug] = score;
  };

  epochRuns.forEach((run) => {
    if (!run.model_version || run.score === null || !run.benchmark_slug) return;
    const normalizedVersion = normalizeModelKey(run.model_version);
    const aliases = new Set<string>([
      normalizedVersion,
      normalizedVersion.replace(/\s+/g, ''),
      ...(epochAliasesByModelVersion[run.model_version] ?? []),
    ]);

    aliases.forEach((alias) => {
      registerEpochScore(alias, run.benchmark_slug!, run.score!);
    });
  });

  const validModels = (models as CompareModelRecord[]).filter((model) => {
    const inputPrice = Number(model.price_1m_input_tokens);
    const outputPrice = Number(model.price_1m_output_tokens);
    return inputPrice > 0 && outputPrice > 0;
  });

  const buildEpochCompareDemoModels = (): EpochDemoModel[] => {
    const scoredModels = epochModels
      .map((model) => {
        const relatedRuns = epochRuns.filter(
          (run) =>
            run.model_version === model.model_version &&
            hasFiniteMetricValue(run.score),
        );
        return { model, relatedRuns };
      })
      .filter((entry) => entry.relatedRuns.length > 0)
      .sort((a, b) => {
        const eciOrder = compareOptionalMetricValues(
          a.model.eci_score,
          b.model.eci_score,
          'desc',
        );
        if (eciOrder !== 0) return eciOrder;
        return String(a.model.model_version || a.model.id).localeCompare(
          String(b.model.model_version || b.model.id),
        );
      })
      .slice(0, 40);

    return scoredModels.map(({ model, relatedRuns }, index) => {
      const name = model.display_name || model.model_name || model.model_version;
      return {
        id: `epoch-demo-${model.id || model.model_version || index}`,
        name,
        slug: normalizeModelKey(name).replace(/\s+/g, '-'),
        creator_name: model.organization,
        creator_slug: normalizeModelKey(model.organization).replace(/\s+/g, '-'),
        company_name: model.organization,
        aa_intelligence_index: null,
        price_1m_blended_3_to_1: null,
        price_1m_input_tokens: null,
        price_1m_output_tokens: null,
        median_output_tokens_per_second: null,
        median_time_to_first_answer_token: null,
        isIllustrativeFallback: true,
        priceEvidence: "unavailable",
        first_seen: null,
        last_seen: null,
        release_date: model.release_date || relatedRuns[0]?.release_date || null,
      };
    });
  };

  const epochDemoModels = validModels.length > 0 ? [] : buildEpochCompareDemoModels();
  const compareModels = validModels.length > 0 ? validModels : epochDemoModels;
  const curatedDefaultModels = selectBenchmarkSnapshotModels(
    validModels as AaModel[],
    3,
  );
  const defaultModelIds = (curatedDefaultModels.length
    ? curatedDefaultModels
    : validModels.slice(0, 3)
  ).map((model) => model.id);
  const scoreEntries = Object.entries(epochScoresByModel);
  const initialClientEpochScores: Record<string, Record<string, number>> = {};

  compareModels.forEach((model) => {
    const { keys } = collectInitialEpochLookup(model);
    scoreEntries.forEach(([alias, aliasScores]) => {
      if (keys.has(alias)) {
        initialClientEpochScores[alias] = aliasScores;
      }
    });
  });

  const initialClientEpochScoreMetrics: Record<string, string> = {};
  epochRuns.forEach((run) => {
    if (!run.benchmark_slug || !run.score_metric) return;
    const previous = initialClientEpochScoreMetrics[run.benchmark_slug];
    initialClientEpochScoreMetrics[run.benchmark_slug] =
      previous && previous !== run.score_metric ? 'mixed' : previous ?? run.score_metric;
  });

  return new Response(
    JSON.stringify({
      validModels: validModels.map(compactCompareModelForClient),
      defaultModelIds,
      epochDemoModels: epochDemoModels.map(compactCompareModelForClient),
      epochScoresByModel: initialClientEpochScores,
      availableBenchmarks,
      preferredBenchmarkSlugs: [...VALUABLE_FREE_BENCHMARK_SLUGS],
      initialClientEpochScoreMetrics,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
};
