import { describe, expect, test } from 'bun:test';
import { buildModelPassportSnapshot, buildPassportRoutes, MODEL_PASSPORT_SCHEMA } from './model-passport';

describe('model passport snapshot', () => {
  test('joins aliases to canonical models without creating public model-card claims', () => {
    const snapshot = buildModelPassportSnapshot({
      generatedAt: '2026-09-01T00:00:00.000Z',
      canonicalModels: [{
        id: 1,
        canonical_key: 'openai:gpt-5',
        display_name: 'GPT-5',
        provider_name: 'OpenAI',
        model_family: 'GPT',
        release_date: '2026-08-01',
        metadata: {},
        updated_at: '2026-09-01T00:00:00.000Z',
      }],
      aliases: [{
        canonical_model_id: 1,
        intelligence_source_id: 2,
        source_model_key: 'gpt-5',
        source_model_name: 'GPT-5',
        match_method: 'source_native',
        provenance: 'Artificial Analysis source model identifier',
        confidence: 1,
        updated_at: '2026-09-01T00:00:00.000Z',
      }],
      sources: [{
        id: 2,
        source_key: 'artificial-analysis',
        display_name: 'Artificial Analysis',
        homepage_url: 'https://artificialanalysis.ai',
        status: 'healthy',
        last_successful_run_at: '2026-09-01T00:00:00.000Z',
      }],
    });

    expect(snapshot.schemaVersion).toBe(MODEL_PASSPORT_SCHEMA);
    expect(snapshot.counts).toEqual({ models: 1, aliases: 1, sources: 1 });
    expect(snapshot.models[0].aliases[0].sourceKey).toBe('artificial-analysis');
    expect(snapshot.models[0].routes.aiDragRace).toContain('GPT-5');
    expect(snapshot.models[0].routes.aiDragRace).not.toContain('provider=');
    expect(snapshot.models[0].routes.aiNewsSearch).toBe('https://ai-news.helloworldfirm.com/?q=GPT-5');
    expect(snapshot.models[0].routes.promptInfo).toBeNull();
    expect(snapshot.models[0].routes.poliBench).toBeNull();
    expect(JSON.stringify(snapshot)).not.toContain('recommendation');
  });

  test('routes siblings through the OpenRouter slug when that alias is known', () => {
    const routes = buildPassportRoutes('GPT-5', [
      {
        sourceKey: 'openrouter',
        sourceName: 'OpenRouter',
        sourceModelKey: 'openai/gpt-5',
        sourceModelName: 'OpenAI: GPT-5',
        matchMethod: 'explicit_cross_source',
        confidence: 1,
        provenance: 'Exact normalized name match',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
      {
        sourceKey: 'polibench',
        sourceName: 'PoliBench',
        sourceModelKey: 'openai/gpt-5',
        sourceModelName: 'GPT-5',
        matchMethod: 'explicit_cross_source',
        confidence: 1,
        provenance: 'Exact normalized name match',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ]);

    expect(routes.aiDragRace).toBe('https://ai-dragrace.jonathanrreed.com/?model=openai%2Fgpt-5&provider=openrouter');
    expect(routes.promptInfo).toBe('https://prompt-info.helloworldfirm.com/?model=openai%2Fgpt-5');
    expect(routes.poliBench).toBe('https://polibench.jonathanrreed.com/models/openai/gpt-5/');
    expect(routes.aiStatsCompare).toBe('/compare?model=GPT-5');
  });
});
