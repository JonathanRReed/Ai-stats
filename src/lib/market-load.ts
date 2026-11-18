/**
 * Build-time inputs for /market, read only through the existing loaders.
 * One promise per build so the page and any future endpoint share the same rows.
 */
import {getModelPageRecords} from './model-pages-data';
import {getOpenRouterUsageSnapshot} from './openrouter-usage-server';
import {getPublicCatalogModels} from './supabase';
import {buildLatencySpeed, buildRoutePrices, buildUsageScore, type RouteCatalogRow} from './market-data';

async function load() {
  const [records, usage, catalogs] = await Promise.all([getModelPageRecords(), getOpenRouterUsageSnapshot(), getPublicCatalogModels()]);
  const catalog = catalogs.openRouterModels as unknown as RouteCatalogRow[];
  const listFetchedAt = catalog.map((row) => row.fetched_at).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return {
    usageScore: buildUsageScore(records, usage?.snapshot ?? null, catalog),
    usageReceipt: usage?.receipt ?? null,
    routes: buildRoutePrices(catalog, catalogs.openRouterEndpointSummaries, records),
    routeCatalogCount: catalog.length,
    listFetchedAt,
    latency: buildLatencySpeed(records),
    recordCount: records.length,
    boundRecords: records.filter((record) => record.catalog.openRouterId).length,
  };
}

let cached: ReturnType<typeof load> | undefined;
export const getMarketData = () => cached ??= load().catch((error) => { cached = undefined; throw error; });
