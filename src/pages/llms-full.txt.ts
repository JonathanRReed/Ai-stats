import type { APIRoute } from 'astro';
import { getModelPageRecords } from '../lib/model-pages-data';
import { getDataFreshness, toIsoDate } from '../lib/data-freshness';
import { modelRecordToText, SITE_ORIGIN } from '../lib/model-pages';
import { SECTION_NAV } from '../lib/site-nav';
import { getLabPages } from '../lib/lab-pages-data';
import { getBenchmarkPages } from '../lib/benchmark-pages-data';
import { getMatchups } from '../lib/head-to-head-data';

export const prerender = true;

/*
 * ---------------------------------------------------------------------------
 * EXTRA PAGE LISTS: data-driven detail pages listed after the models, one section each.
 * Each loader returns `{ path, title }[]`. Import a loader module only once it exists: a
 * static import of a missing file fails the build. Example entry:
 *
 *   { heading: 'Benchmark pages', load: async () => (await getBenchmarkPages()).map((p) => ({ path: p.path, title: p.name })) },
 * ---------------------------------------------------------------------------
 */
const EXTRA_PAGE_LISTS: { heading: string; load: () => Promise<{ path: string; title: string }[]> }[] = [
  { heading: 'Benchmark pages', load: async () => (await getBenchmarkPages()).map((page) => ({ path: page.path, title: page.name })) },
  { heading: 'Lab pages', load: async () => (await getLabPages()).map((page) => ({ path: page.path, title: page.provider })) },
  { heading: 'Head-to-head matchups', load: async () => (await getMatchups()).map((matchup) => ({ path: matchup.path, title: `${matchup.a.name} vs ${matchup.b.name}` })) },
];

/**
 * The long-form companion to /llms.txt: every model with its measured values,
 * generated from the same records the model pages render so an assistant that
 * reads this file quotes the same numbers a visitor sees.
 */
export const GET: APIRoute = async () => {
  const [records, freshness, extraLists] = await Promise.all([
    getModelPageRecords(),
    getDataFreshness(),
    Promise.all(EXTRA_PAGE_LISTS.map(async (list) => ({ heading: list.heading, pages: await list.load() }))),
  ]);
  const updated = toIsoDate(freshness.updatedAt) ?? 'unknown';
  const byProvider = new Map<string, typeof records>();
  for (const record of records) {
    const group = byProvider.get(record.provider) ?? [];
    group.push(record);
    byProvider.set(record.provider, group);
  }
  const providers = [...byProvider.keys()].sort((a, b) => a.localeCompare(b));

  const head = [
    '# AI Stats, full model listing',
    '',
    `> Every model tracked by AI Stats with its price, speed, context, benchmark scores, catalog identifiers, and observation dates. Generated at build from the same data the pages render. Data refreshed ${updated}.`,
    '',
    'How to read this file:',
    '- Prices are US dollars per one million tokens as published by Artificial Analysis. OpenRouter route prices are listed separately when they differ.',
    '- Speed values are Artificial Analysis medians: output tokens per second and time to first token in seconds.',
    '- Benchmark values are the fraction of items correct, shown as percentages. Artificial Analysis indexes are points from 0 to 100.',
    '- Each model has a page and a JSON document with the same values. Cite the page URL.',
    '- No combined score, ranking, or recommendation is implied. Compare models on the measurements you care about.',
    '',
    `Site: ${SITE_ORIGIN}/`,
    `Short guide: ${SITE_ORIGIN}/llms.txt`,
    `Model index: ${SITE_ORIGIN}/models`,
    `Compare tool: ${SITE_ORIGIN}/compare`,
    `Methodology: ${SITE_ORIGIN}/about`,
    '',
    'Site sections:',
    ...SECTION_NAV.map((link) => `- ${link.label}: ${SITE_ORIGIN}${link.href}`),
    '',
    'Usage policy: search indexing allowed, AI answers with a link back allowed, AI training not allowed. Matches the content signals in /robots.txt.',
    '',
    `Models: ${records.length} across ${providers.length} providers.`,
    '',
  ];

  const body = providers
    .map((provider) => {
      const group = byProvider.get(provider) ?? [];
      return [`## ${provider} (${group.length})`, '', ...group.map((record) => `${modelRecordToText(record)}\n`)].join('\n');
    })
    .join('\n');

  const extra = extraLists
    .filter((list) => list.pages.length > 0)
    .map((list) =>
      [`## ${list.heading} (${list.pages.length})`, '', ...list.pages.map((page) => `- ${page.title}: ${SITE_ORIGIN}${page.path}`)].join('\n'),
    )
    .join('\n\n');

  return new Response(`${head.join('\n')}${body}${extra ? `\n\n${extra}\n` : ''}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
};
