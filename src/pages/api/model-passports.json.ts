import type { APIRoute } from 'astro';
import { buildModelPassportSnapshot } from '../../lib/model-passport';
import {
  getCanonicalModels,
  getIntelligenceSources,
  getModelAliases,
} from '../../lib/supabase';

export const prerender = true;

export const GET: APIRoute = async () => {
  const [canonicalModels, aliases, sources] = await Promise.all([
    getCanonicalModels(),
    getModelAliases(),
    getIntelligenceSources(),
  ]);
  const payload = buildModelPassportSnapshot({ canonicalModels, aliases, sources });

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
