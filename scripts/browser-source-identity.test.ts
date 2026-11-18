import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {readDashboardSources} from '../src/lib/dashboard-source-files';
// The live-refresh code moved from Dashboard.astro into the dashboard client module.
const source=readFileSync('src/components/dashboard/client/dashboard-client.ts','utf8');
const allDashboardSource=readDashboardSources();
test('browser refresh cannot add guessed provider details to native AA records',()=>{
 const expression=source.match(/const liveModels = (.*);/)?.[1];expect(expression).toBeDefined();
 const rows=[{id:'a',name:'Same (High)',price_1m_input_tokens:1,price_1m_output_tokens:2}];
 const output=runInNewContext(expression!,{snapshot:{aaModels:rows},getValidModels:(models:unknown[])=>models,
 enrichWithPublicCatalog:(models:object[])=>models.map(model=>({...model,openrouter_id:'guessed/base'}))});
 expect(output).toEqual(rows);
 expect(allDashboardSource).not.toContain('normalizePublicCatalogKey');
});
test('browser refresh does not invent an average across different Epoch benchmarks',()=>{
 expect(allDashboardSource).not.toContain('getEpochAverageForModel');
 expect(allDashboardSource).not.toContain('topEpochAverage');
});
