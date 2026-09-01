/// <reference types="bun" />

import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const dashboardSource = readFileSync("src/components/Dashboard.astro", "utf8");
const readPendingSource = (path: string): string =>
  existsSync(path) ? readFileSync(path, "utf8") : "";
const workbenchSource = readPendingSource("src/components/TaskWorkbench.astro");
const sourceHealthSource = readPendingSource("src/components/SourceHealthStrip.astro");
const overviewSource = readPendingSource("src/components/IntelligenceOverview.astro");

test("the homepage renders the task-first sequence before deeper comparison content", () => {
  const workbenchIndex = dashboardSource.indexOf("<TaskWorkbench");
  const sourceHealthIndex = dashboardSource.indexOf("<SourceHealthStrip");
  const overviewIndex = dashboardSource.indexOf("<IntelligenceOverview");

  expect(workbenchIndex).toBeGreaterThan(-1);
  expect(sourceHealthIndex).toBeGreaterThan(workbenchIndex);
  expect(overviewIndex).toBeGreaterThan(sourceHealthIndex);
  expect(dashboardSource.indexOf('aria-label="Public catalog collections"')).toBeGreaterThan(overviewIndex);
});

test("the task workbench keeps transparent controls, shortlist columns, and reset affordances in source", () => {
  expect(workbenchSource).toContain('aria-label="Task workbench"');
  expect(workbenchSource).toContain('id="task-preset"');
  expect(workbenchSource).toContain('id="task-budget"');
  expect(workbenchSource).toContain('aria-live="polite"');
  expect(workbenchSource).toContain('aria-busy="false"');
  expect(workbenchSource).toContain("Task query");
  expect(workbenchSource).toContain("Budget ceiling");
  expect(workbenchSource).toContain("Reset constraints");
  expect(workbenchSource).toContain("No shortlist matches this filter yet.");
  expect(workbenchSource).toContain("Why it fits");
  expect(workbenchSource).toContain("Coverage");
  expect(workbenchSource).toContain("Weights in use");
  expect(workbenchSource).toContain("rankComparableModels");
  expect(workbenchSource).toContain('type="application/json"');
  expect(workbenchSource).toContain('id="workbench-data"');
  expect(workbenchSource).toContain("JSON.parse");
  expect(workbenchSource).not.toContain("window.__AI_STATS_WORKBENCH__");
  expect(workbenchSource).toContain("Updating shortlist");
  expect(workbenchSource).toContain("Missing evidence");
});

test("the server-rendered workbench exposes a useful empty state without client JavaScript", () => {
  expect(workbenchSource).toContain('data-shortlist-state={initialCandidates.length ? "ready" : "empty"}');
  expect(workbenchSource).toContain('hidden={initialCandidates.length === 0}');
  expect(workbenchSource).toContain('hidden={initialCandidates.length > 0}');
  expect(workbenchSource).toContain("Shortlist data unavailable in this build.");
  expect(workbenchSource).toContain("Artificial Analysis observations are missing.");
});

test("the source health strip exposes source receipts and fallback state labels", () => {
  expect(sourceHealthSource).toContain('aria-label="Source health"');
  expect(sourceHealthSource).toContain("Last observed");
  expect(sourceHealthSource).toContain("Coverage");
  expect(sourceHealthSource).toContain("Status");
  expect(sourceHealthSource).toContain("Fallback mode");
  expect(sourceHealthSource).toContain("Artificial Analysis");
  expect(sourceHealthSource).toContain("Epoch AI");
  expect(sourceHealthSource).toContain("SimpleBench");
  expect(sourceHealthSource).toContain("PoliBench");
  expect(sourceHealthSource).toContain("data-source-status");
});

test("the intelligence overview keeps the quality-price plot, coverage bars, and recent change log", () => {
  expect(overviewSource).toContain('aria-label="Intelligence overview"');
  expect(overviewSource).toContain("Quality vs. price");
  expect(overviewSource).toContain("Benchmark coverage");
  expect(overviewSource).toContain("Recent source changes");
  expect(overviewSource).toContain("View all model comparisons");
  expect(overviewSource).toContain("Top pick");
  expect(overviewSource).toContain("Other models");
  expect(overviewSource).toContain('role="img"');
  expect(overviewSource).toContain('aria-label="Quality and price data table"');
  expect(overviewSource).toContain("<progress");
  expect(overviewSource).toContain("Artificial Analysis Intelligence Index");
  expect(overviewSource).toContain("USD per 1M tokens");
  expect(overviewSource).toContain("PoliBench coverage is source-native");
  expect(overviewSource).toContain('href="/about"');
  expect(overviewSource).not.toContain('href="/methodology"');
});

test("the homepage components preserve non-color state labels and reduced-motion behavior", () => {
  expect(workbenchSource).toContain('data-shortlist-state={initialCandidates.length ? "ready" : "empty"}');
  expect(workbenchSource).toContain('root.dataset.shortlistState = isEmpty ? "empty" : ranked.length < 3 ? "partial" : "ready"');
  expect(workbenchSource).toContain('data-shortlist-state="empty"');
  expect(sourceHealthSource).toContain("status-label");
  expect(workbenchSource + sourceHealthSource + overviewSource).toContain(
    "prefers-reduced-motion: reduce",
  );
});

test("compact shortlist cards reserve their own row for the candidate label", () => {
  expect(workbenchSource).toContain(".candidate-cell::before {");
  expect(workbenchSource).toContain("grid-column: 1 / -1;");
  expect(workbenchSource).not.toContain(
    ".candidate-cell::before { position: absolute; }",
  );
});
