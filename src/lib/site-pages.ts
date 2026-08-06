/**
 * Single source of truth for the indexable page set and its revision dates.
 *
 * Both the JSON-LD `dateModified` in src/components/Layout.astro and the
 * `<lastmod>` in src/pages/sitemap.xml.ts read from here, so the two can never
 * disagree for a given URL. Every date is committed content — the build clock
 * is never consulted.
 */

/** Last editorial revision date for pages that are not data-driven. */
export const STATIC_PAGE_DATE_MODIFIED = '2026-07-16';

export type SitePage = {
  /** Path as it appears in the canonical URL. */
  path: string;
  changefreq: 'weekly' | 'monthly' | 'yearly';
  priority: string;
  /**
   * `true` when the page stamps its own `dateModified` from
   * src/lib/data-freshness.ts instead of STATIC_PAGE_DATE_MODIFIED.
   */
  dataDriven?: boolean;
};

/** Every page that ships in the build and is allowed into the index. */
export const SITE_PAGES: SitePage[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0', dataDriven: true },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/compare', changefreq: 'monthly', priority: '0.7' },
  { path: '/contact', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.5' },
  { path: '/subprocessors', changefreq: 'yearly', priority: '0.5' },
];
