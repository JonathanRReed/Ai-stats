import {getPublisherEvidence,PUBLISHER_NAMES,type PublisherSnapshot} from './publisher-evidence';
import {getOpenRouterUsageSnapshot} from './openrouter-usage-server';
import {catalogReceiptUpdate,PUBLIC_CATALOG_NAMES} from './catalog-cache';
import { getActiveRefreshPolicy } from '../../scripts/source-refresh-policy.mjs';
import { getPublicPoliBenchSnapshot } from './polibench-snapshot';
import { supabase } from './supabase';
import { getEpochEvidence } from './epoch-evidence';

export type SourceFreshnessStatus =
  | 'healthy'
  | 'stale'
  | 'partial'
  | 'failed'
  | 'unavailable';

export type SourceFreshnessInput = {
  sourceKey: string;
  displayName: string;
  status?: string | null;
  statusMessage?: string | null;
  coverageLabel?: string | null;
  lastObservedAt?: string | Date | null;
  /** Retrieval date is separate from a historical evaluation date. */
  fetchedAt?: string | Date | null;
  publishedAt?: string | Date | null;
  snapshotId?: string | null;
  contentHash?: string | null;
  lastSuccessfulRunAt?: string | Date | null;
  isEnabled?: boolean | null;
};

export type SourceFreshness = {
  fetchedAt?: Date | null;
  publishedAt?: Date | null;
  snapshotId?: string | null;
  contentHash?: string | null;
  sourceKey: string;
  displayName: string;
  status: SourceFreshnessStatus;
  lastObservedAt: Date | null;
  lastSuccessfulRunAt: Date | null;
  coverageLabel: string | null;
  ageDays: number | null;
  message: string;
};

export type FreshnessFallback = {
  mode: 'live-view' | 'static-snapshot';
  fallback: boolean;
  reason: string | null;
};

export type DataFreshness = {
  /** Most recent refresh across every source baked into the build. */
  updatedAt: Date | null;
  /** Newest `last_seen` in the Artificial Analysis feed. */
  aaLastSeen: Date | null;
  /** Fetch timestamp of the Epoch dataset selected for this build. */
  epochFetchedAt: Date | null;
  /** Source-specific freshness used by the workbench and live browser refresh. */
  sources: SourceFreshness[];
  /** Whether database ingestion receipts were available alongside selected data. */
  fallback: FreshnessFallback;
};

const toDateOrNull = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const asNonEmptyStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const readEpochSnapshotMetadata = async (): Promise<{
  fetchedAt: Date | null;
  modelCount: number;
  runCount: number;
  simpleBenchRunCount: number;
}> => {
  try {
    const snapshot = await getEpochEvidence();
    const runs = snapshot.epochRuns;
    return {
      fetchedAt: toDateOrNull(snapshot.fetchedAt),
      modelCount: snapshot.epochModels.length,
      runCount: runs.length,
      simpleBenchRunCount: runs.filter((run) =>
        String(run.benchmark_slug ?? '').toLowerCase().includes('simplebench'),
      ).length,
    };
  } catch {
    return { fetchedAt: null, modelCount: 0, runCount: 0, simpleBenchRunCount: 0 };
  }
};

const readAaLastSeen = async (): Promise<Date | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('aa_models')
      .select('last_seen')
      .order('last_seen', { ascending: false, nullsFirst: false })
      .limit(1);
    if (error) return null;
    return toDateOrNull((data?.[0] as { last_seen?: string } | undefined)?.last_seen);
  } catch {
    return null;
  }
};

const sourceAgeDays = (value: Date | null, now: Date): number | null => {
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / 86_400_000));
};

const sourceMessage = (
  status: SourceFreshnessStatus,
  inputMessage: string | null,
  staleAfterHours: number,
): string => {
  if (inputMessage) return inputMessage;
  switch (status) {
    case 'healthy':
      return 'Current source snapshot is available.';
    case 'stale':
      return `Last successful source snapshot is older than ${staleAfterHours} hours.`;
    case 'partial':
      return 'The latest source ingestion completed with partial coverage.';
    case 'failed':
      return 'The latest source ingestion failed. The last successful snapshot is retained.';
    case 'unavailable':
      return 'No source snapshot is available yet.';
  }
};

/**
 * Turns source receipts and checked-in snapshot metadata into a UI-safe status.
 * The source-specific receipt wins over age, while missing or disabled sources stay explicit.
 */
