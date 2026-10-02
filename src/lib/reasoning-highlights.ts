import type { EpochBenchmarkRun, EpochModel } from './supabase';

export const REASONING_BENCHMARKS = [
  { slug: 'gpqa_diamond', name: 'GPQA Diamond', description: 'Graduate-level science questions.' },
  { slug: 'hle_external', name: "Humanity's Last Exam", description: 'Expert questions across academic subjects.' },
  { slug: 'simplebench_external', name: 'SimpleBench', description: 'Everyday reasoning and common-sense questions.' },
] as const;

export function buildReasoningHighlights(runs: EpochBenchmarkRun[], models: EpochModel[]) {
  const byVersion = new Map(models.map(model => [model.model_version, model]));
  return REASONING_BENCHMARKS.map(benchmark => {
    const measured = runs.filter(run => run.benchmark_slug === benchmark.slug &&
      typeof run.score === 'number' && Number.isFinite(run.score) && run.score >= 0 &&
      (run.score_unit !== 'fraction' || run.score <= 1) &&
      (run.score_unit !== 'percent' || run.score <= 100));
    const grouped = new Map<string, EpochBenchmarkRun[]>();
    for (const run of measured) {
      const group = grouped.get(run.model_version) ?? [];
      group.push(run);
      grouped.set(run.model_version, group);
    }
    const ambiguousModelCount = [...grouped.values()].filter(group => group.length > 1).length;
    const rows = [...grouped.entries()].flatMap(([version, group]) => {
      if (group.length !== 1) return [];
      const run = group[0];
      const model = byVersion.get(version);
      const unit = run.score_unit === 'fraction' || run.score_unit === 'percent' ? 'percent' : 'native';
      return [{
        version, name: model?.display_name || model?.model_name || version,
        score: run.score! * (run.score_unit === 'fraction' ? 100 : 1),
        unit, metric: run.score_metric ?? 'Source score', runId: run.id,
        conditions: run.conditions ?? null, evaluationDate: run.evaluation_date ?? null,
      }];
    }).sort((a, b) => a.version.localeCompare(b.version)).slice(0, 3);
    return { ...benchmark, runCount: measured.length, ambiguousModelCount, rows };
  });
}

export type ReasoningHighlights = ReturnType<typeof buildReasoningHighlights>;
