import { expect, test } from 'bun:test';
import { compactLegendStartY } from './chart-legend-layout';

test('compact family legend moves below current frontier and token price labels', () => {
  const frontierBaseline = 22;
  expect(compactLegendStartY(false, false)).toBe(15);
  expect(compactLegendStartY(false, true)).toBe(31);
  expect(compactLegendStartY(true, false)).toBe(30);
  expect(compactLegendStartY(true, true)).toBe(46);
  expect(compactLegendStartY(false, true)).toBeGreaterThan(frontierBaseline);
});
