import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
const dashboard=readFileSync('src/components/Dashboard.astro','utf8');
const models=readFileSync('src/pages/models/index.astro','utf8');
test('every offered server benchmark has a rendered panel with finite scores',()=>{
 expect(dashboard).toContain('const availableBenchmarkConfigs = benchmarkConfigs.filter');
 expect(dashboard).toContain('availableBenchmarkConfigs.map(({ key, label })');
 expect(dashboard).toContain('availableBenchmarkConfigs.map(({ key, source })');
 expect(dashboard).not.toContain('benchmarkConfigs.filter(({ key }) => key === "aa_intelligence_index")');
 expect(dashboard).toContain('buildBenchmarkCohorts(benchmark,epochRuns)');
 expect(dashboard).toContain('cohort.runs.slice(0,5)');
 expect(dashboard).toContain('selected={key === defaultBenchmarkKey}');
 expect(dashboard).toContain('hidden={key !== defaultBenchmarkKey}');
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
