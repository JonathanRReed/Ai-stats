import {expect,test} from 'bun:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import CompareExplorer from '../components/compare/CompareExplorer';
import {compactCatalog} from './compare-delivery';
import {availableCompareCharts,availableAaMetrics,buildComparePresets} from './compare-presets';
import type {ExplorerModel} from './compare-series';
import {readFileSync} from 'node:fs';
test('compact delivery preserves the full picker and server-rendered default measurements',()=>{
 const rows:ExplorerModel[]=Array.from({length:100},(_,i)=>({id:'aa'+i,name:'Model '+i,family:'Model '+i,provider:'Provider '+i,source:'aa',sourceModelId:'aa'+i,current:true,intelligence:42,priceBlended:1,indexVersion:'4.3'}));
 const delivery={catalog:compactCatalog(rows),revision:'test',charts:availableCompareCharts(rows),aaMetrics:availableAaMetrics(rows),presets:buildComparePresets(rows)};
 const html=renderToStaticMarkup(createElement(CompareExplorer,{models:[rows[0]],benchmarks:[],defaultModelIds:['aa0'],delivery}));
 expect(html).toContain('Models · 1');expect(html).toContain('Model 0');expect(html).toContain('Provider 0');expect(html).toContain('Artificial Analysis');expect(html).toContain('42');
 expect(html).toContain('family-rail');expect(html).not.toContain('selected-model-chips');
 expect(html).toContain('Sources and calculations');expect(html).not.toContain('desktop-model-selector');
 expect(html).not.toContain('not a recommendation');
});

test('saved comparison URLs are applied after the same server and hydration default render',()=>{
 const source=readFileSync('src/components/compare/CompareExplorer.tsx','utf8');
 const initializer=source.slice(source.indexOf('const [state,setState]'),source.indexOf('const pendingBenchmarkChoice'));
 expect(initializer).toContain('parseCompareState(new URLSearchParams(),models,defaultModelIds,defaultChart)');
 expect(initializer).not.toContain('window.location');
 const mountEffect=source.slice(source.indexOf('const customSelection'),source.indexOf('const epochSlug'));
 expect(mountEffect).toContain('new URLSearchParams(window.location.search)');
 expect(mountEffect).toContain('window.addEventListener(\'popstate\',read)');
});
