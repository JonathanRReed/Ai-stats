import { expect, test } from 'bun:test';
import { preferPublishedEpoch } from './epoch-selection';
import * as selection from './epoch-selection';

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

test('validated cache selection chooses recency rather than row count', () => {
  const published = { fetchedAt: '2026-10-01T00:00:00Z', epochRuns: [{}, {}] };
  const cached = { fetchedAt: '2026-10-02T00:00:00Z', epochRuns: [{}] };
  expect(selection.chooseValidatedEpoch?.(published, cached)).toBe(cached);
  expect(selection.chooseValidatedEpoch?.(cached, published)).toBe(cached);
  expect(selection.chooseValidatedEpoch?.(published, null)).toBe(published);
});

test('an older compatible artifact beats a freshly fetched obsolete ingestion contract',()=>{
 const artifact={fetchedAt:'2026-10-03T05:00:00Z',epochRuns:[{}],sourceContract:2};
 const legacy={fetchedAt:'2026-10-03T14:00:00Z',epochRuns:[{}],sourceContract:1};
 expect(selection.chooseValidatedEpoch(artifact,legacy)).toBe(artifact);
 expect(selection.chooseValidatedEpoch(legacy,artifact)).toBe(artifact);
 const upgraded={...legacy,sourceContract:2};expect(selection.chooseValidatedEpoch(artifact,upgraded)).toBe(upgraded);
});
