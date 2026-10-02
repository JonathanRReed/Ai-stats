
import { CATALOG_URLS, normalizeCatalog } from './public-catalogs.mjs';
import { prepareSourceSnapshot } from './source-snapshots.mjs';
import { retryDelayMs } from './source-refresh-policy.mjs';

const verifiedCachedInput = (sourceKey, cached, fetchedAt) => {
  if (!cached || cached.payload?.schemaVersion !== 1 || cached.payload?.sourceKey !== sourceKey ||
    !Array.isArray(cached.payload.records) || !cached.payload.records.length) throw new Error('No validated cached catalog');
  const input = { sourceKey, observedAt: cached.payload.observedAt ?? null, fetchedAt, records: cached.payload.records };
  prepareSourceSnapshot(input);
  return input;
};
/**
 * One admitted upstream request. Successful candidates are promoted after build verification.
 * @param {{sourceKey:string, store:Record<string,Function>, fetchImpl?:(input:string|URL|Request,init?:RequestInit)=>Promise<Response>, now?:string}} options
 */
export async function prepareCatalogRefresh({ sourceKey, store, fetchImpl = (url,init) => globalThis.fetch(url,init), now: fixedNow }) {
  const clock = () => fixedNow ?? new Date().toISOString();
  const now = clock();
  if (!Object.hasOwn(CATALOG_URLS, sourceKey)) throw new Error('Unknown public catalog');
  if (!Number.isFinite(Date.parse(now))) throw new Error('Invalid refresh clock');
  const lease = await store.claim(sourceKey);
  if (!lease.claimed) return { sourceKey, status: 'skipped', reason: lease.reason };
  let retryAfter = null;
  try {
    const cached = await store.current(sourceKey);
    const headers = new Headers({ Accept: 'application/json', 'User-Agent': 'AI-Stats/1.0' });
    if (lease.etag) headers.set('If-None-Match', lease.etag);
    if (lease.lastModified) headers.set('If-Modified-Since', lease.lastModified);
    const response = await fetchImpl(CATALOG_URLS[sourceKey], {
      headers, redirect: 'error', signal: AbortSignal.timeout(30000),
    });
    retryAfter = response.headers.get('Retry-After');
    let input;
    if (response.status === 304) {
      input = verifiedCachedInput(sourceKey, cached, clock());
    } else {
      if (!response.ok) throw new Error('Catalog request failed (' + response.status + ')');
      const records = normalizeCatalog(sourceKey, await response.json());
      const priorCount = cached?.payload?.records?.length ?? 0;
      if (priorCount && records.length < priorCount * .8) throw new Error('Catalog coverage fell by more than 20%; retaining last good snapshot');
      input = { sourceKey, observedAt: null, fetchedAt: clock(), records };
      prepareSourceSnapshot(input);
    }
    return { sourceKey, status: response.status === 304 ? 'unchanged' : 'prepared',
      leaseId: lease.leaseId, input, etag: response.headers.get('ETag') ?? (response.status === 304 ? lease.etag ?? null : null),
      lastModified: response.headers.get('Last-Modified') ?? (response.status === 304 ? lease.lastModified ?? null : null) };
  } catch (error) {
    const failedAt = Date.parse(clock());
    const delay = retryDelayMs(retryAfter, lease.attempts ?? 0, failedAt);
    const notBefore = new Date(Math.min(8640000000000000, failedAt + delay)).toISOString();
    await store.fail({ sourceKey, leaseId: lease.leaseId, notBefore,
      message: error instanceof Error ? error.message : 'Catalog refresh failed' });
    return { sourceKey, status: 'failed' };
  }
}
