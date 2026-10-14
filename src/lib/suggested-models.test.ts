import { describe, expect, it } from 'bun:test';
import { suggestedModels, type SuggestionPoint } from './suggested-models';

function point(
  id: string,
  x: number,
  y: number,
  extra: Partial<SuggestionPoint> = {},
): SuggestionPoint {
  return {
    id,
    modelId: id,
    x,
    y,
    provider: id,
    family: id,
    cohortKey: '4.3:long',
    indexVersion: '4.3',
    ...extra,
  };
}

describe('suggestedModels', () => {
  it('selects stable frontier endpoints and tradeoffs', () => {
    const rows = Array.from({ length: 20 }, (_, index) =>
      point(`m${index}`, index, index));
    const ids = suggestedModels(rows);

    expect(ids).toHaveLength(8);
    expect(ids).toContain('m0');
    expect(ids).toContain('m19');
    expect(suggestedModels([...rows].reverse())).toEqual(ids);
  });

  it('compares numeric index versions by their segments', () => {
    const rows = [
      point('version-4.9', 1, 100, { indexVersion: '4.9', cohortKey: '4.9:long' }),
      point('version-4.10', 1, 20, { indexVersion: '4.10', cohortKey: '4.10:long' }),
    ];

    expect(suggestedModels(rows)).toEqual(['version-4.10']);
  });

  it('uses one cohort from the latest valid version', () => {
    const rows = [
      point('old', 1, 100, { indexVersion: '4.2', cohortKey: '4.2:long' }),
      point('new-a', 1, 30),
      point('new-b', 2, 40),
      point('other', 1, 90, { cohortKey: '4.3:short' }),
      point('bad', 0, 200, { indexVersion: 'latest' }),
    ];

    expect(new Set(suggestedModels(rows))).toEqual(new Set(['new-a', 'new-b']));
  });

  it('keeps every frontier point when fewer than eight qualify', () => {
    const rows = [
      point('tradeoff-a', 1, 10),
      point('tradeoff-b', 2, 20),
      point('tradeoff-c', 3, 30),
      point('tradeoff-d', 4, 40),
    ];

    expect(new Set(suggestedModels(rows))).toEqual(new Set(rows.map(row => row.modelId)));
  });

  it('fills with measured comparisons and handles higher-is-better X', () => {
    const rows = [
      point('winner', 1, 100),
      ...Array.from({ length: 10 }, (_, index) =>
        point(`other${index}`, index + 2, 90 - index)),
    ];

    expect(suggestedModels(rows)).toHaveLength(8);
    expect(new Set(suggestedModels([
      point('fast', 100, 40),
      point('smart', 10, 100),
      point('slow', 1, 1),
    ], 'max', 2))).toEqual(new Set(['fast', 'smart']));
  });

  it('keeps zero, excludes invalid points, deduplicates identities, and never pads', () => {
    expect(suggestedModels([
      point('zero', 0, 120),
      point('negative', -1, 200),
      point('not-finite', 1, Number.NaN),
    ])).toEqual(['zero']);
    expect(suggestedModels([])).toEqual([]);
    expect(suggestedModels([
      point('a', 1, 10),
      point('a-copy', 1, 10, { modelId: 'a' }),
      point('b', 2, 20),
    ])).toHaveLength(2);
  });

  it('allows newly measured leaders to change future suggestions', () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      point(`m${index}`, index + 1, index + 10));
    const before = suggestedModels(rows);
    const after = suggestedModels([...rows, point('new-leader', 0.5, 100)]);

    expect(after).toContain('new-leader');
    expect(suggestedModels(rows)).toEqual(before);
  });
});
