import {readFileSync} from 'node:fs';

/**
 * Test support: the files that together make up the homepage after
 * Dashboard.astro was split. Source-text tests read a specific file for
 * positive assertions and `readDashboardSources()` for "must never appear"
 * checks, so a retired string cannot come back in any of the pieces.
 * Paths are relative to the repository root (where `bun test` runs).
 */
export const DASHBOARD_SOURCE_FILES = {
  shell: 'src/components/Dashboard.astro',
  leaderboardSection: 'src/components/dashboard/LeaderboardSection.astro',
  modelBrowserSection: 'src/components/dashboard/ModelBrowserSection.astro',
  publicCatalogPanel: 'src/components/dashboard/PublicCatalogPanel.astro',
  leaderboardData: 'src/lib/dashboard-leaderboard.ts',
  serverFormat: 'src/lib/dashboard-format.ts',
  client: 'src/components/dashboard/client/dashboard-client.ts',
  clientFormat: 'src/components/dashboard/client/format.ts',
  clientModelMarkup: 'src/components/dashboard/client/model-markup.ts',
  clientOpenRouterBoard: 'src/components/dashboard/client/openrouter-board.ts',
  shellStyles: 'src/components/dashboard/styles/shell.css',
  publicCatalogStyles: 'src/components/dashboard/styles/public-catalog.css',
  modelBrowserStyles: 'src/components/dashboard/styles/model-browser.css',
  leaderboardStyles: 'src/components/dashboard/styles/leaderboard.css',
  responsiveStyles: 'src/components/dashboard/styles/responsive.css',
  polishStyles: 'src/components/dashboard/styles/polish.css',
} as const;

export type DashboardSourceFile = keyof typeof DASHBOARD_SOURCE_FILES;

export const readDashboardSource = (file: DashboardSourceFile): string =>
  readFileSync(DASHBOARD_SOURCE_FILES[file], 'utf8');

/** Every homepage piece concatenated, for negative assertions. */
export const readDashboardSources = (): string =>
  (Object.keys(DASHBOARD_SOURCE_FILES) as DashboardSourceFile[]).map(readDashboardSource).join('\n');
