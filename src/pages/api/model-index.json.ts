import type { APIRoute } from 'astro';
import { getModelPageRecords } from '../../lib/model-pages-data';

export const prerender = true;

/**
 * A slim index for the command palette: just enough to search 677 models and
 * jump to a page. The full receipt lives at /api/model-pages/<slug>.json.
 */
export const GET: APIRoute = async () => {
  const records = await getModelPageRecords();
  const body = records.map((record) => ({
    n: record.name,
    p: record.provider,
    u: record.path,
    i: record.indexes.find((metric) => metric.key === 'aa_intelligence_index')?.value ?? null,
  }));
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
};
