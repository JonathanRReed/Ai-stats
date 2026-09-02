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

  const models = input.canonicalModels.map((model) => ({
    canonicalKey: model.canonical_key,
    displayName: model.display_name,
    provider: model.provider_name,
    family: model.model_family,
    releaseDate: model.release_date,
    updatedAt: model.updated_at,
    aliases: (aliasesByModel.get(model.id) ?? []).sort((a, b) =>
      a.sourceKey.localeCompare(b.sourceKey) || a.sourceModelKey.localeCompare(b.sourceModelKey)),
    routes: {
      aiStatsCompare: route('/compare?model=', model.display_name),
      aiDragRace: route('https://ai-dragrace.jonathanrreed.com/?model=', model.display_name),
      aiNewsSearch: route('https://ai-news.helloworldfirm.com/?model=', model.canonical_key),
    },
  }));

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
