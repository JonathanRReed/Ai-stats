import {expect,test} from 'bun:test';
import {existsSync,readFileSync} from 'node:fs';
const source=readFileSync('src/pages/compare.astro','utf8');
const explorer=readFileSync('src/components/compare/CompareExplorer.tsx','utf8');
const initialApi=readFileSync('src/pages/api/compare-initial.json.ts','utf8');
const route='src/pages/api/compare-benchmarks/[slug].json.ts';
test('Compare is a small chart-first Astro shell over focused explorer components',()=>{
  expect(source).toContain('<CompareExplorer');
  expect(source).toContain('client:load');
  expect(source.length).toBeLessThan(6000);
  expect(source).toContain('defaultExplorerSelection');
});
test('public comparison data stays server-backed and clients fetch only a selected benchmark',()=>{
  expect(source).toContain('getModelCatalogData');
  expect(readFileSync('src/lib/model-catalog-data.ts','utf8')).toContain('getModels(true,true)');
  expect(explorer).toContain("fetch('/api/compare-benchmarks/'");
  expect(explorer).not.toContain('fetchLiveSnapshot');
  expect(explorer).not.toContain('supabase.co');
  expect(explorer).not.toContain('fetch("https://artificialanalysis');
  expect(existsSync(route)).toBe(true);
  if(existsSync(route))expect(readFileSync(route,'utf8')).toContain('getStaticPaths');
});
test('legacy compare API remains compatible without fabricated prices or fuzzy scores',()=>{
  expect(initialApi).toContain('epochScoreReceipts');
  expect(initialApi).toContain('buildEpochScoreIndex');
  expect(initialApi).toContain('priceEvidence: "unavailable"');
  expect(initialApi).not.toContain('synthetic-estimate');
  expect(initialApi).not.toContain('tokens.every((token) => alias.includes(token))');
});
test('explorer exposes measurement limits, history and compatible frontier controls',()=>{
  expect(explorer).toContain('same AA index version and timing settings');
  expect(explorer).toContain("window.addEventListener('popstate'");
  expect(explorer).not.toContain('dangerouslySetInnerHTML');
});
