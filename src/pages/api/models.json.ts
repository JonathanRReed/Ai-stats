import type { APIRoute } from 'astro';
import { getModels } from '../../lib/supabase';
import type { AaModel } from '../../lib/supabase';

// Simple in-memory cache to avoid spamming the DB. Resets on server restart.
let MODELS_CACHE: { data: AaModel[]; timestamp: number } | null = null;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export const GET: APIRoute = async ({ url }) => {
  const searchParams = url.searchParams;
  const search = searchParams.get('search');
  const benchmark = searchParams.get('benchmark');

  try {
    // Refresh cache if empty or stale
    const isStale = !MODELS_CACHE || (Date.now() - MODELS_CACHE.timestamp) > SIX_HOURS_MS;
    if (isStale) {
      const fresh = await getModels();
      MODELS_CACHE = { data: fresh, timestamp: Date.now() };
    }

    const models = MODELS_CACHE!.data;

    let filteredModels = models;
    if (search) {
      const q = search.toLowerCase();
      filteredModels = filteredModels.filter((model) =>
        ((model.name ?? '').toLowerCase()).includes(q)
      );
    }
    if (benchmark) {
      filteredModels = filteredModels.filter(model => {
        const score = model[benchmark as keyof typeof model];
        return score !== null && score !== undefined;
      });
    }

    return new Response(JSON.stringify(filteredModels), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Allow downstream caches to serve for 5 minutes and revalidate in background up to 6 hours
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=21600'
      }
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch models' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
