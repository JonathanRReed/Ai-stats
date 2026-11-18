import { expect, test } from 'bun:test';
import { slugify } from './model-pages';
import { benchmarkPath, familySlug, labPath, matchupPath } from './site-routes';

test('route slugs match the model page slug rule', () => {
  for (const value of ['GPT-6.1 Sol', 'Command A+', 'Z AI', 'Élan Vital 2', 'swe_bench_verified', '  spaced  out  ']) {
    expect(familySlug(value)).toBe(slugify(value));
    expect(labPath(value)).toBe('/labs/' + slugify(value));
    expect(benchmarkPath(value)).toBe('/benchmarks/' + slugify(value));
  }
});

test('a matchup has one address whichever family is named first, and empty names still resolve', () => {
  expect(matchupPath('gpt-6-astra', 'claude-opus-5-5')).toBe('/compare/claude-opus-5-5-vs-gpt-6-astra');
  expect(matchupPath('claude-opus-5-5', 'gpt-6-astra')).toBe('/compare/claude-opus-5-5-vs-gpt-6-astra');
  expect(labPath('***')).toBe('/labs/lab');
  expect(benchmarkPath('')).toBe('/benchmarks/benchmark');
  expect(familySlug('')).toBe('model');
});
