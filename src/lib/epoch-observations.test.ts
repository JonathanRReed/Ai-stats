import { expect, test } from 'bun:test';
import * as evidence from './epoch-observations';
import type { EpochObservation } from './epoch-observations';

const diff: EpochObservation = {
  id: 'diff', modelVersion: 'Qwen2.5-Coder-32B-Instruct', benchmarkSlug: 'aider',
  metricKey: 'Percent correct', unit: 'percent', value: 8,
  conditions: { 'Edit format': 'diff' }, evaluationDate: null, sourceUrl: null,
  fetchedAt: '2026-10-01T13:47:48.952Z', snapshotId: 'one',
};
const whole: EpochObservation = { ...diff, id: 'whole', value: 16.4, conditions: { 'Edit format': 'whole' } };
const selection = { modelVersion: diff.modelVersion, benchmarkSlug: diff.benchmarkSlug };

test('different conditions remain distinct and never become an implicit winner', () => {
  const selected = evidence.selectComparableEpoch?.([whole, diff], selection);
  expect(selected?.observations).toEqual([diff, whole]);
  expect(selected?.requiresChoice).toBe(true);
  expect(evidence.selectComparableEpoch?.([diff, whole], selection)).toEqual(selected);
});
test('an exact condition selection resolves a known comparison', () => {
  const selected = evidence.selectComparableEpoch?.([diff, whole], {
    ...selection, conditionKey: JSON.stringify([['Edit format', 'whole']]),
  });
  expect(selected?.observations).toEqual([whole]);
  expect(selected?.excluded).toContainEqual({ id: 'diff', reason: 'conditions' });
});
test('model reasoning variants never inherit another variants evidence', () => {
  expect(evidence.selectComparableEpoch?.([diff], {
    ...selection, modelVersion: diff.modelVersion + '-high',
  })?.observations).toEqual([]);
});
test('repeated runs are retained without max-score aggregation', () => {
  const repeat = { ...diff, id: 'repeat', value: 9 };
  expect(evidence.selectComparableEpoch?.([diff, repeat], selection)?.observations).toEqual([diff, repeat]);
});
test('unknown conditions remain explicitly unknown', () => {
  const unknown = { ...diff, conditions: null };
  const result = evidence.selectComparableEpoch?.([unknown], selection);
  expect(result?.observations[0].conditions).toBeNull();
  expect(result?.hasUnknownConditions).toBe(true);
});
test('missing and nonfinite results are excluded but genuine zero remains', () => {
  const zero = { ...diff, value: 0 };
  const missing = { ...whole, value: null };
  const malformed = { ...whole, id: 'nan', value: NaN };
  expect(evidence.selectComparableEpoch?.([zero, missing, malformed], selection)?.observations).toEqual([zero]);
});
