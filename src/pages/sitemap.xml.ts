import type { APIRoute } from 'astro';
import { getDataFreshness, toIsoDate } from '../lib/data-freshness';
import {
  SITE_PAGES,
  STATIC_PAGE_DATE_MODIFIED,
  collectExtraRoutes,
  type ExtraRouteLoader,
} from '../lib/site-pages';
import { getModelPageRecords } from '../lib/model-pages-data';
import { getLabPages } from '../lib/lab-pages-data';
import { getBenchmarkPages } from '../lib/benchmark-pages-data';
import { getMatchups } from '../lib/head-to-head-data';

export const prerender = true;

/*
 * ---------------------------------------------------------------------------
 * EXTRA DETAIL ROUTES: one entry per family of data-driven detail pages.
 *
 * Each loader returns `{ path, lastmod? }[]` (lastmod is an optional YYYY-MM-DD; without it
 * the page gets the data refresh date). Paths already listed above (SITE_PAGES, model pages)
 * or repeated across loaders are dropped, so overlap is harmless.
 *
 * Import a loader module only once that module exists: a static import of a missing file
 * fails the whole build. Example entry:
 *
 *   {
 *     name: 'labs',
 *     changefreq: 'weekly',
 *     priority: '0.6',
 *     load: async () => (await getLabPages()).map((page) => ({ path: page.path })),
 *   },
 * ---------------------------------------------------------------------------
 */
const EXTRA_ROUTE_LOADERS: ExtraRouteLoader[] = [
  { name: 'labs', changefreq: 'weekly', priority: '0.6', load: async () => (await getLabPages()).map((page) => ({ path: page.path })) },
  { name: 'benchmarks', changefreq: 'weekly', priority: '0.6', load: async () => (await getBenchmarkPages()).map((page) => ({ path: page.path })) },
  { name: 'matchups', changefreq: 'weekly', priority: '0.5', load: async () => (await getMatchups()).map((matchup) => ({ path: matchup.path })) },
];

/**
 * The one sitemap this site ships. robots.txt points at /sitemap.xml and
 * Search Console has that URL submitted, so the path is fixed.
 *
 * Generating it here rather than committing a static file keeps two guarantees:
 * the URL set is the built page set, and every `<lastmod>` is the same value
 * the page's JSON-LD reports as `dateModified` (both read src/lib/site-pages.ts
 * and src/lib/data-freshness.ts, which is resolved once per build).
 */
export const GET: APIRoute = async ({ site }) => {
  const origin = site?.href ?? 'https://aistats.jonathanrreed.com/';
  const [{ updatedAt }, modelRecords, extraGroups] = await Promise.all([
    getDataFreshness(),
    getModelPageRecords(),
    Promise.all(
      EXTRA_ROUTE_LOADERS.map(async (loader) => {
        try {
          return { loader, routes: await loader.load() };
        } catch (error) {
          // A missing detail family must fail loudly, not ship a sitemap without it.
          throw new Error(`sitemap: the "${loader.name}" route loader failed`, { cause: error });
        }
      }),
    ),
  ]);
  const dataDrivenDate = toIsoDate(updatedAt) ?? STATIC_PAGE_DATE_MODIFIED;

  const entry = (loc: string, lastmod: string, changefreq: string, priority: string) =>
    [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');

  const pageUrls = SITE_PAGES.map((page) =>
    entry(
      new URL(page.path, origin).href,
      page.dataDriven ? dataDrivenDate : STATIC_PAGE_DATE_MODIFIED,
      page.changefreq,
      page.priority,
    ),
  );
  // Model pages stamp the row's own last observation, so a model that stopped
  // being observed keeps an honest, older lastmod.
  const modelUrls = modelRecords.map((record) =>
    entry(new URL(record.path, origin).href, record.lastSeenDate ?? dataDrivenDate, 'weekly', '0.6'),
  );
  const seen = new Set([...SITE_PAGES.map((page) => page.path), ...modelRecords.map((record) => record.path)]);
  const extraUrls = collectExtraRoutes(extraGroups, dataDrivenDate, seen).map((row) =>
    entry(new URL(row.path, origin).href, row.lastmod, row.changefreq, row.priority),
  );
  const urls = [...pageUrls, ...modelUrls, ...extraUrls].join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
