import type { APIRoute } from 'astro';
import { getDataFreshness, toIsoDate } from '../lib/data-freshness';
import { SITE_PAGES, STATIC_PAGE_DATE_MODIFIED } from '../lib/site-pages';

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
  const { updatedAt } = await getDataFreshness();
  const dataDrivenDate = toIsoDate(updatedAt) ?? STATIC_PAGE_DATE_MODIFIED;

  const urls = SITE_PAGES.map((page) => {
    const loc = new URL(page.path, origin).href;
    const lastmod = page.dataDriven ? dataDrivenDate : STATIC_PAGE_DATE_MODIFIED;
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${page.changefreq}</changefreq>`,
      `    <priority>${page.priority}</priority>`,
      '  </url>',
    ].join('\n');
  }).join('\n');

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
