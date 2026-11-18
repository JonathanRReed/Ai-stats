/**
 * Single source of truth for the indexable page set and its revision dates.
 *
 * Both the JSON-LD `dateModified` in src/components/Layout.astro and the
 * `<lastmod>` in src/pages/sitemap.xml.ts read from here, so the two can never
 * disagree for a given URL. Every date is committed content — the build clock
 * is never consulted.
 */

import {
  BENCHMARKS_INDEX_PATH,
  CHANGES_PATH,
  LABS_INDEX_PATH,
  MATCHUPS_INDEX_PATH,
  PLAY_PATH,
} from './site-routes';

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

/**
 * Every page that ships in the build and is allowed into the index.
 *
 * The section index pages (/benchmarks through /play) are data-driven: each one must pass
 * `dateModified` from src/lib/data-freshness.ts to Layout.astro so its JSON-LD agrees with
 * the `<lastmod>` the sitemap stamps here.
 */
export const SITE_PAGES: SitePage[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0', dataDriven: true },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/compare', changefreq: 'monthly', priority: '0.7' },
  { path: '/models', changefreq: 'weekly', priority: '0.8', dataDriven: true },
  { path: BENCHMARKS_INDEX_PATH, changefreq: 'weekly', priority: '0.8', dataDriven: true },
  { path: LABS_INDEX_PATH, changefreq: 'weekly', priority: '0.8', dataDriven: true },
  { path: MATCHUPS_INDEX_PATH, changefreq: 'weekly', priority: '0.7', dataDriven: true },
  // /market is built but unlisted and noindexed: two of its three views have no data to plot until
  // reviewed OpenRouter identities exist for the scored models. List it here when they do.
  { path: CHANGES_PATH, changefreq: 'weekly', priority: '0.6', dataDriven: true },
  { path: PLAY_PATH, changefreq: 'weekly', priority: '0.5', dataDriven: true },
  { path: '/contact', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.5' },
  { path: '/subprocessors', changefreq: 'yearly', priority: '0.5' },
];

/** One data-driven detail page another module lists (a lab, a benchmark, a matchup). */
export type ExtraRoute = {
  path: string;
  /** ISO date (YYYY-MM-DD) of the page's own newest observation, when it has one. */
  lastmod?: string | null;
};

/** A family of detail routes for the sitemap, loaded at build time. */
export type ExtraRouteLoader = {
  /** Shown in errors so a broken loader names itself. */
  name: string;
  changefreq: SitePage['changefreq'];
  priority: string;
  load: () => Promise<ExtraRoute[]>;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Flattens loaded detail routes into sitemap rows: drops any path that is not a rooted
 * site path or that an earlier list (or `seen`) already holds, and falls back to
 * `fallbackDate` when a route has no valid date of its own.
 */
export const collectExtraRoutes = (
  groups: { loader: Pick<ExtraRouteLoader, 'changefreq' | 'priority'>; routes: ExtraRoute[] }[],
  fallbackDate: string,
  seen: Set<string> = new Set(),
): { path: string; lastmod: string; changefreq: string; priority: string }[] => {
  const rows: { path: string; lastmod: string; changefreq: string; priority: string }[] = [];
  for (const { loader, routes } of groups) {
    for (const route of routes) {
      const path = route.path;
      if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || seen.has(path)) continue;
      seen.add(path);
      const lastmod = route.lastmod && ISO_DATE.test(route.lastmod) ? route.lastmod : fallbackDate;
      rows.push({ path, lastmod, changefreq: loader.changefreq, priority: loader.priority });
    }
  }
  return rows;
};
