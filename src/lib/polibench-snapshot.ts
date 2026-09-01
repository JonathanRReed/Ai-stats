import { readFile } from "node:fs/promises";
import path from "node:path";

export type PoliBenchAxisScore = {
  axis: string;
  score: number;
  answeredItems: number;
};

export type PublicPoliBenchArtifactLinks = {
  canonicalResponses: string;
  axisIntervals: string;
  responseStyleControls: string;
  exclusions: string;
  duplicateResolution: string;
  rawResponses: string;
};

export type PublicPoliBenchModel = {
  modelSlug: string;
  provider: string;
  label: string;
  note: string;
  releases: {
    release: string;
    benchmarkRelease: string;
    paperReleaseVersion: string;
  };
  runId: string;
  status: string;
  evidenceLevel: number;
  evidenceLabel: string;
  scoreStatus: string;
  uncertaintySummary: string;
  robustness: number;
  completionRate: number;
  completedResponses: number;
  parseValidResponses: number;
  parseValidity: number;
  paraphraseStability: number;
  rerunStability: number;
  contradictionConsistency: number;
  resolutionRate: number;
  costPerCompletedResponse: number;
  p95LatencyMs: number;
  axisScores: PoliBenchAxisScore[];
  lastRunStartedAt: number;
  lastRunFinishedAt: number;
  artifactLinks: PublicPoliBenchArtifactLinks;
};

export type PublicPoliBenchRun = {
  runId: string;
  suite: "full";
  modelSlug: string;
  status: string;
  startedAt: number;
  finishedAt: number | null;
  expectedResponses: number;
  completedResponses: number;
  parseValidResponses: number;
  completionRate: number;
  parseValidity: number;
  rerunStability: number;
  robustness: number;
  costPerCompletedResponse: number | null;
  p95LatencyMs: number | null;
  releases: {
    release: string;
    benchmarkRelease: string;
    paperReleaseVersion: string;
  };
};

