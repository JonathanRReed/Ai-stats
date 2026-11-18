import { expect, test } from 'bun:test';
import { COHORT_LAG_LIMIT_DAYS, describeCohortFreshness } from './cohort-freshness';

test('a membership list that trails the measurements by more than the limit is stale', () => {
  const stale = describeCohortFreshness('2026-10-30T17:00:05Z', '2026-11-18T17:00:10Z');
  expect(stale).toMatchObject({ lagDays: 19, stale: true, listedAt: '2026-10-30T17:00:05.000Z' });
  expect(describeCohortFreshness('2026-11-18T13:00:00Z', '2026-11-18T17:00:00Z')).toMatchObject({ lagDays: 0, stale: false });
  expect(describeCohortFreshness('2026-11-15T17:00:00Z', '2026-11-18T17:00:00Z').stale).toBe(false);
  expect(COHORT_LAG_LIMIT_DAYS).toBe(3);
});

test('a list newer than the measurements, or a missing date, makes no stale claim', () => {
  expect(describeCohortFreshness('2026-11-18T17:00:00Z', '2026-11-10T00:00:00Z')).toMatchObject({ lagDays: 0, stale: false });
  expect(describeCohortFreshness(null, '2026-11-18T17:00:00Z')).toMatchObject({ lagDays: null, stale: false });
  expect(describeCohortFreshness('not a date', undefined)).toEqual({ listedAt: null, measuredAt: null, lagDays: null, stale: false });
});
