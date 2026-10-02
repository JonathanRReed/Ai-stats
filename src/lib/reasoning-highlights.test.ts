import { expect, test } from 'bun:test';
import { buildReasoningHighlights } from './reasoning-highlights';
import type { EpochBenchmarkRun } from './supabase';

const run = (id: string, version: string, score: number | null, slug = 'gpqa_diamond'): EpochBenchmarkRun => ({
  id, model_version: version, score, benchmark_id: slug, benchmark_slug: slug,
  release_date: null, organization: null, country: null, stderr: null, score_unit: 'fraction',
});

test('reasoning highlights keep benchmarks and exact model variants separate', () => {
  const highlights = buildReasoningHighlights([
    run('a', 'model-high', .9), run('b', 'model-high', .8),
    run('c', 'model-low', .7), run('d', 'model-zero', 0),
    run('e', 'missing', null), run('f', 'invalid', Infinity),
    run('negative', 'invalid-negative', -1), run('out-of-range', 'invalid-range', 90),
    run('g', 'hle-model', .4, 'hle_external'),
  ], []);
  expect(highlights[0].runCount).toBe(4);
  expect(highlights[0].rows.map(row => [row.version, row.score])).toEqual([
    ['model-low', 70], ['model-zero', 0],
  ]);
  expect(highlights[1].rows[0].score).toBe(40);
  expect(highlights[2].rows).toEqual([]);
});

test('reasoning highlights never infer percentages from small native values',()=>{
  const native={...run('native','native-model',0.8),score_unit:'native' as const};
  const result=buildReasoningHighlights([native],[])[0];
  expect(result.rows[0].score).toBe(0.8);
  expect(result.rows[0].unit).toBe('native');
});
test('different recorded conditions for one exact variant remain ambiguous',()=>{
  const rows=[{...run('diff','same',.8),conditions:{format:'diff'}},
    {...run('whole','same',.9),conditions:{format:'whole'}}];
  const result=buildReasoningHighlights(rows,[])[0];
  expect(result.rows).toEqual([]);
  expect(result.ambiguousModelCount).toBe(1);
});
