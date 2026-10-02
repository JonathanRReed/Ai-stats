/// <reference types="bun" />

import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getPublicEpochSnapshot } from "./epoch-snapshot";

let cwdBefore = process.cwd();
let tempDir = "";

beforeAll(async () => {
  cwdBefore = process.cwd();
  tempDir = await mkdtemp(join(tmpdir(), "ai-stats-epoch-snapshot-"));
  await mkdir(join(tempDir, "public/data"), { recursive: true });

  const snapshot = {
    fetched_at: "2025-05-12T15:30:00.000Z",
    benchmarks: [
      {
        id: "bench-1",
        slug: "simplebench_external",
        name: "SimpleBench",
        source: "Epoch AI",
      },
    ],
    models: [
      {
        id: "model-1",
        model_version: "openrouter/gpt-4o",
        display_name: "GPT-4o",
        eci_score: 97.5,
      },
    ],
    runs: [
      {
        id: "run-1",
        conditions: { "Edit format": "diff", "Token budget": 0 },
        evaluation_date: "2026-09-15",
        score_unit: "percent",
        model_version: "openrouter/gpt-4o",
        benchmark_slug: "simplebench_external",
        score: 0.81,
        source_name: "SimpleBench",
        source_link: "https://simple-bench.com",
      },
    ],
  };

  await writeFile(
    join(tempDir, "public/data/epoch-benchmark-snapshot.json"),
    JSON.stringify(snapshot),
    "utf8",
  );
  process.chdir(tempDir);
});

afterAll(async () => {
  process.chdir(cwdBefore);
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("getPublicEpochSnapshot normalizes benchmark and run identifiers from the public snapshot file", async () => {
  const snapshot = await getPublicEpochSnapshot();

  expect(snapshot).not.toBeNull();
  expect(snapshot?.epochBenchmarks).toEqual([
    {
      id: "bench-1",
      slug: "simplebench_external",
      name: "SimpleBench",
      description: null,
      source: "Epoch AI",
    },
  ]);
  expect(snapshot?.epochRuns[0]).toMatchObject({
    benchmark_id: "bench-1",
    benchmark_slug: "simplebench_external",
    benchmark_name: "SimpleBench",
    score: 0.81,
    source_name: "SimpleBench",
    source_link: "https://simple-bench.com",
  });
  expect(snapshot?.epochModels[0]).toMatchObject({
    model_version: "openrouter/gpt-4o",
    display_name: "GPT-4o",
  });
});

test("public Epoch normalization preserves conditions without inferring them", async () => {
  const snapshot = await getPublicEpochSnapshot();
  expect(snapshot?.epochRuns[0]).toMatchObject({
    conditions: { "Edit format": "diff", "Token budget": 0 },
    evaluation_date: "2026-09-15",
    score_unit: "percent",
  });
});

test("validated cached input is normalized without reading an older local artifact", async () => {
  const snapshot = await getPublicEpochSnapshot({
    fetched_at: "2026-10-02T00:00:00Z",
    models: [{ model_version: "cached-model" }],
    benchmarks: [{ slug: "aider", name: "Aider" }],
    runs: [{ id: "cached-run", model_version: "cached-model", benchmark_slug: "aider",
      score: 8, score_metric: "Percent correct", score_unit: "percent",
      conditions: { "Edit format": "diff" }, evaluation_date: null }],
  });
  expect(snapshot?.fetchedAt).toBe("2026-10-02T00:00:00Z");
  expect(snapshot?.epochRuns[0]).toMatchObject({ id: "cached-run", score: 8,
    conditions: { "Edit format": "diff" }, benchmark_slug: "aider" });
});
