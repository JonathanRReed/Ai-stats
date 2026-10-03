/// <reference types="bun" />

import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const dashboardSource = readFileSync("src/components/Dashboard.astro", "utf8");
const readPendingSource = (path: string): string =>
  existsSync(path) ? readFileSync(path, "utf8") : "";
const workbenchSource = readPendingSource("src/components/TaskWorkbench.astro");
const latestModelsSource = readPendingSource("src/components/LatestModelsStrip.astro");
const sourceHealthSource = readPendingSource("src/components/SourceHealthStrip.astro");
const overviewSource = readPendingSource("src/components/IntelligenceOverview.astro");

test("Stats has a clear Overview, Benchmarks, Usage order before optional details", () => {
  const overview = dashboardSource.indexOf('id="stats-overview"');
  const benchmarks = dashboardSource.indexOf('id="stats-benchmarks"');
  const usage = dashboardSource.indexOf('id="stats-usage"');
  const sources = dashboardSource.indexOf('id="stats-sources"');
  expect(overview).toBeGreaterThan(-1);
  expect(benchmarks).toBeGreaterThan(overview);
  expect(usage).toBeGreaterThan(benchmarks);
  expect(sources).toBeGreaterThan(usage);
  expect(dashboardSource).toContain('aria-label="Stats sections"');
  for (const id of ['stats-sources','stats-profiles','stats-models']) {
    expect(dashboardSource).toMatch(new RegExp('<details[^>]*id="' + id + '"[^>]*>'));
    expect(dashboardSource).not.toMatch(new RegExp('<details[^>]*id="' + id + '"[^>]*\\\\bopen\\\\b'));
  }
  expect(dashboardSource.indexOf('<SourceHealthStrip')).toBeGreaterThan(sources);
});

test("the model snapshot explains its evidence filter and links into comparison", () => {
  expect(latestModelsSource).toContain('aria-label="Current benchmark snapshot"');
  expect(dashboardSource).toContain("<h1>AI model stats</h1>");
  expect(latestModelsSource).not.toContain("<h1");
  expect(latestModelsSource).toContain("Leading models");
  expect(latestModelsSource).toContain("One recent model per provider");
  expect(latestModelsSource).toContain("ordered by AA Index");
  expect(latestModelsSource).toContain("number of available measurements");
  expect(latestModelsSource).toContain("does not recommend a model");
  expect(latestModelsSource).toContain('href={compareRecordHref(model.id)}');
  expect(latestModelsSource).not.toContain("latest-model-order");
  expect(latestModelsSource).not.toContain("overflow-x-auto");
});

test("the homepage is prerendered and the model drawer API is cacheable", () => {
  const indexSource = readFileSync("src/pages/index.astro", "utf8");
  const apiSource = readFileSync("src/pages/api/models.json.ts", "utf8");

  expect(indexSource).toContain("export const prerender = true");
  expect(apiSource).toContain("toModelDrawerPayload");
  expect(apiSource).toContain("s-maxage=900");
  expect(apiSource).not.toContain("no-store");
});

test("the first-screen overview uses the same curated measured-model cohort", () => {
  expect(dashboardSource).toContain("models={currentMeasuredModels}");
  expect(dashboardSource).toContain("const validModels = currentMeasuredModels.filter");
  expect(dashboardSource).not.toContain("<IntelligenceOverview\n        models={models}");
});

test("large public catalogs and drawer details load only when the user reaches them", () => {
  expect(dashboardSource).toContain("setupPublicCatalogHydration");
  expect(dashboardSource).toContain('rootMargin: "400px 0px"');
  expect(dashboardSource).toContain("catalogObserver.observe");
  expect(dashboardSource).toContain('fetch(`/api/models/${encodeURIComponent(id)}.json`');
  expect(dashboardSource).not.toContain(
    'fetch(`/api/models/${encodeURIComponent(id)}.json`, {',
  );
  expect(dashboardSource).toContain("registerDrawerModels(model ? [model] : [])");
  expect(dashboardSource).not.toContain('fetch("/api/models.json", { cache: "force-cache" })');
});

test("below-fold analytical sections defer rendering work and mobile spacing stays compact", () => {
  expect(dashboardSource).toContain("content-visibility: auto");
  expect(dashboardSource).toContain("contain-intrinsic-size: auto 720px");
  expect(dashboardSource).toContain("gap: 2.75rem");
  expect(dashboardSource).not.toContain("gap: 5rem");
});

