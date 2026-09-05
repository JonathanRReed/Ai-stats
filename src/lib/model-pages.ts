/**
 * Build-time model pages: one static URL per Artificial Analysis row.
 *
 * Everything here is pure so the page, the per-model JSON endpoint, the
 * sitemap, and llms-full.txt all derive from the same record and can be
 * unit-tested without a database. src/lib/model-pages-data.ts does the
 * loading.
 */
import type { AaModel, EpochBenchmark, EpochBenchmarkRun } from './supabase';
import type { PublicPoliBenchModel, PublicPoliBenchSnapshot } from './polibench-snapshot';
import { buildPassportRoutes, type ModelPassport, type ModelPassportAlias } from './model-passport';
import { AUTHOR_REF } from './author';
import { aaEvidenceNote } from './aa-evidence';
import { isCurrentMeasuredModel } from './model-spotlight';

export const SITE_ORIGIN = 'https://aistats.jonathanrreed.com';
export const MODEL_PAGE_SCHEMA = 'ai-stats-model-page.v1' as const;

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** AA slugs are unique after dedupe; the fallbacks only cover missing rows. */
export const modelPageSlug = (model: Pick<AaModel, 'slug' | 'name' | 'id'>): string =>
  slugify(model.slug ?? '') || slugify(model.name ?? '') || slugify(model.id) || 'model';

export const modelPagePath = (slug: string): string => `/models/${slug}`;

export type ModelPageMetric = {
  key: string;
  label: string;
  value: number | null;
  /** Human-readable unit for the receipt and the JSON-LD PropertyValue. */
  unit: string;
  source: 'Artificial Analysis' | 'OpenRouter' | 'LiteLLM';
};

export type ModelPageEpochRun = {
  benchmarkSlug: string;
  benchmark: string;
  score: number | null;
  stderr: number | null;
  scoreMetric: string | null;
  sourceName: string | null;
  sourceLink: string | null;
  releaseDate: string | null;
};

export type ModelPagePoliBench = {
  slug: string;
  label: string;
  status: string;
  evidenceLabel: string;
  completionRate: number;
  robustness: number;
  lastRunFinishedAt: string | null;
  url: string;
};

export type ModelPageRecord = {
  schema: typeof MODEL_PAGE_SCHEMA;
  id: string;
  slug: string;
  path: string;
  url: string;
  name: string;
  provider: string;
  aaSlug: string | null;
  aaEvidenceNote: string;
  firstSeen: string | null;
  lastSeen: string | null;
  /** YYYY-MM-DD form of lastSeen for sitemap lastmod and dateModified. */
  lastSeenDate: string | null;
  /** Passes the dashboard's current-measured filter: recent, priced, and benchmarked. */
  current: boolean;
  pricing: ModelPageMetric[];
  speed: ModelPageMetric[];
  context: ModelPageMetric[];
  benchmarks: ModelPageMetric[];
  indexes: ModelPageMetric[];
  epochRuns: ModelPageEpochRun[];
  catalog: {
    openRouterId: string | null;
    openRouterName: string | null;
    openRouterUrl: string | null;
    inputModalities: string[];
    outputModalities: string[];
    supportedParameters: string[];
    isFree: boolean;
    usageRank: number | null;
    usageTokens: number | null;
    endpointProviderCount: number | null;
    endpointProviders: string[];
    quantizations: string[];
    huggingFaceId: string | null;
    huggingFaceUrl: string | null;
    huggingFaceDownloads: number | null;
    huggingFaceLikes: number | null;
    huggingFaceLastModified: string | null;
    liteLlmId: string | null;
    liteLlmProvider: string | null;
    liteLlmMode: string | null;
    capabilities: string[];
  };
  poliBench: ModelPagePoliBench | null;
  aliases: ModelPassportAlias[];
  routes: ModelPassport['routes'];
};

export type ModelPageContext = {
  epochBenchmarks?: EpochBenchmark[];
  epochRuns?: EpochBenchmarkRun[];
  poliBench?: PublicPoliBenchSnapshot | null;
};

