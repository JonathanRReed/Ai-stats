import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('src/components/Dashboard.astro','utf8');
test('browser refresh cannot add guessed provider details to native AA records',()=>{
 const expression=source.match(/const liveModels = (.*);/)?.[1];expect(expression).toBeDefined();
 const rows=[{id:'a',name:'Same (High)',price_1m_input_tokens:1,price_1m_output_tokens:2}];
 const output=runInNewContext(expression!,{snapshot:{aaModels:rows},getValidModels:(models:unknown[])=>models,
 enrichWithPublicCatalog:(models:object[])=>models.map(model=>({...model,openrouter_id:'guessed/base'}))});
 expect(output).toEqual(rows);
 expect(source).not.toContain('normalizePublicCatalogKey');
});
test('browser refresh does not invent an average across different Epoch benchmarks',()=>{
 expect(source).not.toContain('getEpochAverageForModel');
 expect(source).not.toContain('topEpochAverage');
});
