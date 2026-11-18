/** Loads lab pages once per build from the model pages plus AA task cost and release date. */
import { getModelCatalogData } from './model-catalog-data';
import { getModelPageRecords } from './model-pages-data';
import { buildLabPages, type LabExtras, type LabPage } from './lab-pages';

async function load(): Promise<LabPage[]> {
  const [records, data] = await Promise.all([getModelPageRecords(), getModelCatalogData()]);
  const extras = new Map<string, LabExtras>();
  for (const model of data.aaModels) extras.set(model.id, { releaseDate: model.source_metadata?.release_date ?? null });
  for (const model of data.records) {
    if (model.source !== 'aa') continue;
    extras.set(model.id, { ...extras.get(model.id), taskCost: model.aaTaskCost ?? null, indexVersion: model.indexVersion ?? null });
  }
  return buildLabPages(records, extras);
}

let cached: Promise<LabPage[]> | undefined;
export const getLabPageData = (): Promise<LabPage[]> =>
  (cached ??= load().catch((error) => { cached = undefined; throw error; }));

/** The route list for nav, sitemap and cross-links. */
export async function getLabPages(): Promise<Array<{ provider: string; slug: string; path: string; modelCount: number }>> {
  return (await getLabPageData()).map(({ provider, slug, path, models }) => ({ provider, slug, path, modelCount: models.length }));
}