const finite = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const positive = (value: unknown): number | null => {
  const num = finite(value);
  return num !== null && num > 0 ? num : null;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];

const isoDate = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const normalizeName = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Same alias rule the dashboard uses so a page never shows runs the chart would not. */
export const matchEpochRuns = (
  model: Pick<AaModel, 'name' | 'slug'>,
  runs: EpochBenchmarkRun[],
  benchmarks: EpochBenchmark[],
): ModelPageEpochRun[] => {
  const aliases = new Set<string>();
  [model.name, model.slug].forEach((value) => {
    const normalized = normalizeName(value);
    if (!normalized) return;
    aliases.add(normalized);
    aliases.add(normalized.replace(/\s+/g, ''));
  });
  if (!aliases.size) return [];
  const benchmarkById = new Map(benchmarks.map((benchmark) => [benchmark.id, benchmark]));
  return runs
    .filter((run) => {
      const normalized = normalizeName(run.model_version);
      return normalized !== '' && (aliases.has(normalized) || aliases.has(normalized.replace(/\s+/g, '')));
    })
    .map((run) => {
      const benchmark = benchmarkById.get(run.benchmark_id);
      return {
        benchmarkSlug: run.benchmark_slug ?? benchmark?.slug ?? run.benchmark_id,
        benchmark: run.benchmark_name ?? benchmark?.name ?? run.benchmark_id,
        score: finite(run.score),
        stderr: finite(run.stderr),
        scoreMetric: text(run.score_metric),
        sourceName: text(run.source_name),
        sourceLink: text(run.source_link),
        releaseDate: text(run.release_date),
      };
    })
    .sort((a, b) => a.benchmark.localeCompare(b.benchmark));
};

const findPoliBenchModel = (
  model: Pick<AaModel, 'openrouter_id'>,
  snapshot: PublicPoliBenchSnapshot | null | undefined,
): PublicPoliBenchModel | null => {
  const key = text(model.openrouter_id)?.toLowerCase();
  if (!key || !snapshot) return null;
  return snapshot.models.find((entry) => entry.modelSlug.toLowerCase() === key) ?? null;
};

const poliBenchModelUrl = (slug: string): string =>
  `https://polibench.jonathanrreed.com/models/${slug.split('/').map(encodeURIComponent).join('/')}/`;

const metric = (
  key: string,
  label: string,
  value: number | null,
  unit: string,
  source: ModelPageMetric['source'],
): ModelPageMetric => ({ key, label, value, unit, source });

