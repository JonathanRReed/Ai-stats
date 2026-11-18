import { supabase } from './supabase';

/**
 * AI Stats shows a model as current only if it is in the published Artificial Analysis membership
 * list. The measurements table keeps updating on its own schedule, so when publication falls
 * behind, newly released models are measured but not yet shown. Pages that rank or call something
 * the leader must say so rather than imply the list is complete.
 */
export type CohortFreshness = {
  /** When the membership list was fetched from the source. */
  listedAt: string | null;
  /** The newest measurement of any Artificial Analysis record. */
  measuredAt: string | null;
  /** Whole days the membership list trails the newest measurement. */
  lagDays: number | null;
  stale: boolean;
};

/** A list more than this many days behind the measurements may be missing new releases. */
export const COHORT_LAG_LIMIT_DAYS = 3;

const time = (value: string | null | undefined): number | null => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

/** Compares two recorded dates. The build clock is never consulted, so the result is reproducible. */
export function describeCohortFreshness(listedAt: string | null | undefined, measuredAt: string | null | undefined): CohortFreshness {
  const listed = time(listedAt), measured = time(measuredAt);
  const lagDays = listed === null || measured === null ? null : Math.max(0, Math.floor((measured - listed) / 86_400_000));
  return { listedAt: listed === null ? null : new Date(listed).toISOString(), measuredAt: measured === null ? null : new Date(measured).toISOString(), lagDays, stale: lagDays !== null && lagDays > COHORT_LAG_LIMIT_DAYS };
}

let cached: Promise<CohortFreshness> | undefined;
async function load(): Promise<CohortFreshness> {
  if (!supabase) return describeCohortFreshness(null, null);
  try {
    const [list, newest] = await Promise.all([
      supabase.from('source_snapshot_cache').select('fetched_at').eq('source_key', 'artificial-analysis').maybeSingle(),
      supabase.from('aa_models').select('last_seen').order('last_seen', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    ]);
    return describeCohortFreshness(list.data?.fetched_at ?? null, newest.data?.last_seen ?? null);
  } catch {
    // Unknown is not stale: without both dates the page makes no claim either way.
    return describeCohortFreshness(null, null);
  }
}
/** Resolved once per build. */
export const getCohortFreshness = (): Promise<CohortFreshness> => (cached ??= load());