test("the task comparison keeps transparent controls, measurement columns, and reset affordances in source", () => {
  expect(workbenchSource).toContain('aria-label="Compare models by task"');
  expect(workbenchSource).toContain('id="task-preset"');
  expect(workbenchSource).toContain('id="task-budget"');
  expect(workbenchSource).toContain('aria-live="polite"');
  expect(workbenchSource).toContain('aria-busy="false"');
  expect(workbenchSource).toContain("Compare by");
  expect(workbenchSource).toContain("Task");
  expect(workbenchSource).toContain("Budget ceiling");
  expect(workbenchSource).toContain("Reset constraints");
  expect(workbenchSource).toContain("No models have enough comparable measurements for these filters.");
  expect(workbenchSource).toContain("Why this row is shown");
  expect(workbenchSource).toContain("Coverage");
  expect(workbenchSource).toContain("How this order is calculated");
  expect(workbenchSource).toContain("does not recommend a model");
  expect(workbenchSource).not.toContain("Top comparable result");
  expect(workbenchSource).not.toContain("Why it fits");
  expect(workbenchSource).toContain("rankComparableModels");
  expect(workbenchSource).toContain('type="application/json"');
  expect(workbenchSource).toContain('id="workbench-data"');
  expect(workbenchSource).toContain("JSON.parse");
  expect(workbenchSource).not.toContain("window.__AI_STATS_WORKBENCH__");
  expect(workbenchSource).toContain("Updating comparison");
  expect(workbenchSource).toContain("Missing measurements");
});

test("the server-rendered evidence lens exposes a useful empty state without client JavaScript", () => {
  expect(workbenchSource).toContain('data-shortlist-state={initialCandidates.length ? "ready" : "empty"}');
  expect(workbenchSource).toContain('hidden={initialCandidates.length === 0}');
  expect(workbenchSource).toContain('hidden={initialCandidates.length > 0}');
  expect(workbenchSource).toContain("Model measurements are unavailable in this build.");
  expect(workbenchSource).toContain("Artificial Analysis observations are missing.");
});

test("the source health strip exposes source dates and data mode labels", () => {
  expect(sourceHealthSource).toContain('aria-label="Source health"');
  expect(sourceHealthSource).toContain("Last observed");
  expect(sourceHealthSource).toContain("Coverage");
  expect(sourceHealthSource).toContain("Status");
  expect(sourceHealthSource).toContain("Retrieved");
  expect(sourceHealthSource).toContain("Published");
  expect(sourceHealthSource).toContain("PUBLIC_SNAPSHOT_NAMES");
  expect(sourceHealthSource).toContain("openrouter-usage");
  expect(sourceHealthSource).toContain("receipt.sameSnapshot");
  expect(sourceHealthSource).toContain("Data sources");
  expect(sourceHealthSource).toContain("Artificial Analysis");
  expect(sourceHealthSource).toContain("Epoch AI");
  expect(sourceHealthSource).toContain("SimpleBench");
  expect(sourceHealthSource).toContain("PoliBench");
  expect(sourceHealthSource).toContain("data-source-status");
});

test("the measurements overview keeps the AA-price plot, coverage bars, and recent change log", () => {
  expect(overviewSource).toContain('aria-label="Compare the measurements"');
  expect(overviewSource).toContain("AA Index vs. price");
  expect(overviewSource).toContain("Benchmark coverage");
  expect(overviewSource).toContain("Recent source updates");
  expect(dashboardSource).toContain('href="/compare" class="eco-btn eco-btn-primary">Compare models</a>');
  expect(overviewSource).toContain("Not dominated on price and AA Index");
  expect(overviewSource).toContain("Other models");
  expect(overviewSource).not.toContain("Top pick");
  expect(overviewSource).not.toContain("Coding preset leader");
  expect(overviewSource).toContain('role="group"');
  expect(overviewSource).toContain('aria-label="Quality and price data table"');
  expect(overviewSource).toContain("<progress");
  expect(overviewSource).toContain("Artificial Analysis Intelligence Index");
  expect(overviewSource).toContain("USD per 1M tokens");
  expect(overviewSource).toContain("PublicPoliBenchSnapshot");
  expect(overviewSource).toContain('href="/about"');
  expect(overviewSource).not.toContain('href="/methodology"');
});

test("the intelligence plot supports inspection, filtering, and the complete evidence table", () => {
  expect(overviewSource).toContain('id="plot-provider"');
  expect(overviewSource).toContain('id="plot-search"');
  expect(overviewSource).toContain('id="plot-frontier-only"');
  expect(overviewSource).toContain('aria-live="polite"');
  expect(overviewSource).toContain('data-plot-point');
  expect(overviewSource).toContain('role="button"');
  expect(overviewSource).toContain("ArrowRight");
  expect(overviewSource).toContain('aria-label="Chart legend"');
  expect(overviewSource).toContain("Complete quality and price data");
  expect(overviewSource).not.toContain(".slice(0, 12)");
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
  // The column name is a real element, not generated content, so assistive
  // technology reads it at every width.
  expect(workbenchSource).toContain('<span class="cell-label">Model</span>');
  expect(workbenchSource).toContain(".candidate-cell .cell-label {");
  expect(workbenchSource).toContain("grid-column: 1 / -1;");
  expect(workbenchSource).not.toContain(
    ".candidate-cell .cell-label { position: absolute; }",
  );
});

test("the shortlist head is exposed to assistive technology", () => {
  expect(workbenchSource).toContain('<div class="shortlist-head">');
  expect(workbenchSource).not.toContain('class="shortlist-head" aria-hidden');
});

test("compact model styles do not leave a media block open",()=>{
 const style=latestModelsSource.split('<style>')[1].split('</style>')[0];
 let depth=0;
 for(const char of style){if(char==='{')depth++;if(char==='}')depth--;expect(depth).toBeGreaterThanOrEqual(0);}
 expect(depth).toBe(0);
});
