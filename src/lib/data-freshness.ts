import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { supabase } from './supabase';

export type DataFreshness = {
  /** Most recent refresh across every source baked into the build. */
  updatedAt: Date | null;
  /** Newest `last_seen` in the Artificial Analysis feed. */
  aaLastSeen: Date | null;
  /** `fetched_at` recorded in public/data/epoch-benchmark-snapshot.json. */
  epochFetchedAt: Date | null;
};

const toDateOrNull = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const readEpochFetchedAt = async (): Promise<Date | null> => {
  try {
    const filePath = path.join(
      process.cwd(),
      'public/data/epoch-benchmark-snapshot.json',
    );
    const snapshot = JSON.parse(await readFile(filePath, 'utf8')) as {
      fetched_at?: string;
    };
    return toDateOrNull(snapshot.fetched_at);
  } catch {
    return null;
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

let cached: Promise<DataFreshness> | null = null;

/**
 * Resolved once per build so the freshness stamp is identical on every page.
 * Never throws: a missing source degrades to `null` instead of failing the build.
 */
export const getDataFreshness = (): Promise<DataFreshness> => {
  cached ??= (async () => {
    const [aaLastSeen, epochFetchedAt] = await Promise.all([
      readAaLastSeen(),
      readEpochFetchedAt(),
    ]);
    const known = [aaLastSeen, epochFetchedAt].filter(
      (value): value is Date => value !== null,
    );
    const updatedAt = known.length
      ? new Date(Math.max(...known.map((value) => value.getTime())))
      : null;
    return { updatedAt, aaLastSeen, epochFetchedAt };
  })();
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
