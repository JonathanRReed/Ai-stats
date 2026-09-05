import type { PublicPoliBenchSnapshot } from './polibench-snapshot';

/**
 * The trimmed model list the home-page PoliBench lab switches between.
 * Served from /api/polibench-lab.json and fetched on first use, so the home
 * document no longer carries the whole snapshot inline.
 */
export const buildPoliBenchLabPayload = (snapshot: PublicPoliBenchSnapshot | null) => {
  if (!snapshot) return [];
  const expectedByRunId = new Map(snapshot.runs.map((run) => [run.runId, run.expectedResponses]));
  return [...snapshot.models]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((model) => ({
      modelSlug: model.modelSlug,
      label: model.label,
      provider: model.provider,
      evidenceLevel: model.evidenceLevel,
      evidenceLabel: model.evidenceLabel,
      completionRate: model.completionRate,
      completedResponses: model.completedResponses,
      expectedResponses: expectedByRunId.get(model.runId) ?? null,
      parseValidity: model.parseValidity,
      robustness: model.robustness,
      uncertaintySummary: model.uncertaintySummary,
      releases: { benchmarkRelease: model.releases.benchmarkRelease },
      axisScores: model.axisScores,
    }));
};
