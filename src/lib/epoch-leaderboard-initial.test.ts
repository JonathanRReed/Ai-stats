import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { buildInitialEpochLeaderboardData } from './epoch-leaderboard-initial';
import { resolveEpochLeaderboardRunNames } from './epoch-model-display-name';
import type { EpochBenchmark, EpochBenchmarkRun } from './supabase';

const benchmark = (slug: string): EpochBenchmark => ({
  id: `benchmark:${slug}`, slug, name: `Name for ${slug}`, description: null, source: null,
  metadata: { source_key: 'publisher-key', benchmark: 'publisher-benchmark', superseded_by: 'new-name', unused: 'discard me' },
});
const run = (id: string, model: string, score: number): EpochBenchmarkRun => ({
  id, model_version: model, benchmark_id: 'benchmark:gpqa', benchmark_slug: 'gpqa_diamond',
  score, score_metric: 'accuracy', score_unit: 'percent', benchmark_version: '2026',
  higher_is_better: true, conditions: { shots: 1 }, organization: 'Provider', source_key: 'publisher-key',
  source_name: 'Publisher', source_link: 'https://publisher.example/results', release_date: null,
  country: null, stderr: null, evaluation_date: null,
});

test('serialized Epoch picker inputs retain every paging row and only required source fields', () => {
  const payload = buildInitialEpochLeaderboardData(
    [benchmark('gpqa_diamond')],
    Array.from({ length: 30 }, (_, index) => run(`run:${index}`, `model:${index}`, 90 - index)),
    { gpqa_diamond: 'GPQA Diamond' },
    { 'model:0': 'Gemini 4 Argon (high)', 'model:1': 'Claude Sonnet 5.5 (max)' },
  );
  const serialized = JSON.stringify(payload);
  const decoded = JSON.parse(serialized);
  expect(decoded.runs).toHaveLength(30);
  expect(decoded.runs[29]).toMatchObject({ id: 'run:29', model_version: 'model:29', score: 61, benchmark_slug: 'gpqa_diamond' });
  expect(decoded.benchmarks[0].metadata).toEqual({ source_key: 'publisher-key', benchmark: 'publisher-benchmark', superseded_by: 'new-name' });
  expect(decoded.labels.gpqa_diamond).toBe('GPQA Diamond');
  expect(decoded.modelNames).toMatchObject({ 'model:0': 'Gemini 4 Argon (high)', 'model:1': 'Claude Sonnet 5.5 (max)' });

  const dashboard = readFileSync('src/components/Dashboard.astro', 'utf8');
  expect(dashboard).toContain('const initialEpochLeaderboard = buildInitialEpochLeaderboardData(');
  expect(dashboard).toContain('epochBenchmarksWithRuns,\n  epochRuns,\n  epochBenchmarkNames,');
  expect(dashboard).toMatch(/<script is:inline define:vars=\{\{[^}]*initialEpochLeaderboard[^}]*\}\}>/);
  expect(dashboard).toContain('window.__epochInitialBenchmarks = initialEpochLeaderboard.benchmarks');
  expect(dashboard).toContain('window.__epochInitialRuns = initialEpochLeaderboard.runs');
  expect(dashboard).toContain('window.__epochModelNames = initialEpochLeaderboard.modelNames');
  expect(dashboard).toContain('resolveEpochLeaderboardRunNames(cohort.runs, benchmarkModelNameRecord)');
  expect(dashboard).toContain('resolveEpochLeaderboardRunNames(cohort.runs, epochModelNames)');
  expect(dashboard).toContain('name: run.name,');
  expect(dashboard).toContain('...Object.fromEntries((snapshot.epochModels ?? []).flatMap');
  expect(dashboard).toContain('window.__epochBenchmarkLabels = initialEpochLeaderboard.labels');
});

test('Epoch names stay identical before expansion, after expansion, and after collapse', () => {
  const runs = Array.from({ length: 7 }, (_, index) => run(`run:${index}`, `model:${index}`, 90 - index));
  const names = { 'model:0': 'Gemini 4 Argon (high)', 'model:1': 'Claude Sonnet 5.5 (max)' };
  const initial = resolveEpochLeaderboardRunNames(runs.slice(0, 5), names);
  const expanded = resolveEpochLeaderboardRunNames(runs, names);
  const collapsed = resolveEpochLeaderboardRunNames(runs.slice(0, 5), names);
  expect(expanded.slice(0, 5).map(row => row.name)).toEqual(initial.map(row => row.name));
  expect(collapsed.map(row => row.name)).toEqual(initial.map(row => row.name));
  expect(expanded[0]).toMatchObject({ model_version: 'model:0', name: 'Gemini 4 Argon (high)' });
  expect(expanded[1]).toMatchObject({ model_version: 'model:1', name: 'Claude Sonnet 5.5 (max)' });
  expect(expanded[2]).toMatchObject({ model_version: 'model:2', name: 'model:2' });
});