export const buildModelPageRecord = (
  model: AaModel,
  slug: string,
  context: ModelPageContext = {},
): ModelPageRecord => {
  const name = text(model.name) ?? text(model.slug) ?? model.id;
  const provider = text(model.company_name) ?? text(model.creator_name) ?? 'Unknown provider';
  const openRouterId = text(model.openrouter_id);
  const huggingFaceId = text(model.hf_model_id);
  const poliBench = findPoliBenchModel(model, context.poliBench);
  const now = new Date().toISOString();

  const aliases: ModelPassportAlias[] = [
    {
      sourceKey: 'artificial_analysis',
      sourceName: 'Artificial Analysis',
      sourceModelKey: text(model.slug) ?? model.id,
      sourceModelName: name,
      matchMethod: 'source_native',
      confidence: 1,
      provenance: 'aa_models row',
      updatedAt: model.last_seen ?? now,
    },
  ];
  if (openRouterId) {
    aliases.push({
      sourceKey: 'openrouter',
      sourceName: 'OpenRouter',
      sourceModelKey: openRouterId,
      sourceModelName: text(model.openrouter_name),
      matchMethod: 'explicit_cross_source',
      confidence: 1,
      provenance: 'openrouter_models catalog match',
      updatedAt: model.last_seen ?? now,
    });
  }
  if (huggingFaceId) {
    aliases.push({
      sourceKey: 'huggingface',
      sourceName: 'Hugging Face Hub',
      sourceModelKey: huggingFaceId,
      sourceModelName: null,
      matchMethod: 'explicit_cross_source',
      confidence: 1,
      provenance: 'huggingface_models catalog match',
      updatedAt: text(model.hf_last_modified) ?? model.last_seen ?? now,
    });
  }
  if (text(model.litellm_model_id)) {
    aliases.push({
      sourceKey: 'litellm',
      sourceName: 'LiteLLM',
      sourceModelKey: model.litellm_model_id as string,
      sourceModelName: null,
      matchMethod: 'explicit_cross_source',
      confidence: 1,
      provenance: 'litellm catalog match',
      updatedAt: model.last_seen ?? now,
    });
  }
  if (poliBench) {
    aliases.push({
      sourceKey: 'polibench',
      sourceName: 'PoliBench',
      sourceModelKey: poliBench.modelSlug,
      sourceModelName: poliBench.label,
      matchMethod: 'explicit_cross_source',
      confidence: 1,
      provenance: 'polibench public snapshot, OpenRouter slug match',
      updatedAt: poliBench.lastRunFinishedAt
        ? new Date(poliBench.lastRunFinishedAt).toISOString()
        : model.last_seen ?? now,
    });
  }

  const supportedParameters = list(model.openrouter_supported_parameters);
  const inputModalities = list(model.openrouter_input_modalities);
  const outputModalities = list(model.openrouter_output_modalities);
  const capabilities = [
    supportedParameters.includes('tools') || model.litellm_supports_function_calling ? 'Tool calls' : null,
    inputModalities.includes('image') || model.litellm_supports_vision ? 'Image input' : null,
    outputModalities.includes('image') ? 'Image output' : null,
    model.litellm_supports_reasoning ? 'Reasoning' : null,
    model.litellm_supports_prompt_caching ? 'Prompt caching' : null,
    model.litellm_supports_web_search ? 'Web search' : null,
    model.litellm_supports_system_messages ? 'System messages' : null,
  ].filter((value): value is string => value !== null);

  return {
    schema: MODEL_PAGE_SCHEMA,
    id: model.id,
    slug,
    path: modelPagePath(slug),
    url: `${SITE_ORIGIN}${modelPagePath(slug)}`,
    name,
    provider,
    aaSlug: text(model.slug),
    aaEvidenceNote: aaEvidenceNote(model.source_metadata),
    firstSeen: text(model.first_seen),
    lastSeen: text(model.last_seen),
    lastSeenDate: isoDate(text(model.last_seen)),
    current: isCurrentMeasuredModel(model),
    pricing: [
      metric('price_1m_input_tokens', 'Input price per 1M tokens', positive(model.price_1m_input_tokens), 'USD', 'Artificial Analysis'),
      metric('price_1m_output_tokens', 'Output price per 1M tokens', positive(model.price_1m_output_tokens), 'USD', 'Artificial Analysis'),
      metric('price_1m_blended_3_to_1', 'Blended price per 1M tokens, 3:1 input to output', positive(model.price_1m_blended_3_to_1), 'USD', 'Artificial Analysis'),
      metric('openrouter_prompt_price_1m', 'OpenRouter prompt price per 1M tokens', positive(model.openrouter_prompt_price_1m), 'USD', 'OpenRouter'),
      metric('openrouter_completion_price_1m', 'OpenRouter completion price per 1M tokens', positive(model.openrouter_completion_price_1m), 'USD', 'OpenRouter'),
      metric('openrouter_endpoint_min_prompt_price_1m', 'Cheapest OpenRouter route, prompt', positive(model.openrouter_endpoint_min_prompt_price_1m), 'USD', 'OpenRouter'),
      metric('openrouter_endpoint_min_completion_price_1m', 'Cheapest OpenRouter route, completion', positive(model.openrouter_endpoint_min_completion_price_1m), 'USD', 'OpenRouter'),
    ],
    speed: [
      metric('median_output_tokens_per_second', 'Median output speed', positive(model.median_output_tokens_per_second), 'tokens per second', 'Artificial Analysis'),
      metric('median_time_to_first_token_seconds', 'Median time to first token', positive(model.median_time_to_first_token_seconds), 'seconds', 'Artificial Analysis'),
      metric('median_time_to_first_answer_token', 'Median time to first answer token', positive(model.median_time_to_first_answer_token), 'seconds', 'Artificial Analysis'),
    ],
    context: [
      metric('openrouter_context_length', 'Context length on OpenRouter', positive(model.openrouter_context_length), 'tokens', 'OpenRouter'),
      metric('litellm_max_input_tokens', 'Max input tokens in LiteLLM', positive(model.litellm_max_input_tokens), 'tokens', 'LiteLLM'),
      metric('litellm_max_output_tokens', 'Max output tokens in LiteLLM', positive(model.litellm_max_output_tokens), 'tokens', 'LiteLLM'),
    ],
    benchmarks: [
      metric('mmlu_pro', 'MMLU-Pro', finite(model.mmlu_pro), 'fraction correct', 'Artificial Analysis'),
      metric('gpqa', 'GPQA Diamond', finite(model.gpqa), 'fraction correct', 'Artificial Analysis'),
      metric('hle', "Humanity's Last Exam", finite(model.hle), 'fraction correct', 'Artificial Analysis'),
      metric('aime', 'AIME', finite(model.aime), 'fraction correct', 'Artificial Analysis'),
      metric('livecodebench', 'LiveCodeBench', finite(model.livecodebench), 'fraction correct', 'Artificial Analysis'),
      metric('scicode', 'SciCode', finite(model.scicode), 'fraction correct', 'Artificial Analysis'),
      metric('math_500', 'MATH-500', finite(model.math_500), 'fraction correct', 'Artificial Analysis'),
    ],
    indexes: [
      metric('aa_intelligence_index', 'Artificial Analysis Intelligence Index', finite(model.aa_intelligence_index), 'points', 'Artificial Analysis'),
      metric('aa_coding_index', 'Artificial Analysis Coding Index', finite(model.aa_coding_index), 'points', 'Artificial Analysis'),
      metric('aa_agentic_index', 'Artificial Analysis Agentic Index', finite(model.aa_agentic_index), 'points', 'Artificial Analysis'),
      metric('aa_math_index', 'Artificial Analysis Math Index', finite(model.aa_math_index), 'points', 'Artificial Analysis'),
    ],
    epochRuns: matchEpochRuns(model, context.epochRuns ?? [], context.epochBenchmarks ?? []),
    catalog: {
      openRouterId,
      openRouterName: text(model.openrouter_name),
      openRouterUrl: openRouterId ? `https://openrouter.ai/${openRouterId}` : null,
      inputModalities,
      outputModalities,
      supportedParameters,
      isFree: model.openrouter_is_free === true,
      usageRank: positive(model.openrouter_usage_rank),
      usageTokens: positive(model.openrouter_usage_tokens),
      endpointProviderCount: positive(model.openrouter_endpoint_provider_count),
      endpointProviders: list(model.openrouter_endpoint_providers),
      quantizations: list(model.openrouter_endpoint_quantizations),
      huggingFaceId,
      huggingFaceUrl: huggingFaceId ? `https://huggingface.co/${huggingFaceId}` : null,
      huggingFaceDownloads: positive(model.hf_downloads),
      huggingFaceLikes: positive(model.hf_likes),
      huggingFaceLastModified: text(model.hf_last_modified),
      liteLlmId: text(model.litellm_model_id),
      liteLlmProvider: text(model.litellm_provider),
      liteLlmMode: text(model.litellm_mode),
      capabilities,
    },
    poliBench: poliBench
      ? {
          slug: poliBench.modelSlug,
          label: poliBench.label,
          status: poliBench.status,
          evidenceLabel: poliBench.evidenceLabel,
          completionRate: poliBench.completionRate,
          robustness: poliBench.robustness,
          lastRunFinishedAt: poliBench.lastRunFinishedAt
            ? new Date(poliBench.lastRunFinishedAt).toISOString()
            : null,
          url: poliBenchModelUrl(poliBench.modelSlug),
        }
      : null,
    aliases,
    routes: buildPassportRoutes(name, aliases),
  };
};

