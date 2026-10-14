import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';

test('homepage orders recent source updates, leading models, benchmarks and usage before deeper workbenches',()=>{
 const page=readFileSync('src/components/Dashboard.astro','utf8');
 const sourceUpdates=page.indexOf('<IntelligenceOverview');
 const leaders=page.indexOf('leaders={benchmarkSnapshotModels}',sourceUpdates);
 const benchmarks=page.indexOf('id="stats-benchmarks"');
 const usage=page.indexOf('id="stats-usage"');
 const tasks=page.indexOf('id="stats-tasks"');
 expect(sourceUpdates).toBeGreaterThan(-1);
 expect(leaders).toBeGreaterThan(sourceUpdates);
 expect(benchmarks).toBeGreaterThan(leaders);
 expect(usage).toBeGreaterThan(benchmarks);
 expect(tasks).toBeGreaterThan(usage);
});

test('the cost and intelligence chart is secondary to updates and leaders',()=>{
 const overview=readFileSync('src/components/IntelligenceOverview.astro','utf8');
 expect(overview.indexOf('class="overview-data-status"')).toBeLessThan(overview.indexOf('<LatestModelsStrip'));
 expect(overview.indexOf('<LatestModelsStrip')).toBeLessThan(overview.indexOf('<details class="overview-chart-disclosure">'));
 expect(overview).toContain('<summary>Explore cost and Intelligence Index</summary>');
 expect(overview.indexOf('<details class="overview-chart-disclosure">')).toBeLessThan(overview.indexOf('<OverviewExplorer'));
});

test('usage stays in the main page flow without the dropped introductory preface',()=>{
 const usage=readFileSync('src/components/OpenRouterUsage.tsx','utf8');
 expect(usage).toContain('aria-labelledby="usage-title"');
 expect(usage).toContain('<h2 id="usage-title">OpenRouter usage</h2>');
 expect(usage).not.toContain('Daily tokens across OpenRouter');
});
