import { describe, expect, test } from 'bun:test';
import { buildModelPassportSnapshot, MODEL_PASSPORT_SCHEMA } from './model-passport';

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
    expect(JSON.stringify(snapshot)).not.toContain('recommendation');
  });
});