/** Slugs are unique by construction; a collision gets a numeric suffix rather than a lost page. */
export const buildModelPageRecords = (
  models: AaModel[],
  context: ModelPageContext = {},
): ModelPageRecord[] => {
  const seen = new Map<string, number>();
  return models.map((model) => {
    const base = modelPageSlug(model);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const slug = count === 0 ? base : `${base}-${count + 1}`;
    return buildModelPageRecord(model, slug, context);
  });
};

const SOURCE_URLS = {
  'Artificial Analysis': 'https://artificialanalysis.ai/',
  OpenRouter: 'https://openrouter.ai/',
  LiteLLM: 'https://github.com/BerriAI/litellm',
  'Hugging Face Hub': 'https://huggingface.co/',
  'Epoch AI': 'https://epoch.ai/benchmarks',
  PoliBench: 'https://polibench.jonathanrreed.com/',
} as const;

export const modelPageDescription = (record: ModelPageRecord): string => {
  const parts: string[] = [];
  const input = record.pricing.find((m) => m.key === 'price_1m_input_tokens')?.value;
  const output = record.pricing.find((m) => m.key === 'price_1m_output_tokens')?.value;
  const speed = record.speed.find((m) => m.key === 'median_output_tokens_per_second')?.value;
  const index = record.indexes.find((m) => m.key === 'aa_intelligence_index')?.value;
  if (input !== null && input !== undefined && output !== null && output !== undefined) {
    parts.push(`$${input.toFixed(2)} in and $${output.toFixed(2)} out per 1M tokens`);
  }
  if (speed) parts.push(`${speed.toFixed(0)} tokens per second`);
  if (index !== null && index !== undefined) parts.push(`AA Index ${index.toFixed(1)}`);
  const measured = parts.length ? ` ${parts.join(', ')}.` : '';
  return `${record.name} by ${record.provider}: price, speed, context, benchmark scores, and catalog identifiers with source and observation dates.${measured}`;
};