export const resolveSourceFreshness = (
  input: SourceFreshnessInput,
  now = new Date(),
): SourceFreshness => {
  const lastObservedAt = toDateOrNull(input.lastObservedAt);
  const lastSuccessfulRunAt = toDateOrNull(input.lastSuccessfulRunAt);
  // A failed or partial observation can be newer than the last usable snapshot.
  // Age intentionally answers "how old is the evidence a visitor can rely on?"
  // Re-importing an old snapshot succeeds today but does not make its evidence newer.
  const explicitFetch = toDateOrNull(input.fetchedAt);
  const referenceDate = explicitFetch ?? (lastSuccessfulRunAt && lastObservedAt
    ? new Date(Math.min(lastSuccessfulRunAt.getTime(), lastObservedAt.getTime()))
    : lastSuccessfulRunAt ?? lastObservedAt);
  const ageDays = sourceAgeDays(referenceDate, now);
  const ageHours = referenceDate ? Math.max(0, (now.getTime() - referenceDate.getTime()) / 3600000) : null;
  const { staleAfterHours } = getActiveRefreshPolicy(input.sourceKey);
  const sourceStatus = asNonEmptyStringOrNull(input.status)?.toLowerCase();
  const statusMessage = asNonEmptyStringOrNull(input.statusMessage);

  let status: SourceFreshnessStatus;
  if (input.isEnabled === false || sourceStatus === 'unavailable') {
    status = 'unavailable';
  } else if (sourceStatus === 'failed') {
    status = 'failed';
  } else if (sourceStatus === 'partial') {
    status = 'partial';
  } else if (!referenceDate) {
    status = 'unavailable';
  } else if ((ageHours ?? 0) > staleAfterHours) {
    status = 'stale';
  } else {
    status = 'healthy';
  }

  return {
    fetchedAt: explicitFetch,
    publishedAt: toDateOrNull(input.publishedAt),
    snapshotId: input.snapshotId ?? null,
    contentHash: input.contentHash ?? null,
    sourceKey: input.sourceKey,
    displayName: input.displayName,
    status,
    lastObservedAt,
    lastSuccessfulRunAt,
    coverageLabel: asNonEmptyStringOrNull(input.coverageLabel),
    ageDays,
    message: input.isEnabled === false
      ? 'This source is not enabled.'
      : sourceMessage(status, statusMessage, staleAfterHours),
  };
};

const readStaticSources = async (
  aaLastSeen: Date | null,
  epoch: Awaited<ReturnType<typeof readEpochSnapshotMetadata>>,
): Promise<SourceFreshness[]> => {
  const [polibench,publishers] = await Promise.all([getPublicPoliBenchSnapshot(),getPublisherEvidence().catch(()=>null)]);
  return [
    ...Object.keys(PUBLISHER_NAMES).map(key=>publisherSourceFreshness(publishers?.snapshots.find(snapshot=>snapshot.sourceKey===key)??null,key)),
    resolveSourceFreshness({
      sourceKey: 'artificial-analysis',
      displayName: 'Artificial Analysis',
      lastObservedAt: aaLastSeen,
      lastSuccessfulRunAt: aaLastSeen,
      coverageLabel: aaLastSeen ? 'Live model catalog' : null,
    }),
    resolveSourceFreshness({
      sourceKey: 'epoch-ai',
      displayName: 'Epoch AI',
      lastObservedAt: null,
      fetchedAt: epoch.runCount ? epoch.fetchedAt : null,
      lastSuccessfulRunAt: epoch.runCount ? epoch.fetchedAt : null,
      coverageLabel: epoch.runCount
        ? `${epoch.modelCount} models / ${epoch.runCount} observations`
        : null,
    }),
    resolveSourceFreshness({
      sourceKey: 'simplebench',
      displayName: 'SimpleBench',
      lastObservedAt: null,
      fetchedAt: epoch.simpleBenchRunCount ? epoch.fetchedAt : null,
      lastSuccessfulRunAt: epoch.simpleBenchRunCount ? epoch.fetchedAt : null,
      coverageLabel: epoch.simpleBenchRunCount
        ? `${epoch.simpleBenchRunCount} SimpleBench results from the Epoch AI snapshot`
        : null,
    }),
    resolveSourceFreshness({
      sourceKey: 'polibench',
      displayName: 'PoliBench',
      lastObservedAt: polibench?.freshness.generatedAt ?? null,
      lastSuccessfulRunAt: polibench?.freshness.generatedAt ?? null,
      coverageLabel: polibench
        ? `${polibench.counts.models} models / ${polibench.counts.runs} runs`
        : null,
    }),
  ];
};

