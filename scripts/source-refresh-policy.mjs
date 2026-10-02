const POLICIES = Object.freeze({
  'artificial-analysis': { intervalHours: 4, staleAfterHours: 8 },
  'epoch-ai': { intervalHours: 6, staleAfterHours: 12 },
  simplebench: { intervalHours: 6, staleAfterHours: 12 },
  openrouter: { intervalHours: 6, staleAfterHours: 12 },
  'openrouter-usage': { intervalHours: 6, staleAfterHours: 12 },
  huggingface: { intervalHours: 24, staleAfterHours: 48 },
  litellm: { intervalHours: 24, staleAfterHours: 48 },
  polibench: { intervalHours: 24, staleAfterHours: 336 },
});
export const getRefreshPolicy = sourceKey => ({ ...(POLICIES[sourceKey] ?? { intervalHours: 24, staleAfterHours: 336 }) });
/** Health reflects the deployed schedule; target cadence is not a claim that ingestion changed. */
export const getActiveRefreshPolicy = sourceKey => sourceKey === 'artificial-analysis'
  ? { intervalHours: 12, staleAfterHours: 24 } : getRefreshPolicy(sourceKey);
const millis = value => value === null || value === undefined ? NaN : value instanceof Date ? value.getTime() : Date.parse(value);
const iso = value => Number.isFinite(millis(value)) ? new Date(millis(value)).toISOString() : null;

/** @param {Record<string, any>} receipt @param {string | Date} now */
export function resolveReceipt(receipt, now = new Date()) {
  const fetchedAt = iso(receipt.fetchedAt);
  const current = millis(now);
  const ageHours = fetchedAt && Number.isFinite(current) ? Math.max(0, (current - Date.parse(fetchedAt)) / 3600000) : null;
  return { sourceKey: receipt.sourceKey, sourceObservedAt: iso(receipt.sourceObservedAt),
    fetchedAt, publishedAt: iso(receipt.publishedAt),
    lastSuccessfulSnapshotId: receipt.lastSuccessfulSnapshotId ?? null, ageHours,
    status: ageHours === null ? 'unavailable' : ageHours > getActiveRefreshPolicy(receipt.sourceKey).staleAfterHours ? 'stale' : 'healthy' };
}

/** Never shorten upstream Retry-After. Long delays are persisted, not slept inside a short job. */
export function retryDelayMs(retryAfter, attempt = 0, now = Date.now()) {
  const exponential = Math.min(300000, 1000 * 2 ** Math.min(20, Math.max(0, Number.isFinite(attempt) ? attempt : 0)));
  if (typeof retryAfter !== 'string' || !retryAfter.trim()) return exponential;
  const value = retryAfter.trim();
  const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) && delay >= 0 ? Math.max(exponential, delay) : exponential;
}

/** @param {{sourceKey: string, now?: string | Date, lastFetchedAt?: string | Date | null, notBefore?: string | Date | null, active?: boolean, requestsUsed?: number, requestCost?: number, dailyLimit?: number, reserve?: number}} options */
export function refreshDecision({ sourceKey, now = new Date(), lastFetchedAt = null, notBefore = null,
  active = false, requestsUsed = 0, requestCost = 1, dailyLimit = Infinity, reserve = 0 }) {
  const current = millis(now);
  if (active) return { allowed: false, reason: 'active' };
  if (!Number.isFinite(current)) return { allowed: false, reason: 'invalid-clock' };
  if (millis(notBefore) > current) return { allowed: false, reason: 'backoff' };
  if (![requestsUsed, requestCost, reserve].every(value => Number.isFinite(value) && value >= 0) ||
    !(dailyLimit > 0) || requestsUsed + requestCost > dailyLimit - reserve) return { allowed: false, reason: 'quota' };
  if (Number.isFinite(millis(lastFetchedAt)) && current - millis(lastFetchedAt) < getRefreshPolicy(sourceKey).intervalHours * 3600000) {
    return { allowed: false, reason: 'interval' };
  }
  return { allowed: true, reason: 'due' };
}

export function shouldPublishContent({status, previousHash, contentHash}) {
  return status >= 200 && status < 300 && typeof contentHash === 'string' &&
    contentHash.length > 0 && contentHash !== previousHash;
}
