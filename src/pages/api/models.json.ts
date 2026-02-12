import type { APIRoute } from 'astro';
import { getModels } from '../../lib/supabase';

export const GET: APIRoute = async ({ url }) => {
  const searchParams = url.searchParams;
  const search = searchParams.get('search');
  const benchmark = searchParams.get('benchmark');

  try {
    const models = await getModels();

    let filteredModels = models;
    if (search) {
      const q = search.toLowerCase();
      filteredModels = filteredModels.filter((model) =>
        ((model.name ?? '').toLowerCase()).includes(q),
      );
    }

    if (benchmark) {
      filteredModels = filteredModels.filter((model) => {
        const score = model[benchmark as keyof typeof model];
        return score !== null && score !== undefined;
      });
    }

    return new Response(JSON.stringify(filteredModels), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch models' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
