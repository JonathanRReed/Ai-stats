import { expect, test } from "bun:test";
import { diffHistory, runKey, sameScore, type HistoryRun, type HistoryVersion } from "./change-log-diff";

const run = (model: string, score: number | null, extra: Partial<HistoryRun> = {}): HistoryRun => ({
  benchmarkSlug: "gpqa_diamond", benchmarkName: "GPQA Diamond", model, score, unit: "fraction", version: null, metric: "Score", conditions: null, ...extra,
});
const version = (fetchedAt: string, runs: HistoryRun[]): HistoryVersion => ({ source: "epoch-ai", fetchedAt, runs });

test("a changed score is reported with both values and both retrieval dates", () => {
  const diff = diffHistory([
    version("2026-10-01T00:00:00Z", [run("Model A", 0.5), run("Model B", 0.4)]),
    version("2026-10-02T00:00:00Z", [run("Model A", 0.55), run("Model B", 0.4)]),
  ]);
  expect(diff.revisions).toEqual([expect.objectContaining({
    model: "Model A", before: 0.5, after: 0.55, beforeFetchedAt: "2026-10-01T00:00:00Z", afterFetchedAt: "2026-10-02T00:00:00Z",
  })]);
  expect(diff.firstRecorded).toEqual([]);
  expect(diff.baseline).toBe("2026-10-01T00:00:00Z");
});

test("the baseline version reports nothing as new", () => {
  const diff = diffHistory([version("2026-10-01T00:00:00Z", [run("Model A", 0.5)])]);
  expect(diff.revisions).toEqual([]);
  expect(diff.firstRecorded).toEqual([]);
  expect(diff.versions).toBe(1);
});

test("new results are grouped per benchmark and never re-reported after a gap", () => {
  const other = { benchmarkSlug: "hle", benchmarkName: "HLE" };
  const diff = diffHistory([
    version("2026-10-01T00:00:00Z", [run("Model A", 0.5)]),
    version("2026-10-02T00:00:00Z", [run("Model A", 0.5), run("Model B", 0.3), run("Model C", 0.2), run("Model B", 0.1, other)]),
    version("2026-10-03T00:00:00Z", [run("Model A", 0.5)]),
    version("2026-10-04T00:00:00Z", [run("Model A", 0.5), run("Model B", 0.3)]),
  ]);
  expect(diff.firstRecorded.map((group) => [group.benchmarkSlug, group.count, group.models, group.fetchedAt, group.previousFetchedAt])).toEqual([
    ["gpqa_diamond", 2, ["Model B", "Model C"], "2026-10-02T00:00:00Z", "2026-10-01T00:00:00Z"],
    ["hle", 1, ["Model B"], "2026-10-02T00:00:00Z", "2026-10-01T00:00:00Z"],
  ]);
});

test("a field the export starts carrying later does not make old results new", () => {
  const diff = diffHistory([
    version("2026-10-01T00:00:00Z", [run("Model A", 0.5, { unit: null, conditions: null })]),
    version("2026-10-02T00:00:00Z", [run("Model A", 0.5, { unit: "fraction", conditions: { shots: "5" } }), run("Model A", 0.4, { benchmarkSlug: "hle", benchmarkName: "HLE" })]),
  ]);
  expect(diff.firstRecorded.map((group) => [group.benchmarkSlug, group.count])).toEqual([["hle", 1]]);
});

test("a re-keyed row with the same measurement identity is not new", () => {
  // Source row ids are not part of the identity, so an export that only renames ids changes nothing.
  const diff = diffHistory([
    version("2026-10-01T00:00:00Z", [run("Model A", 0.5)]),
    version("2026-10-02T00:00:00Z", [run("Model A", 0.5)]),
  ]);
  expect(diff.firstRecorded).toEqual([]);
  expect(diff.revisions).toEqual([]);
});

test("a change of unit, version, metric or conditions is a different measurement, not a revision", () => {
  const diff = diffHistory([
    version("2026-10-01T00:00:00Z", [run("Model A", 1, { unit: "percent" }), run("Model B", 0.5, { conditions: { effort: "high" } })]),
    version("2026-10-02T00:00:00Z", [run("Model A", 0.01, { unit: "fraction" }), run("Model B", 0.6, { conditions: { effort: "low" } })]),
  ]);
  expect(diff.revisions).toEqual([]);
  // The same model on the same benchmark is not a new result either.
  expect(diff.firstRecorded).toEqual([]);
});

test("ambiguous identities and missing scores are never reported as revisions", () => {
  const diff = diffHistory([
    version("2026-10-01T00:00:00Z", [run("Twin", 0.5), run("Twin", 0.6), run("Gone", null)]),
    version("2026-10-02T00:00:00Z", [run("Twin", 0.7), run("Gone", 0.4)]),
  ]);
  expect(diff.revisions).toEqual([]);
});

test("copies with the same retrieval time are one retrieval, and order follows retrieval time", () => {
  const diff = diffHistory([
    version("2026-10-02T00:00:00Z", [run("Model A", 0.6)]),
    version("2026-10-01T00:00:00Z", [run("Model A", 0.5)]),
    version("2026-10-01T00:00:00Z", [run("Model A", 0.5)]),
    version("not a date", [run("Model A", 0.9)]),
  ]);
  expect(diff.versions).toBe(2);
  expect(diff.refreshes.map((item) => item.fetchedAt)).toEqual(["2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z"]);
  expect(diff.revisions[0]).toMatchObject({ before: 0.5, after: 0.6 });
});

test("score equality ignores only floating-point noise and condition key order", () => {
  expect(sameScore(0.1 + 0.2, 0.3)).toBe(true);
  expect(sameScore(0.286, 0.285714285714286)).toBe(false);
  expect(runKey(run("A", 1, { conditions: { a: 1, b: 2 } }))).toBe(runKey(run("A", 2, { conditions: { b: 2, a: 1 } })));
});
