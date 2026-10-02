import { expect, test } from 'bun:test';
import * as records from './epoch-records.mjs';

const row = { id: 'rec-diff', 'Model version': 'Qwen2.5-Coder-32B-Instruct',
  'Percent correct': '8.0', 'Edit format': 'diff', 'Token budget': '0',
  'Date of evaluation': '2026-09-15', 'Source link': 'https://aider.chat/docs/leaderboards/' };

test('normalization preserves score and recorded conditions', () => {
  expect(records.normalizeEpochRecord?.(row, 'aider_polyglot_external')).toMatchObject({
    id: 'rec-diff', modelVersion: 'Qwen2.5-Coder-32B-Instruct',
    benchmarkSlug: 'aider_polyglot_external', metricKey: 'Percent correct',
    value: 8, unit: 'percent', conditions: { 'Edit format': 'diff', 'Token budget': '0' },
    evaluationDate: '2026-09-15', sourceUrl: 'https://aider.chat/docs/leaderboards/',
  });
});
test('unknown numeric columns never become benchmark scores', () => {
  expect(records.normalizeEpochRecord?.({ 'Model version': 'x', 'Training seconds': '100' }, 'new-benchmark'))
    .toMatchObject({ value: null, metricKey: null, unit: 'native' });
});
test('zero is measured and blank is missing', () => {
  expect(records.normalizeEpochRecord?.({ 'Model version': 'x', Score: '0' }, 'test')?.value).toBe(0);
  expect(records.normalizeEpochRecord?.({ 'Model version': 'x', Score: '' }, 'test')?.value).toBeNull();
});
test('fallback identities include exact condition settings', () => {
  const first = records.normalizeEpochRecord?.({ ...row, id: undefined }, 'test');
  const other = records.normalizeEpochRecord?.({ ...row, id: undefined, 'Edit format': 'whole' }, 'test');
  expect(first?.id).toBeString();
  expect(first?.id).not.toBe(other?.id);
});
test('condition order does not change fallback identity', () => {
  const a = { 'Model version': 'x', Score: '1', 'Edit format': 'whole', Temperature: '0.1' };
  const b = { Temperature: '0.1', Score: '1', 'Edit format': 'whole', 'Model version': 'x' };
  const first = records.normalizeEpochRecord?.(a, 'test');
  const second = records.normalizeEpochRecord?.(b, 'test');
  expect(first?.id).toBeString();
  expect(first?.id).toBe(second?.id);
});
test('invalid identities are rejected instead of becoming phantom models', () => {
  expect(records.normalizeEpochRecord?.({ Score: '10' }, 'test')).toBeNull();
});

test('published runs retain source conditions without exposing the raw record', () => {
  const result = records.buildPublicEpochRun?.({
    epoch_run_id: 'run-1', model_version: row['Model version'], score: 8,
    score_metric: 'Percent correct', raw: { ...row, Notes: 'raw-only note' },
    release_date: '2024-11-21', source_link: row['Source link'],
  }, 'aider_polyglot_external');
  expect(result).toMatchObject({ id: 'run-1', score: 8, score_unit: 'percent',
    evaluation_date: '2026-09-15', conditions: { 'Edit format': 'diff', 'Token budget': '0' } });
  expect(result).not.toHaveProperty('raw');
  expect(result?.conditions).not.toHaveProperty('Notes');
});

test('measured outcomes are not mislabeled as evaluation settings', () => {
  const result = records.normalizeEpochRecord({
    ...row, 'Percent using correct edit format': '71.6', 'Mean output tokens': '3000',
    'Dataset score': '0.5', '16k token score': '0.7', 'Mean agent steps': '12',
    'Agent Org': 'Example lab', 'Harness version': 'v2', Shots: '0',
  }, 'aider_polyglot_external');
  expect(result?.conditions).toEqual({
    'Agent Org': 'Example lab', 'Edit format': 'diff', 'Harness version': 'v2',
    Shots: '0', 'Token budget': '0',
  });
});
