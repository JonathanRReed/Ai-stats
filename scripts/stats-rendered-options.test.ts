import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
const dashboard=readFileSync('src/components/Dashboard.astro','utf8');
const models=readFileSync('src/pages/models/index.astro','utf8');
test('every offered server benchmark has a rendered panel with finite scores',()=>{
 expect(dashboard).toContain('const availableBenchmarkConfigs = benchmarkConfigs.filter');
 expect(dashboard).toContain('availableBenchmarkConfigs.map(({ key, label })');
 expect(dashboard).toContain('availableBenchmarkConfigs.map(({ key, source })');
 expect(dashboard).not.toContain('benchmarkConfigs.filter(({ key }) => key === "aa_intelligence_index")');
 expect(dashboard).toContain('r.benchmark_slug === slug && hasFiniteMetricValue(r.score)');
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