export type PublicPoliBenchSnapshot = {
  schemaVersion: "1.0";
  source: {
    repository: string;
    commit: string;
    artifactPath: string;
  };
  freshness: {
    generatedAt: string;
    suite: "full";
    source: "live-convex-snapshot";
  };
  evidence: {
    kind: "live_operational_model_output";
    label: "Live operational model-output evidence";
    humanValidation: "not_collected";
    externalValidation: "not_externally_validated";
    paperRelease: "not_frozen";
    boundary: string;
  };
  counts: { models: number; rows: number; runs: number };
  models: PublicPoliBenchModel[];
  runs: PublicPoliBenchRun[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isAxisScore = (value: unknown): value is PoliBenchAxisScore =>
  isRecord(value) &&
  isNonEmptyString(value.axis) &&
  isFiniteNumber(value.score) &&
  isFiniteNumber(value.answeredItems);

const isSafeInternalPath = (value: unknown): value is string =>
  isNonEmptyString(value) &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\") &&
  !value.includes("..");

const isArtifactLinks = (value: unknown): value is PublicPoliBenchArtifactLinks =>
  isRecord(value) &&
  isSafeInternalPath(value.canonicalResponses) &&
  isSafeInternalPath(value.axisIntervals) &&
  isSafeInternalPath(value.responseStyleControls) &&
  isSafeInternalPath(value.exclusions) &&
  isSafeInternalPath(value.duplicateResolution) &&
  isSafeInternalPath(value.rawResponses);

const isReleases = (value: unknown): value is PublicPoliBenchRun["releases"] =>
  isRecord(value) &&
  isNonEmptyString(value.release) &&
  isNonEmptyString(value.benchmarkRelease) &&
  isNonEmptyString(value.paperReleaseVersion);

const isPublicModel = (value: unknown): value is PublicPoliBenchModel => {
  if (!isRecord(value) || !isReleases(value.releases) || !Array.isArray(value.axisScores) ||
    !isArtifactLinks(value.artifactLinks)) return false;
  const requiredText = [
    value.modelSlug,
    value.provider,
    value.label,
    value.note,
    value.runId,
    value.status,
    value.evidenceLabel,
    value.scoreStatus,
    value.uncertaintySummary,
    value.releases.release,
    value.releases.benchmarkRelease,
    value.releases.paperReleaseVersion,
  ];
  const requiredNumbers = [
    value.evidenceLevel,
    value.robustness,
    value.completionRate,
    value.completedResponses,
    value.parseValidResponses,
    value.parseValidity,
    value.paraphraseStability,
    value.rerunStability,
    value.contradictionConsistency,
    value.resolutionRate,
    value.costPerCompletedResponse,
    value.p95LatencyMs,
    value.lastRunStartedAt,
    value.lastRunFinishedAt,
  ];
  return requiredText.every(isNonEmptyString) &&
    requiredNumbers.every(isFiniteNumber) &&
    value.axisScores.length > 0 &&
    value.axisScores.every(isAxisScore);
};

const isOptionalNumber = (value: unknown): value is number | null =>
  value === null || isFiniteNumber(value);

const isPublicRun = (value: unknown): value is PublicPoliBenchRun => {
  if (!isRecord(value) || !isReleases(value.releases)) return false;
  const requiredText = [value.runId, value.modelSlug, value.status];
  const requiredNumbers = [
    value.startedAt,
    value.expectedResponses,
    value.completedResponses,
    value.parseValidResponses,
    value.completionRate,
    value.parseValidity,
    value.rerunStability,
    value.robustness,
  ];
  return value.suite === "full" &&
    requiredText.every(isNonEmptyString) &&
    requiredNumbers.every(isFiniteNumber) &&
    isOptionalNumber(value.finishedAt) &&
    isOptionalNumber(value.costPerCompletedResponse) &&
    isOptionalNumber(value.p95LatencyMs);
};

const isPublicPoliBenchSnapshot = (value: unknown): value is PublicPoliBenchSnapshot => {
  if (!isRecord(value) || !isRecord(value.source) || !isRecord(value.freshness) ||
    !isRecord(value.evidence) || !isRecord(value.counts) || !Array.isArray(value.models) ||
    !Array.isArray(value.runs)) return false;

  if (!(value.schemaVersion === "1.0" &&
    isNonEmptyString(value.source.repository) &&
    isNonEmptyString(value.source.commit) &&
    isNonEmptyString(value.source.artifactPath) &&
    isNonEmptyString(value.freshness.generatedAt) &&
    value.freshness.suite === "full" &&
    value.freshness.source === "live-convex-snapshot" &&
    value.evidence.kind === "live_operational_model_output" &&
    value.evidence.label === "Live operational model-output evidence" &&
    value.evidence.humanValidation === "not_collected" &&
    value.evidence.externalValidation === "not_externally_validated" &&
    value.evidence.paperRelease === "not_frozen" &&
    isNonEmptyString(value.evidence.boundary) &&
    isFiniteNumber(value.counts.models) &&
    isFiniteNumber(value.counts.rows) &&
    isFiniteNumber(value.counts.runs) &&
    value.counts.models === value.models.length &&
    value.counts.rows === value.models.length &&
    value.counts.runs === value.runs.length &&
    value.models.length > 0 &&
    value.runs.length > 0)) return false;

  const models = value.models;
  const runs = value.runs;
  if (!models.every(isPublicModel) || !runs.every(isPublicRun)) return false;

  return new Set(models.map((model) => model.modelSlug)).size === models.length &&
    new Set(runs.map((run) => run.runId)).size === runs.length &&
    runs.every((run) => models.some((model) => model.modelSlug === run.modelSlug)) &&
    models.every((model) => runs.some(
      (run) => run.runId === model.runId && run.modelSlug === model.modelSlug,
    ));
};

export async function getPublicPoliBenchSnapshot(): Promise<PublicPoliBenchSnapshot | null> {
  try {
    const filePath = path.join(process.cwd(), "public/data/polibench-snapshot.json");
    const value: unknown = JSON.parse(await readFile(filePath, "utf8"));
    return isPublicPoliBenchSnapshot(value) ? value : null;
  } catch {
    return null;
  }
}
