/// <reference types="bun" />

import { expect, test } from "bun:test";
import {
  getEpochBenchmarkAttribution,
  getEpochBenchmarksWithRuns,
  sortEpochBenchmarksByValue,
} from "./benchmark-catalog";
import type { EpochBenchmark, EpochBenchmarkRun } from "./supabase";

const benchmark = (
  slug: string,
  name: string,
): EpochBenchmark => ({
  id: slug,
  slug,
  name,
  description: null,
  source: null,
});

const run = (
  benchmarkSlug: string,
  score: number | null,
  overrides: Partial<EpochBenchmarkRun> = {},
): EpochBenchmarkRun => ({
  id: `${benchmarkSlug}:${String(score)}`,
  model_version: "model-v1",
  benchmark_id: benchmarkSlug,
  score,
  release_date: null,
  organization: null,
  country: null,
  stderr: null,
  score_metric: null,
  source_name: null,
  source_link: null,
  benchmark_name: undefined,
  benchmark_slug: benchmarkSlug,
  ...overrides,
});

test("sortEpochBenchmarksByValue keeps the curated free benchmarks ahead of uncatalogued slugs", () => {
  const sorted = sortEpochBenchmarksByValue([
    benchmark("zzz_custom", "Custom"),
    benchmark("simplebench_external", "SimpleBench"),
    benchmark("gpqa_diamond", "GPQA Diamond"),
    benchmark("aaa_custom", "Alpha Custom"),
  ]);

  expect(sorted.map((item) => item.slug)).toEqual([
    "gpqa_diamond",
    "simplebench_external",
    "aaa_custom",
    "zzz_custom",
  ]);
});

test("getEpochBenchmarksWithRuns drops unrated benchmarks and keeps scored ones in benchmark priority order", () => {
  const benchmarks = [
    benchmark("webdev_arena_external", "WebDev Arena"),
    benchmark("simplebench_external", "SimpleBench"),
    benchmark("archival_only", "Archival Only"),
  ];

  const scoredBenchmarks = getEpochBenchmarksWithRuns(benchmarks, [
    run("archival_only", null),
    run("webdev_arena_external", 0.71),
    run("simplebench_external", 0.83),
  ]);

  expect(scoredBenchmarks.map((item) => item.slug)).toEqual([
    "simplebench_external",
    "webdev_arena_external",
  ]);
});

test("getEpochBenchmarkAttribution uses benchmark-specific fallbacks before generic row metadata", () => {
  const terminalBenchmark = benchmark(
    "terminalbench_external",
    "TerminalBench",
  );
  const terminalAttribution = getEpochBenchmarkAttribution(terminalBenchmark, [
    run("terminalbench_external", 0.92, {
      source_name: "A newer source name",
      source_link: "https://example.invalid/terminal",
    }),
  ]);

  expect(terminalAttribution).toEqual({
    sourceName: "Terminal-Bench Leaderboard",
    sourceUrl: "https://www.tbench.ai/leaderboard/terminal-bench/2.0",
    viaName: "Epoch AI Benchmarking Hub",
    viaUrl: "https://epoch.ai/benchmarks",
    license: "Apache 2.0 subset via Epoch export",
  });

  const customBenchmark = benchmark("custom_benchmark", "Custom Benchmark");
  const customAttribution = getEpochBenchmarkAttribution(customBenchmark, [
    run("custom_benchmark", 0.5, {
      source_name: "External Lab",
      source_link: "https://example.invalid/custom",
    }),
  ]);

  expect(customAttribution).toEqual({
    sourceName: "External Lab",
    sourceUrl: "https://example.invalid/custom",
    viaName: "Epoch AI Benchmarking Hub",
    viaUrl: "https://epoch.ai/benchmarks",
    license: "CC BY, with Apache 2.0 for Aider Polyglot and Terminal-Bench subsets",
  });
});
