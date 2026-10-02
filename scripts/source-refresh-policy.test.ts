import { expect, test } from 'bun:test';
import * as policy from './source-refresh-policy.mjs';
test('source cadences match bounded free-tier refresh targets', () => {
  for (const [source, intervalHours, staleAfterHours] of [
    ['artificial-analysis', 4, 8], ['epoch-ai', 6, 12], ['openrouter', 6, 12],
    ['openrouter-usage', 6, 12], ['huggingface', 24, 48], ['litellm', 24, 48],
  ] as const) expect(policy.getRefreshPolicy?.(source)).toMatchObject({intervalHours, staleAfterHours});
});
test('receipts separate ingestion freshness from old evaluation dates', () => {
  const receipt = { sourceKey: 'epoch-ai', sourceObservedAt: '2020-01-01T00:00:00Z',
    fetchedAt: '2026-10-02T00:00:00Z', publishedAt: '2026-10-02T00:05:00Z',
    lastSuccessfulSnapshotId: '42' };
  expect(policy.resolveReceipt?.(receipt, '2026-10-02T06:00:00Z')).toMatchObject({
    status: 'healthy', ageHours: 6, sourceObservedAt: '2020-01-01T00:00:00.000Z',
    lastSuccessfulSnapshotId: '42',
  });
  expect(policy.resolveReceipt?.(receipt, '2026-10-02T13:00:00Z')?.status).toBe('stale');
  expect(policy.resolveReceipt?.({...receipt, fetchedAt: null}, '2026-10-02T06:00:00Z')?.status).toBe('unavailable');
});
test('Retry-After honors server delay and caps local exponential backoff', () => {
  expect(policy.retryDelayMs?.('120', 0, Date.parse('2026-10-02T00:00:00Z'))).toBe(120000);
  expect(policy.retryDelayMs?.('Fri, 02 Oct 2026 00:01:00 GMT', 0, Date.parse('2026-10-02T00:00:00Z'))).toBe(60000);
  expect(policy.retryDelayMs?.(null, 12, 0)).toBe(300000);
  expect(policy.retryDelayMs?.('86400', 0, 0)).toBe(86400000);
});
test('refresh gate respects active jobs, not-before and daily quota reserves', () => {
  const base = {sourceKey: 'artificial-analysis', now: '2026-10-02T12:00:00Z',
    lastFetchedAt: '2026-10-02T00:00:00Z', requestsUsed: 10, requestCost: 2, dailyLimit: 100, reserve: 10};
  expect(policy.refreshDecision?.(base)?.allowed).toBe(true);
  expect(policy.refreshDecision?.({...base, active: true})?.reason).toBe('active');
  expect(policy.refreshDecision?.({...base, notBefore: '2026-10-02T13:00:00Z'})?.reason).toBe('backoff');
  expect(policy.refreshDecision?.({...base, requestsUsed: 89})?.reason).toBe('quota');
  expect(policy.refreshDecision?.({...base, lastFetchedAt: '2026-10-02T11:00:00Z'})?.reason).toBe('interval');
});
test('unchanged responses and payloads do not require deployment', () => {
  expect(policy.shouldPublishContent?.({status: 304, previousHash: 'a', contentHash: null})).toBe(false);
  expect(policy.shouldPublishContent?.({status: 200, previousHash: 'a', contentHash: 'a'})).toBe(false);
  expect(policy.shouldPublishContent?.({status: 200, previousHash: 'a', contentHash: 'b'})).toBe(true);
  expect(policy.shouldPublishContent?.({status: 503, previousHash: 'a', contentHash: 'b'})).toBe(false);
});

test('active AA health follows its current twelve-hour schedule until quota guards are enabled',()=>{
  expect(policy.getActiveRefreshPolicy?.('artificial-analysis')).toMatchObject({intervalHours:12,staleAfterHours:24});
});
