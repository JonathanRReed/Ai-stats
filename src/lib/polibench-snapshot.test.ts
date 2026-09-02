/// <reference types="bun" />

import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getPublicPoliBenchSnapshot } from "./polibench-snapshot";

let cwdBefore = process.cwd();
let tempDir = "";
let snapshotPath = "";
let validSnapshotText = "";

beforeAll(async () => {
  cwdBefore = process.cwd();
  tempDir = await mkdtemp(join(tmpdir(), "ai-stats-polibench-snapshot-"));
  await mkdir(join(tempDir, "public/data"), { recursive: true });
  snapshotPath = join(tempDir, "public/data/polibench-snapshot.json");
  await writeFile(
    snapshotPath,
    JSON.stringify({
      schemaVersion: "1.0",
      source: {
        repository: "https://github.com/JonathanRReed/Poli-bench",
        commit: "f49763cdbca9387d823ba19578992434b5ac04b0",
        artifactPath: "src/data/liveBenchmark.generated.json",
      },
      freshness: {
        generatedAt: "2026-08-30T07:15:38.021Z",
        suite: "full",
        source: "live-convex-snapshot",
      },
      evidence: {
        kind: "live_operational_model_output",
        label: "Live operational model-output evidence",
        humanValidation: "not_collected",
        externalValidation: "not_externally_validated",
        paperRelease: "not_frozen",
        boundary: "Directional political axes are profiles, not higher-is-better quality scores.",
      },
      counts: { models: 1, rows: 1, runs: 1 },
      models: [
        {
          modelSlug: "provider/native-slug",
          provider: "provider",
          label: "Native Label",
          note: "live completed Convex full-suite run",
          releases: {
            release: "v1",
            benchmarkRelease: "v1",
            paperReleaseVersion: "polibench-paper-v2.0.0",
          },
          runId: "run-1",
          status: "completed",
          evidenceLevel: 2,
          evidenceLabel: "live completed Convex full-suite run",
          scoreStatus: "renderable",
          uncertaintySummary: "Model-output profiling only.",
          robustness: 80.7,
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
          axisScores: [{ axis: "economy", score: -13.3, answeredItems: 30 }],
          lastRunStartedAt: 1,
          lastRunFinishedAt: 2,
          artifactLinks: {
            canonicalResponses: "/api/runs/run-1",
            axisIntervals: "/api/runs/run-1",
            responseStyleControls: "/api/runs/run-1",
            exclusions: "/api/runs/run-1",
            duplicateResolution: "/api/runs/run-1",
            rawResponses: "/api/runs/run-1",
          },
        },
      ],
      runs: [{
        runId: "run-1",
        suite: "full",
        modelSlug: "provider/native-slug",
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
        releases: {
          release: "v1",
          benchmarkRelease: "v1",
          paperReleaseVersion: "polibench-paper-v2.0.0",
        },
      }],
    }),
    "utf8",
  );
  process.chdir(tempDir);
  validSnapshotText = await Bun.file(snapshotPath).text();
});

beforeEach(async () => {
  await writeFile(snapshotPath, validSnapshotText, 'utf8');
});

afterAll(async () => {
  process.chdir(cwdBefore);
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("getPublicPoliBenchSnapshot exposes live operational evidence without recasting political axes as quality", async () => {
  const snapshot = await getPublicPoliBenchSnapshot();

  expect(snapshot).not.toBeNull();
  expect(snapshot?.evidence).toMatchObject({
    kind: "live_operational_model_output",
    label: "Live operational model-output evidence",
    humanValidation: "not_collected",
    externalValidation: "not_externally_validated",
    paperRelease: "not_frozen",
  });
  expect(snapshot?.models[0]).toMatchObject({
    modelSlug: "provider/native-slug",
    provider: "provider",
    label: "Native Label",
    robustness: 80.7,
    axisScores: [{ axis: "economy", score: -13.3, answeredItems: 30 }],
    artifactLinks: { rawResponses: "/api/runs/run-1" },
  });
  expect(snapshot?.freshness.generatedAt).toBe("2026-08-30T07:15:38.021Z");
  expect(snapshot?.source.commit).toBe("f49763cdbca9387d823ba19578992434b5ac04b0");
});

test("getPublicPoliBenchSnapshot rejects malformed or unlinked public run receipts", async () => {
  const validSnapshot = JSON.parse(await Bun.file(snapshotPath).text()) as Record<string, unknown>;
  const invalidRuns = [
    [{ nope: true }],
    [
      validSnapshot.runs instanceof Array ? validSnapshot.runs[0] : {},
      validSnapshot.runs instanceof Array ? validSnapshot.runs[0] : {},
    ],
    [{
      ...(validSnapshot.runs instanceof Array ? validSnapshot.runs[0] : {}),
      modelSlug: "provider/other-model",
    }],
  ];

  for (const runs of invalidRuns) {
    await writeFile(
      snapshotPath,
      JSON.stringify({
        ...validSnapshot,
        counts: { models: 1, rows: 1, runs: runs.length },
        runs,
      }),
      "utf8",
    );
    expect(await getPublicPoliBenchSnapshot()).toBeNull();
  }

  await writeFile(
    snapshotPath,
    JSON.stringify({
      ...validSnapshot,
      models: [{
        ...(validSnapshot.models instanceof Array ? validSnapshot.models[0] : {}),
        artifactLinks: {
          canonicalResponses: "https://untrusted.example/run-1",
          axisIntervals: "/api/runs/run-1",
          responseStyleControls: "/api/runs/run-1",
          exclusions: "/api/runs/run-1",
          duplicateResolution: "/api/runs/run-1",
          rawResponses: "/api/runs/run-1",
        },
      }],
    }),
    "utf8",
  );
  expect(await getPublicPoliBenchSnapshot()).toBeNull();
});
