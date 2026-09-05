import type { APIRoute } from 'astro';
import { getDataFreshness, toIsoDate } from '../lib/data-freshness';
import { SITE_PAGES, STATIC_PAGE_DATE_MODIFIED } from '../lib/site-pages';
import { getModelPageRecords } from '../lib/model-pages-data';

export const prerender = true;

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
  const [{ updatedAt }, modelRecords] = await Promise.all([getDataFreshness(), getModelPageRecords()]);
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
  const urls = [...pageUrls, ...modelUrls].join('\n');

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
