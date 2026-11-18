import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';

test('homepage leads with the cost and intelligence chart, then releases, leaders, benchmarks, usage and deeper workbenches',()=>{
 const page=readFileSync('src/components/Dashboard.astro','utf8');
 const overview=readFileSync('src/components/IntelligenceOverview.astro','utf8');
 const chart=overview.indexOf('<OverviewExplorer');
 const releases=overview.indexOf('<RecentModelReleases');
 const leaders=overview.indexOf('<LatestModelsStrip');
 const overviewPosition=page.indexOf('<IntelligenceOverview');
 const benchmarks=page.indexOf('id="stats-benchmarks"');
 const usage=page.indexOf('id="stats-usage"');
 const tasks=page.indexOf('id="stats-tasks"');
 expect(chart).toBeGreaterThan(-1);
 expect(releases).toBeGreaterThan(chart);
 expect(leaders).toBeGreaterThan(releases);
 expect(overviewPosition).toBeGreaterThan(-1);
 expect(benchmarks).toBeGreaterThan(overviewPosition);
 expect(usage).toBeGreaterThan(benchmarks);
 expect(tasks).toBeGreaterThan(usage);
});

test('the cost and intelligence chart leads the overview, open and outside any disclosure',()=>{
 const overview=readFileSync('src/components/IntelligenceOverview.astro','utf8');
 const page=readFileSync('src/components/Dashboard.astro','utf8');
 expect(overview.indexOf('<OverviewExplorer')).toBeLessThan(overview.indexOf('<RecentModelReleases'));
 expect(overview.indexOf('<RecentModelReleases')).toBeLessThan(overview.indexOf('<LatestModelsStrip'));
 expect(overview).not.toContain('overview-chart-disclosure');
 expect(overview).not.toContain('<details');
 expect(overview).not.toContain('<summary>Explore cost and Intelligence Index</summary>');
 // Only the compact heading, the section nav and the returning-visitor strip sit above the overview.
 const heading=page.indexOf('class="stats-page-heading"');
 const overviewSection=page.indexOf('<section id="stats-overview"');
 expect(heading).toBeGreaterThan(-1);
 expect(overviewSection).toBeGreaterThan(heading);
 const aboveOverview=page.slice(heading,overviewSection);
 expect(aboveOverview).not.toContain('<section');
 expect(aboveOverview).not.toContain('<details');
 expect(aboveOverview).toContain('<LastVisitStrip');
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