const propertyValue = (m: ModelPageMetric) => ({
  '@type': 'PropertyValue',
  name: m.label,
  propertyID: m.key,
  value: m.value,
  unitText: m.unit,
  description: `Source: ${m.source}`,
});

/** Nodes appended to the page graph. The Layout already emits WebSite, WebPage, and the author. */
export const buildModelJsonLd = (record: ModelPageRecord): Record<string, unknown>[] => {
  const measured = [...record.pricing, ...record.speed, ...record.context, ...record.benchmarks, ...record.indexes]
    .filter((m) => m.value !== null);
  const sources = new Set<string>([SOURCE_URLS['Artificial Analysis']]);
  if (record.catalog.openRouterId) sources.add(SOURCE_URLS.OpenRouter);
  if (record.catalog.liteLlmId) sources.add(SOURCE_URLS.LiteLLM);
  if (record.catalog.huggingFaceId) sources.add(SOURCE_URLS['Hugging Face Hub']);
  if (record.epochRuns.length) sources.add(SOURCE_URLS['Epoch AI']);
  if (record.poliBench) sources.add(SOURCE_URLS.PoliBench);
  const sameAs = [record.catalog.openRouterUrl, record.catalog.huggingFaceUrl, record.poliBench?.url ?? null]
    .filter((value): value is string => value !== null);
  const identifiers = record.aliases.map((alias) => ({
    '@type': 'PropertyValue',
    propertyID: alias.sourceKey,
    name: alias.sourceName,
    value: alias.sourceModelKey,
  }));

  return [
    {
      '@type': 'SoftwareApplication',
      '@id': `${record.url}#model`,
      name: record.name,
      applicationCategory: 'Large language model',
      provider: { '@type': 'Organization', name: record.provider },
      identifier: identifiers,
      ...(sameAs.length ? { sameAs } : {}),
      url: record.url,
    },
    {
      '@type': 'Dataset',
      '@id': `${record.url}#dataset`,
      name: `${record.name} measurements on AI Stats`,
      description: modelPageDescription(record),
      url: record.url,
      about: { '@id': `${record.url}#model` },
      creator: AUTHOR_REF,
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      isBasedOn: [...sources],
      ...(record.firstSeen && record.lastSeen
        ? { temporalCoverage: `${record.firstSeen.slice(0, 10)}/${record.lastSeen.slice(0, 10)}` }
        : {}),
      ...(record.lastSeenDate ? { dateModified: record.lastSeenDate } : {}),
      distribution: [
        {
          '@type': 'DataDownload',
          encodingFormat: 'application/json',
          contentUrl: `${SITE_ORIGIN}/api/model-pages/${record.slug}.json`,
        },
      ],
      variableMeasured: measured.map(propertyValue),
      inLanguage: 'en-US',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${record.url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'AI Stats', item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Models', item: `${SITE_ORIGIN}/models` },
        { '@type': 'ListItem', position: 3, name: record.name, item: record.url },
      ],
    },
  ];
};

