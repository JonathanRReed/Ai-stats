/// <reference types="bun" />

import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import {
  loadPoliBenchArtifact,
  transformPoliBenchSnapshot,
} from "./sync-polibench-data.mjs";

type SourceModel = {
  modelSlug: string;
  label: string;
  provider: string;
  note: string;
  release: string;
  benchmarkRelease: string;
  paperReleaseVersion: string;
};

const sourceModels: SourceModel[] = Array.from({ length: 103 }, (_, index) => ({
  modelSlug: index === 0 ? "provider/unchanged-native-slug" : `provider/model-${index}`,
  label: index === 0 ? "Native Label" : `Model ${index}`,
  provider: "provider",
  note: "live completed Convex full-suite run",
  release: "v1",
  benchmarkRelease: "v1",
  paperReleaseVersion: "polibench-paper-v2.0.0",
}));

const sourceRows = sourceModels.map((model, index) => ({
  modelSlug: model.modelSlug,
  suite: "full",
  runId: `run-${index}`,
  status: "completed",
  robustness: 80.7,
  evidenceLevel: 2,
  evidenceLabel: "live completed Convex full-suite run",
  scoreStatus: "renderable",
  suppressionReasons: [],
  uncertaintySummary: "Model-output profiling only.",
  completionRate: 100,
  completedResponses: 270,
  parseValidResponses: 270,
  parseValidity: 100,
  paraphraseStability: 90.6,
  rerunStability: 0,
  contradictionConsistency: 61.1,
  resolutionRate: 78.1,
  costPerCompletedResponse: 0.000559,
  p95LatencyMs: 6834,
  axisScores: [
    { axis: "economy", score: -13.3, answeredItems: 30 },
    { axis: "liberty", score: -16.6, answeredItems: 30 },
  ],
  eligible: true,
  lastRunStartedAt: 1,
  lastRunFinishedAt: 2,
  artifactLinks: {
    canonicalResponses: `/api/runs/run-${index}`,
    axisIntervals: `/api/runs/run-${index}`,
    responseStyleControls: `/api/runs/run-${index}`,
    exclusions: `/api/runs/run-${index}`,
    duplicateResolution: `/api/runs/run-${index}`,
    rawResponses: `/api/runs/run-${index}`,
  },
  label: model.label,
  provider: model.provider,
}));

const validSourceArtifact = {
  generatedAt: "2026-08-30T07:15:38.021Z",
  source: "live-convex-snapshot",
  suite: "full",
  models: sourceModels,
  rows: sourceRows,
  runs: Array.from({ length: 110 }, (_, index) => ({
    runId: `run-${index}`,
    suite: "full",
    modelSlug: sourceModels[index % sourceModels.length]?.modelSlug,
    status: "completed",
    startedAt: 1,
    finishedAt: 2,
    expectedResponses: 270,
    completedResponses: 270,
    parseValidResponses: 270,
    completionRate: 100,
    parseValidity: 100,
    rerunStability: 0,
    robustness: 80.7,
    costPerCompletedResponse: 0.000559,
    p95LatencyMs: 6834,
    release: "v1",
    benchmarkRelease: "v1",
    paperReleaseVersion: "polibench-paper-v2.0.0",
  })),
};

let tempDir = "";

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "ai-stats-polibench-source-"));
});

