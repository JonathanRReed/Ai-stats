import type { APIRoute } from 'astro';
import { getModelPageRecords } from '../lib/model-pages-data';
import { getDataFreshness, toIsoDate } from '../lib/data-freshness';
import { modelRecordToText, SITE_ORIGIN } from '../lib/model-pages';

export const prerender = true;

/**
 * The long-form companion to /llms.txt: every model with its measured values,
 * generated from the same records the model pages render so an assistant that
 * reads this file quotes the same numbers a visitor sees.
 */
export const GET: APIRoute = async () => {
  const [records, freshness] = await Promise.all([getModelPageRecords(), getDataFreshness()]);
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

  return new Response(`${head.join('\n')}${body}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
};
