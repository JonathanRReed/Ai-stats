import type { APIRoute } from 'astro';
import { getDataFreshness, type SourceFreshness } from '../../lib/data-freshness';
import { DEFAULT_TASK_PRESETS } from '../../lib/model-intelligence';
import type {
  IntelligenceRefreshPayload,
  IntelligenceRefreshSource,
} from '../../lib/live-data';

export const prerender = true;

const OVERVIEW: IntelligenceRefreshPayload['overview'] = {
  qualityVsPrice: {
    qualityMetricKey: 'aa_intelligence_index',
    priceMetricKey: 'price_1m_blended_3_to_1',
    qualityLabel: 'Artificial Analysis Intelligence Index',
    priceLabel: 'Blended price, USD per 1M tokens',
  },
  coverageMetrics: [
    {
      key: 'aa_intelligence_index',
      label: 'Intelligence Index',
      sourceKey: 'artificial-analysis',
      unit: 'index',
    },
    {
      key: 'livecodebench',
      label: 'LiveCodeBench',
      sourceKey: 'artificial-analysis',
      unit: 'score',
    },
    {
      key: 'simplebench_external',
      label: 'SimpleBench',
      sourceKey: 'simplebench',
      unit: 'source-native score',
    },
    {
      key: 'polibench_robustness',
      label: 'PoliBench robustness',
      sourceKey: 'polibench',
      unit: 'source-native score',
    },
  ],
};

const serializeSource = (source: SourceFreshness): IntelligenceRefreshSource => ({
  sourceKey: source.sourceKey,
  displayName: source.displayName,
  status: source.status,
  lastObservedAt: source.lastObservedAt?.toISOString() ?? null,
  lastSuccessfulRunAt: source.lastSuccessfulRunAt?.toISOString() ?? null,
  coverageLabel: source.coverageLabel,
  ageDays: source.ageDays,
  message: source.message,
});

export const GET: APIRoute = async () => {
  const freshness = await getDataFreshness({ forceRefresh: true });
  const payload: IntelligenceRefreshPayload = {
    schemaVersion: '1.0',
    delivery: {
      mode: 'build-snapshot',
      generatedAt: new Date().toISOString(),
      refreshRequiresBuild: true,
    },
    freshness: {
      updatedAt: freshness.updatedAt?.toISOString() ?? null,
      aaLastSeen: freshness.aaLastSeen?.toISOString() ?? null,
      epochFetchedAt: freshness.epochFetchedAt?.toISOString() ?? null,
      sources: freshness.sources.map(serializeSource),
      fallback: freshness.fallback,
    },
    taskPresets: DEFAULT_TASK_PRESETS,
    overview: OVERVIEW,
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
