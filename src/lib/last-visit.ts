/**
 * "Since your last visit" on the homepage. Pure logic only: the page stores a
 * single timestamp in localStorage (and the same timestamp in sessionStorage
 * so a reload in the same tab keeps showing what was new when the visit
 * began). Nothing leaves the browser and no cookie is set.
 *
 * A model counts as new when its source release date falls on a later UTC day
 * than the last visit, or when AI Stats first observed it after the last visit.
 * Release dates are day-precision, so a release on the same day as the visit
 * is not counted; first-observed timestamps are compared exactly.
 */

export const LAST_VISIT_STORAGE_KEY = 'aistats:last-visit';
export const LAST_VISIT_SESSION_KEY = 'aistats:last-visit-baseline';
/** Candidates older than this window are not shipped to the page. */
export const LAST_VISIT_WINDOW_DAYS = 120;
export const LAST_VISIT_DISPLAY_LIMIT = 6;

const DAY_MS = 86_400_000;
/** Anything before this is not a timestamp this site could have written. */
const EARLIEST_VALID_VISIT = Date.UTC(2024, 0, 1);
/** Allow a little clock skew between the visitor's clock and the stored value. */
const FUTURE_SKEW_MS = 5 * 60_000;

export type VisitCandidate = {
  id: string;
  name: string;
  family: string;
  provider: string;
  href: string;
  /** YYYY-MM-DD from the source record, or null when not recorded. */
  releaseDate: string | null;
  /** ISO timestamp when AI Stats first observed the record, or null. */
  firstSeen: string | null;
};

export type VisitUpdate = VisitCandidate & {
  reason: 'released' | 'observed';
  /** The date that qualified the record: the release day or the first-observed timestamp. */
  date: string;
};

export type VisitPayload = {
  /** Oldest event date included in `candidates` (ISO). Visits before it get an incomplete count. */
  windowStart: string;
  candidates: VisitCandidate[];
};

const isIsoDay = (value: string | null | undefined): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
};

const timestampOf = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const releaseDayStart = (value: string | null): number | null =>
  isIsoDay(value) ? Date.parse(`${value}T00:00:00Z`) : null;

const utcDayStart = (timestamp: number): number => Math.floor(timestamp / DAY_MS) * DAY_MS;

/** Reads a stored visit timestamp (milliseconds as a string). Returns null for anything malformed or implausible. */
export function parseVisitTimestamp(raw: unknown, now: number): number | null {
  if (typeof raw !== 'string' || !/^\d{10,16}$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  if (!Number.isSafeInteger(value) || value < EARLIEST_VALID_VISIT || value > now + FUTURE_SKEW_MS) return null;
  return value;
}

export type VisitStorageState = {
  /** Last visit to compare against, or null for a first visit. */
  baseline: number | null;
  /** Value to keep in sessionStorage for the rest of this tab's visit ('' means first visit). */
  session: string;
  /** Value to write to localStorage: this page view, which becomes the next visit's baseline. */
  stored: string;
};

/**
 * Decides what the page compares against and what it writes back.
 * The session value pins the baseline for the whole tab session, so the strip
 * does not vanish on reload or after following a link and coming back.
 */
export function resolveVisitStorage(storedRaw: string | null, sessionRaw: string | null, now: number): VisitStorageState {
  if (sessionRaw !== null) {
    const pinned = sessionRaw === '' ? null : parseVisitTimestamp(sessionRaw, now);
    return {baseline: pinned, session: pinned === null ? '' : sessionRaw, stored: String(now)};
  }
  const baseline = parseVisitTimestamp(storedRaw, now);
  return {baseline, session: baseline === null ? '' : String(baseline), stored: String(now)};
}

/** Why a record is new since `lastVisit`, or null when it is not. Release day wins over first observation. */
export function visitReason(candidate: VisitCandidate, lastVisit: number): Pick<VisitUpdate, 'reason' | 'date'> | null {
  const released = releaseDayStart(candidate.releaseDate);
  if (released !== null && released > utcDayStart(lastVisit)) return {reason: 'released', date: candidate.releaseDate!};
  const observed = timestampOf(candidate.firstSeen);
  if (observed !== null && observed > lastVisit) return {reason: 'observed', date: candidate.firstSeen!};
  return null;
}

const eventTime = (update: Pick<VisitUpdate, 'reason' | 'date'>): number =>
  update.reason === 'released' ? releaseDayStart(update.date) ?? 0 : timestampOf(update.date) ?? 0;

/**
 * Records new since `lastVisit`, one per provider and family (its newest
 * qualifying variant), newest first. `complete` is false when the visit is
 * older than the shipped window, so the total is a lower bound.
 */
export function updatesSinceLastVisit(payload: VisitPayload, lastVisit: number, limit = LAST_VISIT_DISPLAY_LIMIT): {items: VisitUpdate[]; total: number; complete: boolean} {
  const qualifying = payload.candidates
    .map((candidate) => {
      const reason = visitReason(candidate, lastVisit);
      return reason ? {...candidate, ...reason} : null;
    })
    .filter((update): update is VisitUpdate => update !== null)
    .sort((a, b) => eventTime(b) - eventTime(a) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  const grouped = qualifying.filter((update) => {
    const key = JSON.stringify([update.provider, update.family]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const windowStart = timestampOf(payload.windowStart);
  return {
    items: grouped.slice(0, Math.max(0, limit)),
    total: grouped.length,
    complete: windowStart !== null && lastVisit >= windowStart,
  };
}

export type VisitSourceModel = {
  id: string;
  name: string | null;
  family: string;
  provider: string;
  href: string;
  releaseDate: string | null | undefined;
  firstSeen: string | null | undefined;
};

/**
 * Server side: keeps only records with a valid release day or first-observed
 * time inside the window ending at `now`, so the inlined payload stays small.
 */
export function buildVisitPayload(models: VisitSourceModel[], now: number, windowDays = LAST_VISIT_WINDOW_DAYS): VisitPayload {
  const windowStart = utcDayStart(now - windowDays * DAY_MS);
  const candidates = models.flatMap((model): VisitCandidate[] => {
    if (!model.name) return [];
    const releaseDate = isIsoDay(model.releaseDate) ? model.releaseDate : null;
    const firstSeen = timestampOf(model.firstSeen) !== null ? model.firstSeen! : null;
    const latest = Math.max(releaseDayStart(releaseDate) ?? -Infinity, timestampOf(firstSeen) ?? -Infinity);
    if (!Number.isFinite(latest) || latest < windowStart || latest > now + DAY_MS) return [];
    return [{id: model.id, name: model.name, family: model.family, provider: model.provider, href: model.href, releaseDate, firstSeen}];
  });
  return {windowStart: new Date(windowStart).toISOString(), candidates};
}
