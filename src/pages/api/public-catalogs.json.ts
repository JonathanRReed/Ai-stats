import type { APIRoute } from 'astro';
import { getPublicCatalogModels } from '../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    const {
      openRouterModels,
      huggingFaceModels,
      liteLlmModels,
      openRouterUsageRankings,
      openRouterEndpointSummaries,
    } = await getPublicCatalogModels();

    return new Response(
      JSON.stringify({
        openRouterModels: openRouterModels.map((model) => ({
          openrouter_id: model.openrouter_id,
          canonical_slug: model.canonical_slug,
          author_slug: model.author_slug,
          model_slug: model.model_slug,
          name: model.name,
          context_length: model.context_length,
          prompt_price_1m: model.prompt_price_1m,
          completion_price_1m: model.completion_price_1m,
          supported_parameters: model.supported_parameters,
          input_modalities: model.input_modalities,
          output_modalities: model.output_modalities,
          is_free: model.is_free,
        })),
        huggingFaceModels: huggingFaceModels.map((model) => ({
          model_id: model.model_id,
          author: model.author,
          downloads: model.downloads,
          likes: model.likes,
          pipeline_tag: model.pipeline_tag,
          library_name: model.library_name,
          last_modified: model.last_modified,
          tags: model.tags,
        })),
        liteLlmModels: liteLlmModels.map((model) => ({
          model_id: model.model_id,
          provider: model.provider,
          mode: model.mode,
          max_input_tokens: model.max_input_tokens,
          max_output_tokens: model.max_output_tokens,
          input_price_1m: model.input_price_1m,
          output_price_1m: model.output_price_1m,
          supports_vision: model.supports_vision,
          supports_function_calling: model.supports_function_calling,
          supports_reasoning: model.supports_reasoning,
          supports_prompt_caching: model.supports_prompt_caching,
          supports_system_messages: model.supports_system_messages,
          supports_web_search: model.supports_web_search,
        })),
        openRouterUsageRankings: openRouterUsageRankings.map((ranking) => ({
          model_permaslug: ranking.model_permaslug,
          variant_permaslug: ranking.variant_permaslug,
          provider: ranking.provider,
          variant: ranking.variant,
          rank: ranking.rank,
          total_tokens: ranking.total_tokens,
          request_count: ranking.request_count,
          tool_calls: ranking.tool_calls,
          tool_call_errors: ranking.tool_call_errors,
          usage_share: ranking.usage_share,
          change: ranking.change,
          date: ranking.date,
        })),
        openRouterEndpointSummaries: openRouterEndpointSummaries.map((summary) => ({
          openrouter_id: summary.openrouter_id,
          provider_count: summary.provider_count,
          providers: summary.providers,
          quantizations: summary.quantizations,
          max_context_length: summary.max_context_length,
          min_prompt_price_1m: summary.min_prompt_price_1m,
          min_completion_price_1m: summary.min_completion_price_1m,
        })),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      },
    );
  } catch (error) {
    console.error('Error fetching public catalog data:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch public catalog data' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
