import { expect, test } from 'bun:test';
import { preferPublishedEpoch } from './epoch-selection';

test('newer Epoch evidence wins even when it contains fewer rows', () => {
  const published = { fetchedAt: '2026-09-02T00:00:00Z', epochRuns: [{}] };
  expect(preferPublishedEpoch(published, '2026-04-25T00:00:00Z', 5000)).toBe(true);
  expect(preferPublishedEpoch(published, '2026-09-03T00:00:00Z', 1)).toBe(false);
});

test('ties prefer the explicit published snapshot, not accumulated database history', () => {
  const published = { fetchedAt: '2026-09-02T00:00:00Z', epochRuns: [{}] };
  expect(preferPublishedEpoch(published, published.fetchedAt, 5000)).toBe(true);
  expect(preferPublishedEpoch(published, null, 5000)).toBe(true);
  expect(preferPublishedEpoch(null, null, 0)).toBe(false);
  expect(preferPublishedEpoch({ ...published, epochRuns: [] }, null, 0)).toBe(false);
  expect(preferPublishedEpoch({ ...published, fetchedAt: 'invalid' }, null, 0)).toBe(false);
});
