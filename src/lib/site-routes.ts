// Kept free of imports so client bundles can build links without pulling in page-building code.
// Must stay identical to `slugify` in model-pages.ts; site-routes.test.ts holds the two together.
const slugify = (value: string): string =>
  value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * URL builders for every data-driven page family. Pages link to each other only through
 * these, so a route can never be spelled two ways.
 */
export const labPath = (provider: string): string => `/labs/${slugify(provider) || 'lab'}`;
export const benchmarkPath = (slug: string): string => `/benchmarks/${slugify(slug) || 'benchmark'}`;
/** Family slugs sort alphabetically so A-vs-B and B-vs-A are the same page. */
export const matchupPath = (familySlugA: string, familySlugB: string): string => {
  const [first, second] = [familySlugA, familySlugB].sort((a, b) => a.localeCompare(b));
  return `/compare/${first}-vs-${second}`;
};
export const familySlug = (family: string): string => slugify(family) || 'model';

export const LABS_INDEX_PATH = '/labs';
export const BENCHMARKS_INDEX_PATH = '/benchmarks';
export const MATCHUPS_INDEX_PATH = '/matchups';
export const MARKET_PATH = '/market';
export const CHANGES_PATH = '/changes';
export const PLAY_PATH = '/play';
