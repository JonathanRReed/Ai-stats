import type { APIRoute } from 'astro';
import {getModelCatalogData} from '../../lib/model-catalog-data';
import {catalogIndex} from '../../lib/model-catalog';
import { getModelPageRecords } from '../../lib/model-pages-data';

export const prerender = true;

/**
 * A slim index for the command palette: exact source records and measured pages and
 * jump to a page. The full receipt lives at /api/model-pages/<slug>.json.
 */
export const GET: APIRoute = async () => {
  const [pages,{records}]=await Promise.all([getModelPageRecords(),getModelCatalogData()]);
  const body=catalogIndex(records,pages);
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
};
