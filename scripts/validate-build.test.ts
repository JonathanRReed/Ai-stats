import { describe, expect, test } from 'bun:test';
import { validateComparisonBuild } from './validate-build.mjs';

const populated = () => ({
  validModels: [
    { id: 'a', name: 'Measured A', aa_coding_index: 0 },
    { id: 'b', name: 'Measured B', aa_coding_index: 72 },
  ],
  defaultModelIds: ['a', 'b'],
  availableBenchmarks: { simplebench: 'SimpleBench' },
});

describe('release data gate', () => {
  test('accepts measured data, including genuine zero scores', () => {
    expect(validateComparisonBuild(populated())).toEqual({ models: 2, defaults: 2, benchmarks: 1 });
  });
  test('blocks empty or malformed model builds', () => {
    for (const value of [null, {}, { validModels: [] }]) {
      expect(() => validateComparisonBuild(value)).toThrow('comparisons are empty');
    }
  });
  test('blocks broken identities and default selections', () => {
    const data = populated();
    expect(() => validateComparisonBuild({ ...data, defaultModelIds: ['a', 'missing'] })).toThrow('measured coding evidence');
    expect(() => validateComparisonBuild({ ...data, defaultModelIds: ['a', 'a'] })).toThrow('incomplete');
    expect(() => validateComparisonBuild({ ...data, validModels: [data.validModels[0], data.validModels[0]] })).toThrow('duplicate');
    expect(() => validateComparisonBuild({ ...data, validModels: [{ id: 'a', name: '' }, data.validModels[1]] })).toThrow('identity');
  });
  test('blocks missing or illustrative default evidence and empty benchmark lists', () => {
    const data = populated();
    expect(() => validateComparisonBuild({ ...data, validModels: [{ ...data.validModels[0], aa_coding_index: null }, data.validModels[1]] })).toThrow('measured coding evidence');
    expect(() => validateComparisonBuild({ ...data, validModels: [{ ...data.validModels[0], isIllustrativeFallback: true }, data.validModels[1]] })).toThrow('measured coding evidence');
    expect(() => validateComparisonBuild({ ...data, availableBenchmarks: [] })).toThrow('no named benchmark');
    expect(() => validateComparisonBuild({ ...data, availableBenchmarks: {} })).toThrow('no named benchmark');
    expect(() => validateComparisonBuild({ ...data, availableBenchmarks: { simplebench: '' } })).toThrow('no named benchmark');
  });
});
