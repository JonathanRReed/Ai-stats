import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {readFileSync} from 'node:fs';
import OpenRouterUsage from '../src/components/OpenRouterUsage';
const snapshot={schemaVersion:1,period:'day',estimated:false,filters:{},asOf:'2026-10-02T02:00:00Z',
 startDate:'2026-09-30',endDate:'2026-10-01',missingDays:['2026-09-30'],sourceUrl:'https://openrouter.ai/rankings',
 licenseUrl:'https://creativecommons.org/licenses/by/4.0/',rows:[{date:'2026-10-01',modelPermaslug:'lab/a',totalTokens:'9007199254740993'},
 {date:'2026-10-01',modelPermaslug:'other',totalTokens:'7'}]};
test('usage surface has real controls, exact static data, gaps and source attribution',()=>{
 const html=renderToStaticMarkup(createElement(OpenRouterUsage,{snapshot}));
 for(const text of ['OpenRouter traffic','7 days','30 days','90 days','Token volume','Share','Exact daily data','OpenRouter','CC BY 4.0','9007199254740993','No data','Provider tokenizers differ'])expect(html).toContain(text);
 expect(html).toContain('https://openrouter.ai/rankings');
 expect(html).toContain('2026-10-02T02:00:00Z');
 expect(html).toContain('tabindex="0"');
});
test('missing usage source is honest and has no fabricated chart',()=>{
 const html=renderToStaticMarkup(createElement(OpenRouterUsage,{snapshot:null}));
 expect(html).toContain('Usage history is not available yet');expect(html).not.toContain('<svg');
});
test('Stats hero is concise while methodology remains available',()=>{
 const source=readFileSync('src/components/LatestModelsStrip.astro','utf8');
 expect(source).toContain('<h1>Compare AI models</h1>');
 expect(source).toContain('Benchmarks, pricing and speed, with sources you can check.');
 expect(source).toContain('<summary>Selection and measurement details</summary>');
 expect(source).not.toContain('There is no combined score and no winner.');
});

test('usage chart keeps mobile label sizing tied to its measured viewport',()=>{
 const source=readFileSync('src/components/OpenRouterUsage.tsx','utf8');
 expect(source).toContain('ResizeObserver');
 expect(source.includes('viewBox="0 0 1000 362"')).toBe(false);
 const css=readFileSync('src/styles/openrouter-usage.css','utf8');
 expect(css).toContain('color:var(--signal-ink');
});
