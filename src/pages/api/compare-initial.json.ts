import type { APIRoute } from 'astro';
import {
  getModels,
  getHydratedEpochModels,
  getEpochBenchmarks,
  getEpochBenchmarkRuns,
  getPublicCatalogModels,
  enrichModelsWithPublicCatalogData,
} from '../../lib/supabase';
import {
  VALUABLE_FREE_BENCHMARK_SLUGS,
  getEpochBenchmarksWithRuns,
  getEpochBenchmarkLabel,
} from '../../lib/benchmark-catalog';
import { getPublicEpochSnapshot } from '../../lib/epoch-snapshot';

type CompareModelRecord = Record<string, unknown>;
type EpochDemoModel = {
  id: string;
  name: string;
  slug: string;
  creator_name: string | null | undefined;
  creator_slug: string;
  company_name: string | null | undefined;
  aa_intelligence_index: number | null | undefined;
  price_1m_blended_3_to_1: number;
  price_1m_input_tokens: number;
  price_1m_output_tokens: number;
  median_output_tokens_per_second: null;
  median_time_to_first_answer_token: null;
  first_seen: string;
  last_seen: string;
};

const normalizeModelKey = (value: string | null | undefined): string => {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const getEpochDemoPrice = (modelName: string): { input: number; output: number } => {
  const normalized = normalizeModelKey(modelName);
  const priceHints = [
    { tokens: ['gpt 4o mini'], input: 0.15, output: 0.6 },
    { tokens: ['gpt 4o'], input: 2.5, output: 10 },
    { tokens: ['gpt 4 1 mini'], input: 0.4, output: 1.6 },
    { tokens: ['gpt 4 1'], input: 2, output: 8 },
    { tokens: ['claude 3 5 haiku', 'claude 3 5 haiku 20241022'], input: 0.8, output: 4 },
    { tokens: ['claude 3 5 sonnet', 'claude 3 7 sonnet'], input: 3, output: 15 },
    { tokens: ['gemini 1 5 flash', 'gemini 2 0 flash'], input: 0.1, output: 0.4 },
    { tokens: ['gemini 1 5 pro'], input: 1.25, output: 5 },
    { tokens: ['deepseek v3', 'deepseek r1'], input: 0.27, output: 1.1 },
    { tokens: ['llama 3 1 405b', 'llama 3 3 70b'], input: 0.6, output: 0.9 },
    { tokens: ['mistral large'], input: 2, output: 6 },
    { tokens: ['grok'], input: 3, output: 15 },
  ];
  const match = priceHints.find((hint) =>
    hint.tokens.some((token) => normalized.includes(token)),
  );
  return match ? { input: match.input, output: match.output } : { input: 1, output: 3 };
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
});

const collectInitialEpochLookup = (model: CompareModelRecord) => {
  const keys = new Set<string>();
  const tokenSources: string[] = [];
  const register = (candidate: string | null | undefined) => {
    const normalized = normalizeModelKey(candidate);
    if (!normalized) return;
    keys.add(normalized);
    keys.add(normalized.replace(/\s+/g, ''));
    tokenSources.push(normalized);
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

  const tokens = Array.from(new Set(tokenSources.join(' ').split(' '))).filter(
    (token) => token && token.length > 2,
  );

  return { keys, tokens };
};

export const GET: APIRoute = async () => {
  const [baseModels, publicCatalogs, initialEpochBenchmarks, initialEpochRuns] =
    await Promise.all([
      getModels(),
      getPublicCatalogModels(),
      getEpochBenchmarks(),
      getEpochBenchmarkRuns(),
    ]);
  const models = enrichModelsWithPublicCatalogData(baseModels, publicCatalogs);
  const initialEpochModels = await getHydratedEpochModels(initialEpochRuns);
  const publicEpochSnapshot = await getPublicEpochSnapshot();
  const usePublicEpochSnapshot =
    publicEpochSnapshot &&
    publicEpochSnapshot.epochRuns.length > initialEpochRuns.length;
  const epochBenchmarks = usePublicEpochSnapshot
    ? publicEpochSnapshot.epochBenchmarks
    : initialEpochBenchmarks;
  const epochRuns = usePublicEpochSnapshot
    ? publicEpochSnapshot.epochRuns
    : initialEpochRuns;
  const epochModels = usePublicEpochSnapshot
    ? publicEpochSnapshot.epochModels
    : initialEpochModels;

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
          (run) => run.model_version === model.model_version && Number(run.score) > 0,
        );
        const bestScore = Math.max(
          ...relatedRuns.map((run) => Number(run.score) || 0),
          0,
        );
        return { model, relatedRuns, bestScore };
      })
      .filter((entry) => entry.relatedRuns.length > 0)
      .sort((a, b) => {
        const aEci = Number(a.model.eci_score) || 0;
        const bEci = Number(b.model.eci_score) || 0;
        if (bEci !== aEci) return bEci - aEci;
        return b.bestScore - a.bestScore;
      })
      .slice(0, 40);

    return scoredModels.map(({ model, relatedRuns }, index) => {
      const name = model.display_name || model.model_name || model.model_version;
      const price = getEpochDemoPrice(name);
      return {
        id: `epoch-demo-${model.id || model.model_version || index}`,
        name,
        slug: normalizeModelKey(name).replace(/\s+/g, '-'),
        creator_name: model.organization,
        creator_slug: normalizeModelKey(model.organization).replace(/\s+/g, '-'),
        company_name: model.organization,
        aa_intelligence_index: model.eci_score,
        price_1m_blended_3_to_1: (price.input * 3 + price.output) / 4,
        price_1m_input_tokens: price.input,
        price_1m_output_tokens: price.output,
        median_output_tokens_per_second: null,
        median_time_to_first_answer_token: null,
        first_seen: model.release_date || relatedRuns[0]?.release_date || '',
        last_seen: model.release_date || relatedRuns[0]?.release_date || '',
      };
    });
  };

  const epochDemoModels = validModels.length > 0 ? [] : buildEpochCompareDemoModels();
  const compareModels = validModels.length > 0 ? validModels : epochDemoModels;
  const scoreEntries = Object.entries(epochScoresByModel);
  const initialClientEpochScores: Record<string, Record<string, number>> = {};

  compareModels.forEach((model) => {
    const { keys, tokens } = collectInitialEpochLookup(model);
    scoreEntries.forEach(([alias, aliasScores]) => {
      if (
        keys.has(alias) ||
        (tokens.length > 0 && tokens.every((token) => alias.includes(token)))
      ) {
        initialClientEpochScores[alias] = aliasScores;
      }
    });
  });

  const initialClientEpochScoreMetrics: Record<string, string> = {};
  epochRuns.forEach((run) => {
    if (!run.benchmark_slug || !run.score_metric) return;
    initialClientEpochScoreMetrics[run.benchmark_slug] ??= run.score_metric;
  });

  return new Response(
    JSON.stringify({
      validModels: compareModels.map(compactCompareModelForClient),
      epochDemoModels,
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
