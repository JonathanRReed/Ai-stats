import {expect,test} from 'bun:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import CompareExplorer from '../components/compare/CompareExplorer';
import {compactCatalog} from './compare-delivery';
import {availableCompareCharts,availableAaMetrics,buildComparePresets} from './compare-presets';
import type {ExplorerModel} from './compare-series';
test('compact delivery preserves the full picker and server-rendered default measurements',()=>{
 const rows:ExplorerModel[]=Array.from({length:100},(_,i)=>({id:'aa'+i,name:'Model '+i,family:'Model '+i,provider:'Provider '+i,source:'aa',sourceModelId:'aa'+i,current:true,intelligence:42,priceBlended:1,indexVersion:'4.3'}));
 const delivery={catalog:compactCatalog(rows),revision:'test',charts:availableCompareCharts(rows),aaMetrics:availableAaMetrics(rows),presets:buildComparePresets(rows)};
 const html=renderToStaticMarkup(createElement(CompareExplorer,{models:[rows[0]],benchmarks:[],defaultModelIds:['aa0'],delivery}));
 expect(html).toContain('All sources (100)');expect(html).toContain('1 selected');expect(html).toContain('42');
 expect(html).toContain('Show more');expect(html).toContain('Sources and calculations');
 expect(html).not.toContain('not a recommendation');
});
