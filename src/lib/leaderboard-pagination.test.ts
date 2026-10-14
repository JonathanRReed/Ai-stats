import { expect, test } from 'bun:test';
import { nextLeaderboardLimit, visibleLeaderboardRows } from './leaderboard-pagination';

test('leaderboard expansion advances by ranked windows and ends at all records', () => {
  const ranked = Array.from({ length: 73 }, (_, index) => `record-${index + 1}`);
  const limits = [5, nextLeaderboardLimit(5), nextLeaderboardLimit(20), nextLeaderboardLimit(50)];
  expect(limits).toEqual([5, 20, 50, Number.POSITIVE_INFINITY]);
  expect(limits.map(limit => visibleLeaderboardRows(ranked, limit).length)).toEqual([5, 20, 50, 73]);
  expect(visibleLeaderboardRows(ranked)).toEqual(ranked.slice(0, 5));
});