export function usageSourceFreshness(value:Awaited<ReturnType<typeof getOpenRouterUsageSnapshot>>,now=new Date()):SourceFreshness{
 if(!value)return resolveSourceFreshness({sourceKey:'openrouter-usage',displayName:'OpenRouter daily usage',status:'unavailable',
  statusMessage:'No validated daily usage snapshot is available yet.'},now);
 const {snapshot,receipt}=value;
 return resolveSourceFreshness({sourceKey:'openrouter-usage',displayName:'OpenRouter daily usage',status:receipt.status,
  lastObservedAt:snapshot.asOf,lastSuccessfulRunAt:receipt.fetchedAt,fetchedAt:receipt.fetchedAt,publishedAt:receipt.publishedAt,
  snapshotId:receipt.snapshotId,contentHash:receipt.contentHash,
  coverageLabel:new Set(snapshot.rows.map(row=>row.date)).size+' days / '+snapshot.rows.length+' model-day buckets'},now);
}

type SourceFreshnessViewRow = {
  source_key?: unknown;
  display_name?: unknown;
  status?: unknown;
  status_message?: unknown;
  coverage_label?: unknown;
  last_observed_at?: unknown;
  last_successful_run_at?: unknown;
  is_enabled?: unknown;
};

const readLiveSourceFreshness = async (): Promise<SourceFreshness[] | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('source_freshness_v1')
      .select('source_key,display_name,status,status_message,coverage_label,last_observed_at,last_successful_run_at,is_enabled')
      .order('display_name', { ascending: true });
    if (error || !data?.length) return null;
    const rows = data as SourceFreshnessViewRow[];
    const usage=await getOpenRouterUsageSnapshot();
    const catalogResult=await supabase.from('source_snapshot_cache')
      .select('source_key,snapshot_id,content_hash,observed_at,fetched_at,published_at,record_count,refresh_status,refresh_message');
    const catalogRows=catalogResult.error?[]:(catalogResult.data??[]) as Record<string,unknown>[];
    return rows
      .map((row) => {
        const sourceKey = asNonEmptyStringOrNull(row.source_key);
        const displayName = asNonEmptyStringOrNull(row.display_name);
        if (!sourceKey || !displayName) return null;
        if(sourceKey==='openrouter-usage')return usageSourceFreshness(usage);
        const catalogRow=Object.hasOwn(PUBLIC_CATALOG_NAMES,sourceKey)?catalogRows.find(item=>item.source_key===sourceKey):null;
        const receipt=catalogRow?catalogReceiptUpdate(String(catalogRow.content_hash??''),catalogRow):null;
        if(receipt)return resolveSourceFreshness({
          sourceKey,displayName,status:receipt.status,statusMessage:receipt.message,
          lastObservedAt:receipt.observedAt,fetchedAt:receipt.fetchedAt,publishedAt:receipt.publishedAt,
          lastSuccessfulRunAt:receipt.fetchedAt,snapshotId:receipt.snapshotId,contentHash:receipt.contentHash,
          coverageLabel:String(catalogRow!.record_count)+' cached catalog models',isEnabled:typeof row.is_enabled==='boolean'?row.is_enabled:null,
        });
        return resolveSourceFreshness({
          sourceKey,
          displayName,
          status: asNonEmptyStringOrNull(row.status),
          statusMessage: asNonEmptyStringOrNull(row.status_message),
          coverageLabel: asNonEmptyStringOrNull(row.coverage_label),
          lastObservedAt: toDateOrNull(row.last_observed_at),
          lastSuccessfulRunAt: toDateOrNull(row.last_successful_run_at),
          isEnabled: typeof row.is_enabled === 'boolean' ? row.is_enabled : null,
        });
      })
      .filter((source): source is SourceFreshness => source !== null);
  } catch {
    return null;
  }
};

