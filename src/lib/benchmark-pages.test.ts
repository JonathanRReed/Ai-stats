import { expect, test } from "bun:test";
import {
  assembleBenchmarkPage,
  assertUniqueBenchmarkPaths,
  bestRunPerModel,
  bestScoreSteps,
  buildCohorts,
  cohortScale,
  conditionLabel,
  displayScale,
  formatStderr,
  linearTicks,
  makeRun,
  timeTicks,
  type BenchmarkRun,
} from "./benchmark-pages";
import { aaPageRuns, epochBenchmarkFacts, epochBenchmarkName, epochPageRuns } from "./benchmark-pages-data";
import type { EpochBenchmark, EpochBenchmarkRun } from "./supabase";
import type { ExplorerModel } from "./compare-series";

const run = (id: string, model: string, value: number, extra: Partial<BenchmarkRun> = {}): BenchmarkRun =>
  makeRun({
    id, modelKey: model, modelName: model, lab: null, modelPath: null, value, stderr: null, unit: "percent",
    metric: "Accuracy", version: null, conditions: null, releaseDate: null, evaluationDate: null, sourceName: null, sourceUrl: null,
    ...extra,
  });

test("the leaderboard keeps one best run per model and counts the others", () => {
  const rows = bestRunPerModel([run("a1", "A", 50), run("a2", "A", 70), run("b1", "B", 60)], true);
  expect(rows.map((row) => [row.id, row.runsForModel])).toEqual([["a2", 2], ["b1", 1]]);
});

test("lower-is-better benchmarks keep the lowest run and order ascending", () => {
  const rows = bestRunPerModel([run("a1", "A", 50), run("a2", "A", 20), run("b1", "B", 30)], false);
  expect(rows.map((row) => row.id)).toEqual(["a2", "b1"]);
});

test("a tied score prefers the run with a recorded, smaller standard error", () => {
  const rows = bestRunPerModel([run("a1", "A", 50), run("a2", "A", 50, { stderr: 3 }), run("a3", "A", 50, { stderr: 2 })], true);
  expect(rows[0].id).toBe("a3");
});

test("different versions or metrics never share one ordering", () => {
  const cohorts = buildCohorts([
    run("v1", "A", 80, { version: "1.0" }),
    run("v2", "A", 40, { version: "2.0" }),
    run("v2b", "B", 45, { version: "2.0" }),
    run("m", "C", 3, { metric: "Elo", unit: "native" }),
  ], () => true);
  expect(cohorts).toHaveLength(3);
  expect(cohorts[0].version).toBe("2.0");
  expect(cohorts[0].leaderboard.map((row) => row.id)).toEqual(["v2b", "v2"]);
  for (const cohort of cohorts) expect(new Set(cohort.runs.map((row) => `${row.metric}|${row.unit}|${row.version}`)).size).toBe(1);
});

test("runs under different conditions stay labelled and are counted", () => {
  const [cohort] = buildCohorts([
    run("a", "A", 80, { conditions: { Agent: "Codex CLI" } }),
    run("b", "A", 70, { conditions: { Agent: "Terminus" } }),
    run("c", "B", 60, { conditions: null }),
  ], () => true);
  expect(cohort.conditionCount).toBe(3);
  expect(cohort.leaderboard[0].conditionLabel).toBe("Agent: Codex CLI");
  expect(cohort.leaderboard[1].conditionLabel).toBe("Not recorded");
  expect(conditionLabel({})).toBe("None recorded");
});

test("standard error coverage is reported, never assumed", () => {
  const none = buildCohorts([run("a", "A", 1), run("b", "B", 2)], () => true)[0];
  const some = buildCohorts([run("a", "A", 1, { stderr: 0.5 }), run("b", "B", 2)], () => true)[0];
  const all = buildCohorts([run("a", "A", 1, { stderr: 0.5 })], () => true)[0];
  expect([none.stderrCoverage, some.stderrCoverage, all.stderrCoverage]).toEqual(["none", "some", "all"]);
  expect(none.leaderboard.every((row) => row.stderr === null)).toBe(true);
  expect(formatStderr(2.25, "percent")).toBe("± 2.3 pp");
});

test("the step line only records new bests, dated by release then evaluation date", () => {
  const steps = bestScoreSteps([
    run("a", "A", 40, { releaseDate: "2024-01-01" }),
    run("b", "B", 30, { releaseDate: "2024-03-01" }),
    run("c", "C", 55, { evaluationDate: "2024-06-01" }),
    run("d", "D", 50, { releaseDate: "2024-09-01" }),
    run("e", "E", 70, { releaseDate: "2025-01-01" }),
    run("f", "F", 65, { releaseDate: "2025-02-01" }),
    run("u", "U", 99),
  ], true);
  expect(steps.records.map((point) => point.runId)).toEqual(["a", "c", "e"]);
  expect(steps.records[1].basis).toBe("evaluation");
  expect([steps.releaseDated, steps.evaluationDated, steps.undated]).toEqual([5, 1, 1]);
  expect(steps.drawable).toBe(true);
});

