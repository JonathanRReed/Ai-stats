import type { APIRoute } from 'astro';
import { getPublicPoliBenchSnapshot } from '../../lib/polibench-snapshot';
import { buildPoliBenchLabPayload } from '../../lib/polibench-lab-payload';

export const prerender = true;

export const GET: APIRoute = async () => {
  const payload = buildPoliBenchLabPayload(await getPublicPoliBenchSnapshot());
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
};
