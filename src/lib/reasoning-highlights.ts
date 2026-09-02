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
      typeof run.score === 'number' && Number.isFinite(run.score) && run.score >= 0 && run.score <= 1);
    const byModel = new Map<string, { version: string; name: string; score: number; runId: string }>();
    for (const run of measured) {
      // These three source series report accuracy as a fraction, not index points.
      const score = run.score! * 100;
      const existing = byModel.get(run.model_version);
      if (existing && existing.score >= score) continue;
      const model = byVersion.get(run.model_version);
      byModel.set(run.model_version, {
        version: run.model_version,
        name: model?.display_name || model?.model_name || run.model_version,
        score,
        runId: run.id,
      });
    }
    return {
      ...benchmark,
      runCount: measured.length,
      rows: [...byModel.values()].sort((a, b) => b.score - a.score || a.version.localeCompare(b.version)).slice(0, 3),
    };
  });
}

export type ReasoningHighlights = ReturnType<typeof buildReasoningHighlights>;
