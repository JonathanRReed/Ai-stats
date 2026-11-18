import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {readDashboardSource,readDashboardSources} from '../src/lib/dashboard-source-files';
// Leaderboard data prep moved to src/lib/dashboard-leaderboard.ts and its markup to LeaderboardSection.astro.
const leaderboardData=readDashboardSource('leaderboardData');
const leaderboardSection=readDashboardSource('leaderboardSection');
const models=readFileSync('src/pages/models/index.astro','utf8');
test('every offered server benchmark has a rendered panel with finite scores',()=>{
 expect(leaderboardData).toContain('const availableBenchmarkConfigs = benchmarkConfigs.filter');
 expect(leaderboardSection).toContain('availableBenchmarkConfigs.map(({ key, label })');
 expect(leaderboardSection).toContain('availableBenchmarkConfigs.map(({ key, source })');
 expect(readDashboardSources()).not.toContain('benchmarkConfigs.filter(({ key }) => key === "aa_intelligence_index")');
 expect(leaderboardData).toContain('buildBenchmarkCohorts(benchmark,epochRuns)');
 expect(leaderboardData).toContain('const runs = allRuns.slice(0,5)');
 expect(leaderboardSection).toContain('selected={key === defaultBenchmarkKey}');
 expect(leaderboardSection).toContain('hidden={key !== defaultBenchmarkKey}');
});
test('provider disclosure reserves an inset chevron column and wraps metadata on mobile',()=>{
 expect(models).toContain('grid-template-columns: minmax(0, 1fr) auto 1rem');
 expect(models).toContain('grid-column: 3');
 expect(models).toContain('grid-row: 1 / 3');
 expect(models).toContain('overflow-wrap: anywhere');
 expect(models).toContain('padding: var(--space-3)');
});
test('expanded tables scroll inside the provider without widening the page',()=>{
 expect(models).toContain('.models-group { display: grid; grid-template-columns: minmax(0, 1fr); min-width: 0;');
 expect(models).toContain('.models-table-wrap { min-width: 0; max-width: 100%; overflow-x: auto; }');
});
