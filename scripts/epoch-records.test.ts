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