export const mergeSourceFreshness = (
  staticSources: SourceFreshness[],
  liveSources: SourceFreshness[] | null,
  selectedDatasetKeys: string[] = [],
): SourceFreshness[] => {
  if (!liveSources?.length) return staticSources;
  const bySourceKey = new Map(staticSources.map((source) => [source.sourceKey, source]));
  liveSources.forEach((source) => {
    const published = bySourceKey.get(source.sourceKey);
    if (published && selectedDatasetKeys.includes(source.sourceKey)) {
      bySourceKey.set(source.sourceKey, {
        ...published,
        status: published.status === 'unavailable' ? 'unavailable' : ['failed', 'partial'].includes(source.status) ? source.status : published.status,
        message: ['failed', 'partial'].includes(source.status)
          ? `Showing the selected published evidence. Database refresh: ${source.message}` : published.message,
      });
      return;
    }
    if (published?.lastObservedAt && published.lastObservedAt.getTime() > (source.lastObservedAt?.getTime() ?? 0)) {
      bySourceKey.set(source.sourceKey, {
        ...published,
        status: ['failed', 'partial', 'unavailable'].includes(source.status) ? source.status : published.status,
        message: `Showing the newer published snapshot. Database refresh: ${source.message}`,
      });
    } else {
      bySourceKey.set(source.sourceKey, source);
    }
  });
  return Array.from(bySourceKey.values());
};

/**
 * Retains the legacy meaning of `updatedAt`: the newest observed source
 * evidence, rather than the timestamp of an ingestion receipt.
 */
export const getFreshnessUpdatedAt = (
  sources: SourceFreshness[],
): Date | null => {
  const observations = sources
    .map((source) => source.lastObservedAt)
    .filter((value): value is Date => value !== null);
  return observations.length
    ? new Date(Math.max(...observations.map((value) => value.getTime())))
    : null;
};

let cached: Promise<DataFreshness> | null = null;

type DataFreshnessOptions = {
  /** Re-read source receipts while generating a fresh static build snapshot. */
  forceRefresh?: boolean;
};

const resolveDataFreshness = async (): Promise<DataFreshness> => {
  const [aaLastSeen, epoch, liveSources] = await Promise.all([
    readAaLastSeen(),
    readEpochSnapshotMetadata(),
    readLiveSourceFreshness(),
  ]);
  const staticSources = await readStaticSources(aaLastSeen, epoch);
  const sources = mergeSourceFreshness(staticSources, liveSources, ['epoch-ai', 'simplebench', 'polibench']);
  const updatedAt = getFreshnessUpdatedAt(sources);
  return {
    updatedAt,
    aaLastSeen,
    epochFetchedAt: epoch.fetchedAt,
    sources,
    fallback: liveSources?.length
      ? { mode: 'live-view', fallback: false, reason: null }
      : {
          mode: 'static-snapshot',
          fallback: true,
          reason: supabase
            ? 'The source freshness view was unavailable, so checked-in snapshots are shown.'
            : 'Supabase is not configured, so checked-in snapshots are shown.',
        },
  };
};

/**
 * Resolved once per build so the freshness stamp is identical on every page.
 * Never throws: a missing source degrades to `null` instead of failing the build.
 */
export const getDataFreshness = (options: DataFreshnessOptions = {}): Promise<DataFreshness> => {
  if (options.forceRefresh) return resolveDataFreshness();
  cached ??= resolveDataFreshness();
  return cached;
};

export const toIsoDate = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

const dataDateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export const formatDataDate = (value: Date | null): string | null =>
  value ? dataDateFormatter.format(value) : null;

export function publisherSourceFreshness(snapshot:PublisherSnapshot|null,sourceKey:string,now=new Date()):SourceFreshness{
 return resolveSourceFreshness({sourceKey,displayName:PUBLISHER_NAMES[sourceKey]??sourceKey,
  ...(snapshot?{fetchedAt:snapshot.fetchedAt,lastSuccessfulRunAt:snapshot.fetchedAt,lastObservedAt:snapshot.observedAt,
    status:snapshot.refreshStatus==='failed'?'partial':undefined,
    statusMessage:snapshot.refreshStatus==='failed'?'Refresh failed; showing the last checked snapshot.':snapshot.refreshMode==='manual'?'Manually checked publisher snapshot.':undefined,
    coverageLabel:snapshot.records.length+' source records'}:{status:'unavailable',statusMessage:'No validated publisher snapshot.'})},now);
}