afterAll(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("transformPoliBenchSnapshot preserves 103 source-native model identities and 110 run receipts", () => {
  const snapshot = transformPoliBenchSnapshot(validSourceArtifact);

  expect(snapshot.counts).toEqual({ models: 103, rows: 103, runs: 110 });
  expect(snapshot.models[0]).toMatchObject({
    modelSlug: "provider/unchanged-native-slug",
    provider: "provider",
    label: "Native Label",
  });
  expect(snapshot.runs).toHaveLength(110);
  expect(snapshot.models[0]?.artifactLinks).toEqual({
    canonicalResponses: "/api/runs/run-0",
    axisIntervals: "/api/runs/run-0",
    responseStyleControls: "/api/runs/run-0",
    exclusions: "/api/runs/run-0",
    duplicateResolution: "/api/runs/run-0",
    rawResponses: "/api/runs/run-0",
  });
});

test("transformPoliBenchSnapshot keeps quality metrics and political profile axes as distinct evidence", () => {
  const snapshot = transformPoliBenchSnapshot(validSourceArtifact);
  const model = snapshot.models[0];

  expect(model).toMatchObject({
    robustness: 80.7,
    completionRate: 100,
    parseValidity: 100,
    paraphraseStability: 90.6,
    rerunStability: 0,
    contradictionConsistency: 61.1,
    resolutionRate: 78.1,
    costPerCompletedResponse: 0.000559,
    p95LatencyMs: 6834,
  });
  expect(model.axisScores).toEqual([
    { axis: "economy", score: -13.3, answeredItems: 30 },
    { axis: "liberty", score: -16.6, answeredItems: 30 },
  ]);
  expect(snapshot.evidence).toMatchObject({
    kind: "live_operational_model_output",
    humanValidation: "not_collected",
    externalValidation: "not_externally_validated",
    paperRelease: "not_frozen",
  });
});

test("transformPoliBenchSnapshot retains release and freshness provenance", () => {
  const snapshot = transformPoliBenchSnapshot(validSourceArtifact);

  expect(snapshot.freshness).toEqual({
    generatedAt: "2026-08-30T07:15:38.021Z",
    suite: "full",
    source: "live-convex-snapshot",
  });
  expect(snapshot.models[0]?.releases).toEqual({
    release: "v1",
    benchmarkRelease: "v1",
    paperReleaseVersion: "polibench-paper-v2.0.0",
  });
});

test("transformPoliBenchSnapshot records the checked-out source revision, never a moving branch", () => {
  const commit = '1234567890abcdef1234567890abcdef12345678';
  expect(transformPoliBenchSnapshot(validSourceArtifact, { commit }).source.commit).toBe(commit);
  expect(() => transformPoliBenchSnapshot(validSourceArtifact, { commit: 'main' })).toThrow('full Git SHA');
});

test("transformPoliBenchSnapshot preserves nullable run telemetry", () => {
  const snapshot = transformPoliBenchSnapshot({
    ...validSourceArtifact,
    runs: validSourceArtifact.runs.map((run, index) =>
      index === 0
        ? {
            ...run,
            status: "running",
            finishedAt: null,
            costPerCompletedResponse: null,
            p95LatencyMs: null,
          }
        : run,
    ),
  });

  expect(snapshot.runs[0]).toMatchObject({
    status: "running",
    finishedAt: null,
    costPerCompletedResponse: null,
    p95LatencyMs: null,
  });
});

test("transformPoliBenchSnapshot rejects a model row whose run receipt is absent", () => {
  expect(() =>
    transformPoliBenchSnapshot({
      ...validSourceArtifact,
      rows: [{ ...sourceRows[0], runId: "missing-run-id" }, ...sourceRows.slice(1)],
    }),
  ).toThrow("rows[0].runId must resolve to a run receipt");
});

const rejectionMessage = async (operation: () => Promise<unknown>): Promise<string> => {
  try {
    await operation();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected operation to reject");
};

test("loadPoliBenchArtifact reads only explicit files and HTTPS URLs, and rejects malformed payloads", async () => {
  const sourcePath = join(tempDir, "source.json");
  await writeFile(sourcePath, JSON.stringify(validSourceArtifact), "utf8");

  expect(await loadPoliBenchArtifact({ kind: "file", path: sourcePath })).toEqual(
    validSourceArtifact,
  );
  expect(await rejectionMessage(() => loadPoliBenchArtifact({ kind: "database" }))).toContain(
    "Unsupported PoliBench source",
  );
  expect(await rejectionMessage(() =>
    loadPoliBenchArtifact({ kind: "url", url: pathToFileURL(sourcePath).href }),
  )).toContain("HTTPS");
  expect(await rejectionMessage(() =>
    loadPoliBenchArtifact({ kind: "url", url: "http://127.0.0.1:1/source.json" }),
  )).toContain("HTTPS");
  expect(() => transformPoliBenchSnapshot({
    ...validSourceArtifact,
    rows: [{ ...sourceRows[0], modelSlug: "" }, ...sourceRows.slice(1)],
  })).toThrow("rows[0].modelSlug must be a non-empty string");
});
