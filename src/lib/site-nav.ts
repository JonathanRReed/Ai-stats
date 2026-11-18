import {
  BENCHMARKS_INDEX_PATH,
  CHANGES_PATH,
  LABS_INDEX_PATH,
  MATCHUPS_INDEX_PATH,
  PLAY_PATH,
} from './site-routes';

/**
 * The site's navigation model. The header, the mobile menu and the footer all read
 * these lists, so a section is named and ordered the same way everywhere.
 */

/** The `currentPage` keys a page can pass to Header.astro. */
export type NavKey =
  | 'dashboard'
  | 'compare'
  | 'models'
  | 'benchmarks'
  | 'labs'
  | 'play'
  | 'matchups'
  | 'market'
  | 'changes'
  | 'about'
  | 'contact'
  | 'privacy'
  | 'subprocessors'
  | 'not-found';

export type NavLink = { href: string; label: string; key: NavKey };

/** Primary destinations, shown inline in the desktop header. */
export const PRIMARY_NAV: NavLink[] = [
  { href: '/', label: 'Stats', key: 'dashboard' },
  { href: '/compare', label: 'Compare', key: 'compare' },
  { href: '/models', label: 'Models', key: 'models' },
  { href: BENCHMARKS_INDEX_PATH, label: 'Benchmarks', key: 'benchmarks' },
  { href: LABS_INDEX_PATH, label: 'Labs', key: 'labs' },
  { href: PLAY_PATH, label: 'Play', key: 'play' },
];

/** Further data sections, under the header's "More" disclosure. */
export const SECONDARY_NAV: NavLink[] = [
  { href: MATCHUPS_INDEX_PATH, label: 'Matchups', key: 'matchups' },
  { href: CHANGES_PATH, label: 'Changes', key: 'changes' },
];

/** Pages about the project itself. */
export const PROJECT_NAV: NavLink[] = [
  { href: '/about', label: 'About', key: 'about' },
  { href: '/contact', label: 'Contact', key: 'contact' },
];

/** Policy pages, footer only. */
export const POLICY_NAV: NavLink[] = [
  { href: '/privacy', label: 'Privacy', key: 'privacy' },
  { href: '/subprocessors', label: 'Subprocessors', key: 'subprocessors' },
];

/** Every section in the order the footer lists them. */
export const SECTION_NAV: NavLink[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

/** Canonical form of a request path: no `.html`, no trailing slash except the root. */
export const normalizeNavPath = (pathname: string): string => {
  const trimmed = pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  return trimmed.length > 1 ? trimmed.replace(/\/+$/, '') : '/';
};

/**
 * `aria-current` for a nav link. The link for the page being shown is `page`; the
 * link for the section a detail page sits in (a lab under Labs) is `true`.
 */
export const navAriaCurrent = (
  link: NavLink,
  currentPage: string | undefined,
  pathname: string,
): 'page' | 'true' | undefined => {
  if (currentPage !== link.key) return undefined;
  return normalizeNavPath(pathname) === link.href ? 'page' : 'true';
};
