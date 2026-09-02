import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getPublicPoliBenchSnapshot } from './polibench-snapshot';
import { supabase } from './supabase';

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
  lastSuccessfulRunAt?: string | Date | null;
  isEnabled?: boolean | null;
};

export type SourceFreshness = {
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
  /** `fetched_at` recorded in public/data/epoch-benchmark-snapshot.json. */
  epochFetchedAt: Date | null;
  /** Source-specific freshness used by the workbench and live browser refresh. */
  sources: SourceFreshness[];
  /** Whether source status came from the read-only intelligence view or local snapshots. */
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
    const filePath = path.join(
      process.cwd(),
      'public/data/epoch-benchmark-snapshot.json',
    );
    const snapshot = JSON.parse(await readFile(filePath, 'utf8')) as {
      fetched_at?: string;
      models?: unknown[];
      runs?: Array<{ benchmark_slug?: unknown }>;
    };
    const runs = Array.isArray(snapshot.runs) ? snapshot.runs : [];
    return {
      fetchedAt: toDateOrNull(snapshot.fetched_at),
      modelCount: Array.isArray(snapshot.models) ? snapshot.models.length : 0,
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
): string => {
  if (inputMessage) return inputMessage;
  switch (status) {
    case 'healthy':
      return 'Current source snapshot is available.';
    case 'stale':
      return 'Last successful source snapshot is older than 14 days.';
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
  const referenceDate = lastSuccessfulRunAt ?? lastObservedAt;
  const ageDays = sourceAgeDays(referenceDate, now);
  const sourceStatus = asNonEmptyStringOrNull(input.status)?.toLowerCase();
  const statusMessage = asNonEmptyStringOrNull(input.statusMessage);

  let status: SourceFreshnessStatus;
  if (input.isEnabled === false) {
    status = 'unavailable';
  } else if (sourceStatus === 'failed') {
    status = 'failed';
  } else if (sourceStatus === 'partial') {
    status = 'partial';
  } else if (!referenceDate) {
    status = 'unavailable';
  } else if ((ageDays ?? 0) > 14) {
    status = 'stale';
  } else {
    status = 'healthy';
  }

  return {
    sourceKey: input.sourceKey,
    displayName: input.displayName,
    status,
    lastObservedAt,
    lastSuccessfulRunAt,
    coverageLabel: asNonEmptyStringOrNull(input.coverageLabel),
    ageDays,
    message: input.isEnabled === false
      ? 'This source is not enabled.'
      : sourceMessage(status, statusMessage),
  };
};

const readStaticSources = async (
  aaLastSeen: Date | null,
  epoch: Awaited<ReturnType<typeof readEpochSnapshotMetadata>>,
): Promise<SourceFreshness[]> => {
  const polibench = await getPublicPoliBenchSnapshot();
  return [
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
      lastObservedAt: epoch.fetchedAt,
      lastSuccessfulRunAt: epoch.fetchedAt,
      coverageLabel: epoch.runCount
        ? `${epoch.modelCount} models / ${epoch.runCount} observations`
        : null,
    }),
    resolveSourceFreshness({
      sourceKey: 'simplebench',
      displayName: 'SimpleBench',
      lastObservedAt: epoch.fetchedAt,
      lastSuccessfulRunAt: epoch.fetchedAt,
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
    return rows
      .map((row) => {
        const sourceKey = asNonEmptyStringOrNull(row.source_key);
        const displayName = asNonEmptyStringOrNull(row.display_name);
        if (!sourceKey || !displayName) return null;
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
): SourceFreshness[] => {
  if (!liveSources?.length) return staticSources;
  const bySourceKey = new Map(staticSources.map((source) => [source.sourceKey, source]));
  liveSources.forEach((source) => {
    const published = bySourceKey.get(source.sourceKey);
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
  const sources = mergeSourceFreshness(staticSources, liveSources);
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
