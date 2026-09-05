/**
 * Loads the enriched model set once per build and turns it into page records.
 * Shared by the model pages, the per-model JSON endpoints, the sitemap, and
 * llms-full.txt so every surface describes the same rows.
 */
import { enrichModelsWithPublicCatalogData, getModels, getPublicCatalogModels } from './supabase';
import { getEpochEvidence } from './epoch-evidence';
import { getPublicPoliBenchSnapshot } from './polibench-snapshot';
import { buildModelPageRecords, type ModelPageRecord } from './model-pages';

const load = async (): Promise<ModelPageRecord[]> => {
  const [baseModels, publicCatalogs, epochEvidence, poliBench] = await Promise.all([
    getModels(),
    getPublicCatalogModels(),
    getEpochEvidence(),
    getPublicPoliBenchSnapshot(),
  ]);
  const models = enrichModelsWithPublicCatalogData(baseModels, publicCatalogs);
  return buildModelPageRecords(models, {
    epochBenchmarks: epochEvidence.epochBenchmarks,
    epochRuns: epochEvidence.epochRuns,
    poliBench,
  });
};

let cached: Promise<ModelPageRecord[]> | undefined;
export const getModelPageRecords = (): Promise<ModelPageRecord[]> => (cached ??= load());
