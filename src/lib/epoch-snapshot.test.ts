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
