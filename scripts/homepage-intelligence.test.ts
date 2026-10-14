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
const overviewExplorerSource = readPendingSource("src/components/compare/OverviewExplorer.tsx");

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
  expect(latestModelsSource).toContain("ordered by AA Intelligence Index");
  expect(latestModelsSource).toContain("hasFiniteMetricValue(model.aa_coding_index)");
  expect(latestModelsSource).not.toContain("does not recommend a model");
  expect(latestModelsSource).not.toContain("pricing, and speed available");
  expect(latestModelsSource).toContain('compareRecordHref(model.id, "benchmark", false, "aa_intelligence_index")');
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
  expect(dashboardSource).toContain('fetch(`/api/models/${encodeURIComponent(id)}.json`, { signal: lifecycle.signal }');
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

test("the measurements overview uses an AA cost and Index explorer alongside source coverage", () => {
  expect(overviewSource).toContain("OverviewExplorer");
  expect(overviewExplorerSource).toContain('aria-label="AA Intelligence Index cost comparison"');
  expect(readFileSync("src/components/OverviewDataStatus.astro", "utf8")).toContain("Coverage");
  expect(dashboardSource).toContain("<OverviewDataStatus");
  expect(dashboardSource).toContain('href="/compare" class="eco-btn eco-btn-primary">Compare models</a>');
  expect(overviewExplorerSource).toContain("Show frontier only");
  expect(overviewExplorerSource).toContain("Exact chart data");
  expect(overviewExplorerSource).toContain("Unknown version");
  expect(overviewExplorerSource).toContain("Values and receipt dates are from this record's source payload.");
  expect(dashboardSource).toContain("polibench={publicPoliBenchSnapshot}");
  expect(readFileSync("src/components/OverviewDataStatus.astro", "utf8")).toContain('href="/about"');
  expect(readFileSync("src/components/OverviewDataStatus.astro", "utf8")).not.toContain('href="/methodology"');
});

test("the intelligence plot supports keyboard and touch inspection and the complete evidence table", () => {
  expect(overviewExplorerSource).toContain('aria-live="polite"');
  expect(readPendingSource("src/components/compare/ComparisonChart.tsx")).toContain("ArrowRight");
  expect(overviewExplorerSource).toContain('aria-label="Visible model families"');
  expect(overviewExplorerSource).toContain("Exact chart data");
  expect(overviewExplorerSource).toContain("onPin");
  expect(overviewExplorerSource).not.toContain(".slice(0, 12)");
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

test("benchmark eligibility is independent of pricing and includes the available Agentic Index",()=>{
 expect(dashboardSource).toContain('rankModelFamilies(currentMeasuredModels, key)');
 expect(dashboardSource).toContain('key: "aa_agentic_index"');
});

test("homepage variant values use each metric's native formatting",()=>{
 expect(dashboardSource).toContain("key.endsWith('_index')?formatIndex(variant[key]):formatScore(variant[key])");
});

test("homepage benchmark families filter measured reasoning variants before top-five and refresh identically",()=>{
 expect(dashboardSource).toContain('id="leaderboard-family-search"');
 expect(dashboardSource).toContain('id="leaderboard-family-mode"');
 expect(dashboardSource).toContain('data-leaderboard-reasoning');
 expect(dashboardSource).toContain('window.__leaderboardInitialModels = initialLeaderboardModels');
 expect(dashboardSource).toContain('rankModelFamilies(models, config.key, {...getLeaderboardFilters()})');
 expect(dashboardSource).toContain('renderLeaderboard((snapshot.aaModels??[]).filter(model=>model.current_source_member!==false)');
 expect(dashboardSource).not.toContain('FAILSAFE_METRIC_SWAP_MS');
 expect(dashboardSource).toContain('bindDashboardLifecycle(document, "#leaderboard-panels", initializeDashboard)');
 expect(dashboardSource).toContain('window.addEventListener("aistats:live-snapshot", async (event) =>');
});

test("empty filtered leaderboards disable Open compare and Epoch mode disables AA family controls on initial render and refresh",()=>{
 expect(dashboardSource).toContain('setLeaderboardCompareAction(leaderboardCompareLink,panel?.dataset.compareHref||null)');
 expect(dashboardSource).toContain('compareHref:list.length?`/compare?${params.toString()}`:""');
 expect(dashboardSource).toContain('disabled={defaultBenchmarkKey.startsWith(\'epoch_\')}');
 expect(dashboardSource).toContain('setLeaderboardFamilyControlsDisabled(document.getElementById("leaderboard-family-controls"),metricSelect.value.startsWith("epoch_"))');
 expect(dashboardSource).toContain('setLeaderboardFamilyControlsDisabled(document.getElementById("leaderboard-family-controls"),metric.startsWith("epoch_"))');
 expect(dashboardSource).toContain('const epochCatalog=visibleList.map(leaderboardRunCatalogRecord)');
 expect(dashboardSource).toContain('data-compare-href="${escapeHtml(compareHref)}"');
});

test("AA and Epoch leaderboards both use the progressive 5/20/50/all row windows",()=>{
 expect(dashboardSource).toContain('visibleLeaderboardRows(allList, leaderboardVisibleCounts.get(config.key) ?? 5)');
 expect(dashboardSource).toContain('const visibleList = visibleLeaderboardRows(allList, leaderboardVisibleCounts.get(config.key) ?? 5)');
 expect(dashboardSource).toContain('nextLeaderboardLimit(leaderboardVisibleCounts.get(key) ?? 5)');
 expect(dashboardSource).toContain('if (key.startsWith("aa_"))');
 expect(dashboardSource).toContain('renderAaLeaderboardPanels(latestLeaderboardModels)');
 expect(dashboardSource).toContain('epochRanking.ensureComplete(lifecycle.signal)');
 expect(dashboardSource).toContain('renderLeaderboard(latestLeaderboardModels, latestEpochBenchmarks, latestEpochRuns)');
 expect(readFileSync('src/lib/leaderboard-pagination.ts','utf8')).toContain('20');
 expect(readFileSync('src/lib/leaderboard-pagination.ts','utf8')).toContain('50');
 expect(readFileSync('src/lib/leaderboard-pagination.ts','utf8')).toContain('Number.POSITIVE_INFINITY');
 expect(dashboardSource).toContain('shown > 5 ? `<button type="button" class="underline underline-offset-2" data-leaderboard-less=');
 expect(dashboardSource).toContain('shown < total ? `<button type="button" class="underline underline-offset-2" data-leaderboard-more=');
});

test("model picker puts bounded query results first without losing selected exact records",()=>{
 const selector=readFileSync('src/components/compare/ModelSelector.tsx','utf8');
 expect(selector).toContain('const matches = hasQuery ? groups : more');
 expect(selector).toContain('compareFamilyPage(matches, page, 12)');
 expect(selector).toContain('aria-label="Search results"');
 expect(selector).toContain('onChange={() => onToggle(model.id)}');
 expect(selector).toContain('aria-label="Selected families"');
 expect(selector).toContain('setPage(0)');
 expect(selector).toContain('setPage(currentPage + 1)');
});
