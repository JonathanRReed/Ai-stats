import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';

test('homepage orders latest releases, leading models, benchmarks and usage before deeper workbenches',()=>{
 const page=readFileSync('src/components/Dashboard.astro','utf8');
 const overview=readFileSync('src/components/IntelligenceOverview.astro','utf8');
 const releases=overview.indexOf('<RecentModelReleases');
 const leaders=overview.indexOf('<LatestModelsStrip');
 const overviewPosition=page.indexOf('<IntelligenceOverview');
 const benchmarks=page.indexOf('id="stats-benchmarks"');
 const usage=page.indexOf('id="stats-usage"');
 const tasks=page.indexOf('id="stats-tasks"');
 expect(releases).toBeGreaterThan(-1);
 expect(leaders).toBeGreaterThan(releases);
 expect(overviewPosition).toBeGreaterThan(-1);
 expect(benchmarks).toBeGreaterThan(overviewPosition);
 expect(usage).toBeGreaterThan(benchmarks);
 expect(tasks).toBeGreaterThan(usage);
});

test('the cost and intelligence chart is secondary to updates and leaders',()=>{
 const overview=readFileSync('src/components/IntelligenceOverview.astro','utf8');
 expect(overview.indexOf('<RecentModelReleases')).toBeLessThan(overview.indexOf('<LatestModelsStrip'));
 expect(overview.indexOf('<LatestModelsStrip')).toBeLessThan(overview.indexOf('<details class="overview-chart-disclosure">'));
 expect(overview).toContain('<summary>Explore cost and Intelligence Index</summary>');
 expect(overview.indexOf('<details class="overview-chart-disclosure">')).toBeLessThan(overview.indexOf('<OverviewExplorer'));
});

test('coverage and operational source updates are in the Sources disclosure',()=>{
 const page=readFileSync('src/components/Dashboard.astro','utf8');
 const sourceStart=page.indexOf('<details class="stats-disclosure" id="stats-sources">');
 const status=page.indexOf('<OverviewDataStatus',sourceStart);
 const coverage=page.indexOf('<CatalogCoverage',sourceStart);
 expect(sourceStart).toBeGreaterThan(-1);
 expect(status).toBeGreaterThan(sourceStart);
 expect(status).toBeLessThan(coverage);
 expect(readFileSync('src/components/IntelligenceOverview.astro','utf8')).not.toContain('overview-data-status');
});

test('usage stays in the main page flow without the dropped introductory preface',()=>{
 const usage=readFileSync('src/components/OpenRouterUsage.tsx','utf8');
 expect(usage).toContain('aria-labelledby="usage-title"');
 expect(usage).toContain('<h2 id="usage-title">OpenRouter usage</h2>');
 expect(usage).not.toContain('Daily tokens across OpenRouter');
});