test("too few dated runs do not draw a step line", () => {
  const steps = bestScoreSteps([run("a", "A", 40, { releaseDate: "2024-01-01" }), run("b", "B", 50, { releaseDate: "2024-02-01" })], true);
  expect(steps.drawable).toBe(false);
  expect(bestScoreSteps([run("a", "A", 40), run("b", "B", 50)], true).undated).toBe(2);
});

test("fractions display as percent and percent bars run from zero to one hundred", () => {
  expect(displayScale(0.42, "fraction")).toEqual({ value: 42, unit: "percent" });
  expect(displayScale(1500, "native")).toEqual({ value: 1500, unit: "native" });
  expect(cohortScale([run("a", "A", 42)])).toEqual({ min: 0, max: 100 });
  expect(cohortScale([run("a", "A", 1500, { unit: "native" })])).toEqual({ min: 0, max: 1500 });
});

test("pages link to Compare with the metric id Compare parses", () => {
  const base = { name: "X", attribution: { sourceName: "S", sourceUrl: "https://example.com" }, description: null, facts: [], runs: [run("a", "A", 1)], higherIsBetter: () => true, fetchedAt: null };
  expect(assembleBenchmarkPage({ ...base, slug: "gpqa_diamond", source: "epoch-ai" })).toMatchObject({
    path: "/benchmarks/gpqa-diamond", compareHref: "/compare?chart=benchmark&metric=epoch_gpqa_diamond", runCount: 1, modelCount: 1,
  });
  expect(assembleBenchmarkPage({ ...base, slug: "aa_intelligence_index", source: "artificial-analysis" }).compareHref)
    .toBe("/compare?chart=benchmark&metric=aa_intelligence_index");
});

test("two inputs on one path fail loudly", () => {
  expect(() => assertUniqueBenchmarkPaths([{ slug: "a_b", path: "/benchmarks/a-b" }, { slug: "a-b", path: "/benchmarks/a-b" }])).toThrow();
});

const benchmark: EpochBenchmark = {
  id: "rli_external", slug: "rli_external", name: "Rli", description: null, source: "epoch.ai",
  metadata: { benchmark: "Remote Labor Index", score_column: "Score", random_baseline: "0.25", scale: "1.0", superseded_by: null },
};
const epochRun = (id: string, score: number | null, extra: Partial<EpochBenchmarkRun> = {}): EpochBenchmarkRun => ({
  id, model_version: "m-" + id, benchmark_id: "rli_external", benchmark_slug: "rli_external", score, release_date: "2025-01-01",
  organization: "Lab", country: null, stderr: null, score_unit: "fraction", score_metric: "Score", ...extra,
});

test("Epoch runs keep their scale, name and missing standard error", () => {
  const runs = epochPageRuns(benchmark, [epochRun("a", 0.5, { stderr: 0.02 }), epochRun("b", 0.4), epochRun("c", null)], { "m-a": "Model A" }, {});
  expect(runs).toHaveLength(2);
  expect(runs[0]).toMatchObject({ modelName: "Model A", value: 50, stderr: 2, unit: "percent" });
  expect(runs[1].stderr).toBeNull();
  expect(runs[1].modelName).toBe("m b");
});

test("benchmark facts come only from recorded metadata", () => {
  expect(epochBenchmarkFacts(benchmark)).toEqual([
    { label: "Name in the source file", value: "Remote Labor Index" },
    { label: "Score column", value: "Score" },
    { label: "Random baseline, as recorded", value: "0.25" },
  ]);
  expect(epochBenchmarkName(benchmark)).toBe("Remote Labor Index");
  expect(epochBenchmarkName({ ...benchmark, slug: "gpqa_diamond" })).toBe("GPQA Diamond");
});

test("AA pages use current rows only and keep index versions apart", () => {
  const model = (id: string, intelligence: number | null, current: boolean | null, indexVersion = "5"): ExplorerModel =>
    ({ id, name: id, family: id, source: "aa", sourceModelId: id, current, intelligence, indexVersion, sourceUrl: "https://artificialanalysis.ai/models/" + id });
  const runs = aaPageRuns("aa_intelligence_index", [model("a", 50, true), model("b", 40, false), model("c", null, true), model("d", 30, null, "4")], { a: "2025-05-01" }, new Map([["a", { path: "/models/a", provider: "Lab A" }]]));
  expect(runs.map((row) => row.id)).toEqual(["a", "d"]);
  expect(runs[0]).toMatchObject({ unit: "points", version: "Index v5", modelPath: "/models/a", lab: "Lab A", releaseDate: "2025-05-01", stderr: null });
  expect(buildCohorts(runs, () => true)).toHaveLength(2);
});

test("date ticks fall on calendar boundaries and stay within the requested count", () => {
  const ticks = timeTicks(Date.UTC(2023, 2, 14), Date.UTC(2026, 9, 26), 4);
  expect(ticks.map((tick) => tick.label)).toEqual(["2024", "2025", "2026"]);
  expect(timeTicks(Date.UTC(2025, 0, 10), Date.UTC(2025, 11, 1), 12)[0].label).toBe("Feb");
  expect(linearTicks(0, 100)).toEqual([0, 20, 40, 60, 80, 100]);
});
