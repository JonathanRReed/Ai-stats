import { expect, test } from "bun:test";
import {
  atomFeed, changeWindow, evaluationEntries, firstRecordedEntries, formatScorePair, groupByDay, modelEntries, refreshEntries, revisionEntries,
  type ChangeEntry, type ModelChangeInput,
} from "./change-log";

const window = { start: "2026-10-01", end: "2026-10-31" };
const sources = { "epoch-ai": { name: "Epoch AI", url: "https://epoch.ai/benchmarks" } };
const model = (id: string, releaseDate: string | null, firstSeen: string | null): ModelChangeInput => ({
  id, name: `Model ${id}`, provider: "Lab", path: `/models/${id}`, releaseDate, firstSeen, sourceUrl: null,
});

test("the window covers whole UTC days ending today", () => {
  expect(changeWindow(new Date("2026-11-18T13:00:00Z"), 90)).toEqual({ start: "2026-08-21", end: "2026-11-18" });
});

test("a model appears once: on its release date, else on its first observation", () => {
  const entries = modelEntries([
    model("released", "2026-10-05", "2026-10-07T21:00:00Z"),
    model("old-added", "2025-01-01", "2026-10-09T21:00:00Z"),
    model("undated-added", null, "2026-10-10T21:00:00Z"),
    model("baseline", "2025-01-01", "2026-10-02T09:00:00Z"),
    model("outside", "2026-09-01", "2026-09-02T00:00:00Z"),
    // Released before the window but observed inside it only because the window begins later than release: still listed once.
    model("late", "2026-09-30", "2026-10-03T00:00:00Z"),
  ], window, "2026-10-02");
  expect(entries.map((entry) => [entry.id, entry.date])).toEqual([
    ["model-release:released", "2026-10-05"],
    ["model-added:old-added", "2026-10-09"],
    ["model-added:undated-added", "2026-10-10"],
    ["model-added:late", "2026-10-03"],
  ]);
  expect(entries[0].summary).toContain("First observed by AI Stats Oct 7, 2026");
  expect(entries[2].summary).toContain("Release date not recorded");
  expect(entries[0].href).toBe("/models/released");
});

test("a model without an AI Stats page is listed unlinked and says why", () => {
  const [entry] = modelEntries([{ ...model("x", "2026-10-05", null), path: null }], window, null);
  expect(entry.href).toBeNull();
  expect(entry.summary).toContain("No AI Stats model page");
});

test("score pairs keep the source unit and show just enough digits to differ", () => {
  expect(formatScorePair(0.5, 0.55, "fraction")).toEqual(["50%", "55%"]);
  expect(formatScorePair(0.286, 0.285714285714286, "fraction")).toEqual(["28.6%", "28.57%"]);
  expect(formatScorePair(66.3, 66.4, "native")).toEqual(["66.3", "66.4"]);
  expect(formatScorePair(61.1, 61.9, "percent")).toEqual(["61.1%", "61.9%"]);
});

test("revisions are grouped per benchmark per day and keep both values and dates", () => {
  const revision = (model: string, before: number, after: number, afterFetchedAt: string) => ({
    source: "epoch-ai", benchmarkSlug: "gpqa_diamond", benchmarkName: "GPQA Diamond", model, unit: "fraction", metric: "Score", version: null,
    conditions: null, before, after, beforeFetchedAt: "2026-10-01T10:00:00Z", afterFetchedAt,
  });
  const entries = revisionEntries([
    revision("B", 0.4, 0.42, "2026-10-02T10:00:00Z"), revision("A", 0.5, 0.55, "2026-10-02T16:00:00Z"),
    revision("C", 0.1, 0.2, "2026-09-01T00:00:00Z"),
  ], window, sources);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ date: "2026-10-02", timestamp: "2026-10-02T16:00:00.000Z", href: "/benchmarks/gpqa-diamond", source: "Epoch AI" });
  expect(entries[0].items).toEqual([
    { label: "A (Score)", before: "50%", after: "55%", beforeDate: "2026-10-01T10:00:00Z", afterDate: "2026-10-02T16:00:00Z" },
    { label: "B (Score)", before: "40%", after: "42%", beforeDate: "2026-10-01T10:00:00Z", afterDate: "2026-10-02T10:00:00Z" },
  ]);
});

