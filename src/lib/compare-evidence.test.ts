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

test('source runs adapt to observation records without inventing conditions', () => {
  const adapted = compare.fromEpochRuns?.([{
    id: 'raw', model_version: 'model-high', benchmark_id: 'aider', benchmark_slug: 'aider',
    score: 0.8, score_metric: 'Percent correct', release_date: null, organization: null,
    country: null, stderr: null, score_unit: 'percent',
    conditions: { 'Edit format': 'diff' }, evaluation_date: '2026-09-15',
  }], '2026-10-01T00:00:00Z');
  expect(adapted?.[0]).toMatchObject({ id: 'raw', modelVersion: 'model-high', benchmarkSlug: 'aider',
    value: 0.8, unit: 'percent', conditions: { 'Edit format': 'diff' },
    evaluationDate: '2026-09-15', fetchedAt: '2026-10-01T00:00:00Z' });
});

test('each displayed Epoch score keeps its own source receipt', () => {
  const run = { ...row, evaluationDate: '2024-11-21', fetchedAt: '2026-10-02T00:00:00Z',
    sourceUrl: 'https://aider.chat/docs/leaderboards/' };
  expect(compare.buildEpochScoreIndex([run], {}).receipts?.['model high']?.aider).toMatchObject({
    evaluationDate: '2024-11-21', fetchedAt: '2026-10-02T00:00:00Z',
    conditions: { 'Edit format': 'diff' }, sourceUrl: 'https://aider.chat/docs/leaderboards/',
  });
});
test('Epoch dates never inherit AA refresh timestamps', () => {
  const model = { last_seen: '2026-10-02T00:00:00Z' };
  expect(compare.comparisonEvidenceDate?.(model, 'epoch_aider', { ...row, evaluationDate: '2024-11-21' }))
    .toEqual({ kind: 'evaluated', value: '2024-11-21' });
  expect(compare.comparisonEvidenceDate?.(model, 'epoch_aider'))
    .toEqual({ kind: 'unknown', value: null });
  expect(compare.comparisonEvidenceDate?.(model, 'epoch_aider', { ...row, fetchedAt: '2026-10-01T00:00:00Z' }))
    .toEqual({ kind: 'retrieved', value: '2026-10-01T00:00:00Z' });
});
test('price axes stay finite for zero and missing prices', () => {
  expect(compare.priceChartMaximum?.([])).toBe(1);
  expect(compare.priceChartMaximum?.([0, 0])).toBe(1);
  expect(compare.priceChartMaximum?.([null, 2])).toBe(2.4);
});

test('native accuracy units are not silently labeled percent and mixed units cannot share a chart', () => {
  expect(compare.buildEpochScoreIndex([{ ...row, metricKey: 'Accuracy', unit: 'native', value: 0.8 }], {}).units?.aider).toBe('native');
  const mixed = compare.buildEpochScoreIndex([row, { ...row, id: 'other', modelVersion: 'other',
    metricKey: 'Accuracy', unit: 'native', value: 0.8 }], {});
  expect(mixed.units?.aider).toBe('mixed');
  expect(mixed.scores['model high']?.aider).toBeUndefined();
});