const money = (value: number | null): string => (value === null ? 'n/a' : `$${value.toFixed(value < 0.01 ? 4 : 2)}`);
const score = (value: number | null): string => {
  if (value === null) return 'n/a';
  return value <= 1 ? `${(value * 100).toFixed(1)}%` : value.toFixed(1);
};

/** Compact per-model lines for llms-full.txt. */
export const modelRecordToText = (record: ModelPageRecord): string => {
  const get = (group: ModelPageMetric[], key: string) => group.find((m) => m.key === key)?.value ?? null;
  const lines = [
    `### ${record.name} (${record.provider})`,
    `- Page: ${record.url}`,
    `- JSON: ${SITE_ORIGIN}/api/model-pages/${record.slug}.json`,
    `- Price per 1M tokens (Artificial Analysis): input ${money(get(record.pricing, 'price_1m_input_tokens'))}, output ${money(get(record.pricing, 'price_1m_output_tokens'))}, blended 3:1 ${money(get(record.pricing, 'price_1m_blended_3_to_1'))}`,
    `- Speed (Artificial Analysis medians): ${get(record.speed, 'median_output_tokens_per_second')?.toFixed(1) ?? 'n/a'} tokens/s, time to first token ${get(record.speed, 'median_time_to_first_token_seconds')?.toFixed(2) ?? 'n/a'} s`,
    `- AA indexes: intelligence ${score(get(record.indexes, 'aa_intelligence_index'))}, coding ${score(get(record.indexes, 'aa_coding_index'))}, math ${score(get(record.indexes, 'aa_math_index'))}`,
    `- Benchmarks: ${record.benchmarks.map((m) => `${m.label} ${score(m.value)}`).join(', ')}`,
  ];
  const contextLength = get(record.context, 'openrouter_context_length');
  if (contextLength) lines.push(`- Context length (OpenRouter): ${contextLength.toLocaleString('en-US')} tokens`);
  if (record.catalog.openRouterId) lines.push(`- OpenRouter id: ${record.catalog.openRouterId}`);
  if (record.catalog.huggingFaceId) lines.push(`- Hugging Face: ${record.catalog.huggingFaceId}`);
  if (record.epochRuns.length) {
    lines.push(`- Epoch AI runs: ${record.epochRuns.map((run) => `${run.benchmark} ${run.score === null ? 'n/a' : run.score <= 1 ? `${(run.score * 100).toFixed(1)}%` : run.score.toFixed(1)}`).join(', ')}`);
  }
  if (record.poliBench) lines.push(`- PoliBench profile: ${record.poliBench.url} (${record.poliBench.evidenceLabel})`);
  if (record.firstSeen || record.lastSeen) {
    lines.push(`- Observed: first ${record.firstSeen?.slice(0, 10) ?? 'n/a'}, last ${record.lastSeen?.slice(0, 10) ?? 'n/a'}`);
  }
  return lines.join('\n');
};