test("first-recorded groups name the models and the comparison base", () => {
  const entries = firstRecordedEntries([{ source: "epoch-ai", benchmarkSlug: "hle", benchmarkName: "HLE", fetchedAt: "2026-10-04T01:00:00Z",
    previousFetchedAt: "2026-10-03T01:00:00Z", count: 2, models: ["A", "B"] }], window, sources);
  expect(entries[0].summary).toBe("2 models with a first result on this benchmark in the Epoch AI snapshot retrieved Oct 4, 2026 and in no earlier snapshot read for this log: A, B.");
});

test("evaluation entries need a recorded evaluation date inside the window", () => {
  const run = (id: string, evaluationDate: string | null) => ({ id, benchmarkSlug: "hle", benchmarkName: "HLE", model: "A", evaluationDate, source: sources["epoch-ai"] });
  expect(evaluationEntries([run("in", "2026-10-03"), run("none", null), run("old", "2025-10-03")], window).map((entry) => entry.id)).toEqual(["result-evaluated:in"]);
});

test("retrievals collapse to one entry per day with a count per source", () => {
  const entries = refreshEntries([
    { source: "epoch-ai", fetchedAt: "2026-10-02T01:00:00Z" }, { source: "epoch-ai", fetchedAt: "2026-10-02T07:00:00Z" },
    { source: "epoch-ai", fetchedAt: "2026-10-02T07:00:00Z" }, { source: "livebench", fetchedAt: "2026-10-02T03:00:00Z" },
  ], window, sources);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ title: "2 sources retrieved", summary: "Epoch AI ×2, livebench.", timestamp: "2026-10-02T07:00:00.000Z" });
});

const entry = (id: string, date: string, kind: ChangeEntry["kind"], title: string): ChangeEntry => ({
  id, date, timestamp: `${date}T00:00:00.000Z`, kind, title, href: null, source: "S", sourceUrl: null, summary: "s",
});

test("days are newest first; within a day models come before results and retrievals", () => {
  const days = groupByDay([
    entry("1", "2026-10-02", "source-refresh", "z"), entry("2", "2026-10-03", "results-recorded", "b"),
    entry("3", "2026-10-02", "model-release", "y"), entry("4", "2026-10-02", "model-release", "a"), entry("5", "2026-10-02", "score-revised", "c"),
  ]);
  expect(days.map((group) => [group.date, group.entries.map((item) => item.id)])).toEqual([
    ["2026-10-03", ["2"]],
    ["2026-10-02", ["4", "3", "5", "1"]],
  ]);
  expect(groupByDay([])).toEqual([]);
});

test("the Atom feed escapes text, uses absolute links, and leaves out retrieval receipts", () => {
  const feed = atomFeed([
    { ...entry("model-release:a&b", "2026-10-03", "model-release", "A <b> & \"c\""), href: "/models/a" },
    entry("source-refresh:2026-10-03", "2026-10-03", "source-refresh", "2 sources retrieved"),
  ], { origin: "https://aistats.example.com", pagePath: "/changes", feedPath: "/changes.xml", updated: "2026-10-03T00:00:00.000Z" });
  expect(feed).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
  expect(feed).toContain("<title>Model released: A &lt;b&gt; &amp; &quot;c&quot;</title>");
  expect(feed).toContain('href="https://aistats.example.com/models/a"');
  expect(feed).toContain("<id>tag:aistats.example.com,2026:changes/model-release%3Aa%26b</id>");
  expect(feed).not.toContain("sources retrieved");
  expect(feed.match(/<entry>/g)).toHaveLength(1);
});
