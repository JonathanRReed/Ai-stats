import type { APIRoute, GetStaticPaths } from 'astro';
import { getModelPageRecords } from '../../../lib/model-pages-data';

export const prerender = true;

/**
 * One JSON document per model page, built from the same record the HTML
 * renders. The model page's Dataset JSON-LD points here as its distribution.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const records = await getModelPageRecords();
  return records.map((record) => ({ params: { slug: record.slug }, props: { record } }));
};

export const GET: APIRoute = async ({ props }) => {
  const body = JSON.stringify({
    ...props.record,
    generatedAt: new Date().toISOString(),
    usage: 'Values belong to their named sources. Search and AI grounding with a link back are allowed, training is not. See /robots.txt.',
  });
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
};
