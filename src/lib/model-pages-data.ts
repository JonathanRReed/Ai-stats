/**
 * Loads the enriched model set once per build and turns it into page records.
 * Shared by the model pages, the per-model JSON endpoints, the sitemap, and
 * llms-full.txt so every surface describes the same rows.
 */
import { enrichModelsWithPublicCatalogData, getPublicCatalogModels } from './supabase';
import { getModelCatalogData } from './model-catalog-data';
import { getPublicPoliBenchSnapshot } from './polibench-snapshot';
import { buildModelPageRecords, type ModelPageRecord } from './model-pages';

const load = async (): Promise<ModelPageRecord[]> => {
  const [catalog, publicCatalogs, poliBench] = await Promise.all([
    getModelCatalogData(),
    getPublicCatalogModels(),
    getPublicPoliBenchSnapshot(),
  ]);
  const {currentAaModels:baseModels,epoch:epochEvidence}=catalog;
  const models = enrichModelsWithPublicCatalogData(baseModels, publicCatalogs, catalog.bindings);
  return buildModelPageRecords(models, {
    epochBenchmarks: epochEvidence.epochBenchmarks,
    epochRuns: epochEvidence.epochRuns,
    poliBench,
    verifiedBindings:catalog.bindings,
  });
};

let cached: Promise<ModelPageRecord[]> | undefined;
export const getModelPageRecords = (): Promise<ModelPageRecord[]> => (cached ??= load());
