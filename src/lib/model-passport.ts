import type {
  CanonicalModelRow,
  IntelligenceSourceRow,
  ModelAliasRow,
} from './supabase';

export const MODEL_PASSPORT_SCHEMA = 'ai-ecosystem-model-passport.v1' as const;

export type ModelPassportAlias = {
  sourceKey: string;
  sourceName: string;
  sourceModelKey: string;
  sourceModelName: string | null;
  matchMethod: 'source_native' | 'explicit_cross_source';
  confidence: number;
  provenance: string;
  updatedAt: string;
};

export type ModelPassport = {
  canonicalKey: string;
  displayName: string;
  provider: string | null;
  family: string | null;
  releaseDate: string | null;
  updatedAt: string;
  aliases: ModelPassportAlias[];
  routes: {
    aiStatsCompare: string;
    aiDragRace: string;
    aiNewsSearch: string;
    promptInfo: string | null;
    poliBench: string | null;
  };
};

export type ModelPassportSnapshot = {
  schemaVersion: typeof MODEL_PASSPORT_SCHEMA;
  owner: 'ai-stats';
  generatedAt: string;
  delivery: {
    mode: 'build-snapshot';
    refreshRequiresBuild: true;
  };
  compatibility: {
    minimumReaderMajor: 1;
    additiveFieldsAllowed: true;
  };
  counts: {
    models: number;
    aliases: number;
    sources: number;
  };
  models: ModelPassport[];
};

const route = (base: string, key: string): string =>
  `${base}${encodeURIComponent(key)}`;

/**
 * Sibling-site routes. Each site reads a different key:
 * - AI Stats compare accepts a display name or slug.
 * - AI Drag Racing wants a provider-native model id plus the provider; the
 *   OpenRouter alias is the one route every sibling can reach.
 * - AI News searches free text, so it gets the display name.
 * - Prompt Info and PoliBench key on the OpenRouter slug and are only linked
 *   when that alias is known, so the passport never emits a dead link.
 */
export function buildPassportRoutes(
  displayName: string,
  aliases: ModelPassportAlias[],
): ModelPassport['routes'] {
  const openRouterKey = aliases.find((alias) => alias.sourceKey === 'openrouter')?.sourceModelKey ?? null;
  const poliBenchKey = aliases.find((alias) => alias.sourceKey === 'polibench')?.sourceModelKey ?? null;
  const dragRaceKey = openRouterKey ?? displayName;
  const dragRaceParams = new URLSearchParams({ model: dragRaceKey });
  if (openRouterKey) dragRaceParams.set('provider', 'openrouter');
  return {
    aiStatsCompare: route('/compare?model=', displayName),
    aiDragRace: `https://ai-dragrace.jonathanrreed.com/?${dragRaceParams.toString()}`,
    aiNewsSearch: route('https://ai-news.helloworldfirm.com/?q=', displayName),
    promptInfo: openRouterKey ? route('https://prompt-info.helloworldfirm.com/?model=', openRouterKey) : null,
    poliBench: poliBenchKey
      ? `https://polibench.jonathanrreed.com/models/${poliBenchKey.split('/').map(encodeURIComponent).join('/')}/`
      : null,
  };
}

export function buildModelPassportSnapshot(input: {
  canonicalModels: CanonicalModelRow[];
  aliases: ModelAliasRow[];
  sources: IntelligenceSourceRow[];
  generatedAt?: string;
}): ModelPassportSnapshot {
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const aliasesByModel = new Map<number, ModelPassportAlias[]>();

  for (const alias of input.aliases) {
    const source = sourceById.get(alias.intelligence_source_id);
    if (!source) continue;
    const current = aliasesByModel.get(alias.canonical_model_id) ?? [];
    current.push({
      sourceKey: source.source_key,
      sourceName: source.display_name,
      sourceModelKey: alias.source_model_key,
      sourceModelName: alias.source_model_name,
      matchMethod: alias.match_method,
      confidence: Number(alias.confidence),
      provenance: alias.provenance,
      updatedAt: alias.updated_at,
    });
    aliasesByModel.set(alias.canonical_model_id, current);
  }

  const models = input.canonicalModels.map((model) => {
    const aliases = (aliasesByModel.get(model.id) ?? []).sort((a, b) =>
      a.sourceKey.localeCompare(b.sourceKey) || a.sourceModelKey.localeCompare(b.sourceModelKey));
    return {
      canonicalKey: model.canonical_key,
      displayName: model.display_name,
      provider: model.provider_name,
      family: model.model_family,
      releaseDate: model.release_date,
      updatedAt: model.updated_at,
      aliases,
      routes: buildPassportRoutes(model.display_name, aliases),
    };
  });

  return {
    schemaVersion: MODEL_PASSPORT_SCHEMA,
    owner: 'ai-stats',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    delivery: { mode: 'build-snapshot', refreshRequiresBuild: true },
    compatibility: { minimumReaderMajor: 1, additiveFieldsAllowed: true },
    counts: {
      models: models.length,
      aliases: models.reduce((sum, model) => sum + model.aliases.length, 0),
      sources: input.sources.length,
    },
    models,
  };
}
