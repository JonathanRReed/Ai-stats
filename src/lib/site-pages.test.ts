import { describe, expect, test } from 'bun:test';
import { SITE_PAGES, collectExtraRoutes } from './site-pages';

const weekly = { changefreq: 'weekly' as const, priority: '0.6' };

describe('SITE_PAGES', () => {
  test('lists every section index once', () => {
    const paths = SITE_PAGES.map((page) => page.path);
    for (const path of ['/', '/compare', '/models', '/benchmarks', '/labs', '/matchups', '/changes', '/play']) {
      expect(paths).toContain(path);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('collectExtraRoutes', () => {
  test('keeps each route once and stamps its own date when it has a valid one', () => {
    const rows = collectExtraRoutes(
      [
        { loader: weekly, routes: [{ path: '/labs/openai', lastmod: '2026-11-01' }, { path: '/labs/openai' }] },
        { loader: { changefreq: 'monthly', priority: '0.4' }, routes: [{ path: '/benchmarks/gpqa', lastmod: 'yesterday' }] },
      ],
      '2026-11-18',
    );
    expect(rows).toEqual([
      { path: '/labs/openai', lastmod: '2026-11-01', changefreq: 'weekly', priority: '0.6' },
      { path: '/benchmarks/gpqa', lastmod: '2026-11-18', changefreq: 'monthly', priority: '0.4' },
    ]);
  });

  test('drops paths already in the sitemap and anything that is not a site path', () => {
    const rows = collectExtraRoutes(
      [{ loader: weekly, routes: [{ path: '/labs' }, { path: 'labs/x' }, { path: '//evil.example/x' }, { path: '/labs/x' }] }],
      '2026-11-18',
      new Set(['/labs']),
    );
    expect(rows.map((row) => row.path)).toEqual(['/labs/x']);
  });
});
