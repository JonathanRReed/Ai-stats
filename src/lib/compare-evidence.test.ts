import { expect, test } from 'bun:test';
import * as compare from './compare-evidence';
import type { EpochObservation } from './epoch-observations';

const row: EpochObservation = { id: 'a', modelVersion: 'model-high', benchmarkSlug: 'aider',
  metricKey: 'Percent correct', unit: 'percent', value: 8, conditions: { 'Edit format': 'diff' },
  evaluationDate: null, sourceUrl: null, fetchedAt: null, snapshotId: null };
test('unpriced and free models remain in nonprice comparisons', () => {
  const free = { id: 'free', aa_intelligence_index: 0, price_1m_input_tokens: 0, price_1m_output_tokens: 0 };
  const unpriced = { id: 'unpriced', aa_intelligence_index: 40, price_1m_input_tokens: null };
  expect(compare.buildCompareEvidence?.([free, unpriced], [])?.models).toEqual([free, unpriced]);
  expect(compare.availableForMetric?.(free, 'price-pair')).toBe(true);
  expect(compare.availableForMetric?.(unpriced, 'price-pair')).toBe(false);
  expect(compare.availableForMetric?.(unpriced, 'aa_intelligence_index')).toBe(true);
  expect(compare.availableForMetric?.({ aa_intelligence_index: null }, 'aa_intelligence_index')).toBe(false);
});
test('ambiguous Epoch measurements do not overwrite each other', () => {
  const other = { ...row, id: 'b', value: 16.4, conditions: { 'Edit format': 'whole' } };
  const forward = compare.buildEpochScoreIndex?.([row, other], {});
  const reverse = compare.buildEpochScoreIndex?.([other, row], {});
  expect(forward).toEqual(reverse);
  expect(forward?.scores['model high']?.aider).toBeUndefined();
  expect(forward?.ambiguities['model high']?.aider).toBe(2);
});
test('cross-variant alias collisions remain unmatched', () => {
  const low = { ...row, id: 'low', modelVersion: 'model-low', value: 6 };
  const index = compare.buildEpochScoreIndex?.([row, low], {
    'model-high': ['Model'], 'model-low': ['Model'],
  });
  expect(index?.scores.model?.aider).toBeUndefined();
  expect(index?.scores['model high']?.aider).toBe(8);
});
test('percentage values below one are not magnified', () => {
  expect(compare.buildEpochScoreIndex?.([{ ...row, value: 0.8 }], {})?.scores['model high']?.aider).toBe(0.8);
  expect(compare.buildEpochScoreIndex?.([{ ...row, value: 0.8, unit: 'fraction' }], {})?.scores['model high']?.aider).toBe(80);
});
test('missing observations never turn into measured zero', () => {
  expect(compare.buildEpochScoreIndex?.([{ ...row, value: null }], {})?.scores).toEqual({});
  expect(compare.buildEpochScoreIndex?.([{ ...row, value: 0 }], {})?.scores['model high']?.aider).toBe(0);
});
