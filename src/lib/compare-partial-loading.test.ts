import {expect,test} from 'bun:test';
import {createMeasurementLoader,compactCatalog,expandCatalog,measurementBucket} from './compare-delivery';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import CompareExplorer from '../components/compare/CompareExplorer';
import {availableCompareCharts,availableAaMetrics,buildComparePresets} from './compare-presets';
const rows=['a','b'].map(id=>({id,name:id,family:id,source:'aa' as const,sourceModelId:id,current:true,intelligence:42,priceBlended:1,indexVersion:'4.3'}));
const catalog=expandCatalog(compactCatalog(rows));
test('one failed measurement bucket preserves the other successful selection',async()=>{
 const loader=createMeasurementLoader('r',catalog,async url=>{
 const bucket=url.split('/').at(-1)!.replace('.json','');
 return bucket===measurementBucket('b')?new Response('',{status:503}):Response.json({schemaVersion:1,revision:'r',bucket,records:rows.filter(row=>measurementBucket(row.id)===bucket)});
 });
 const result=await loader.loadPartial(['a','b']);
 expect(result.records.map(row=>row.id)).toEqual(['a']);expect(result.failedIds).toEqual(['b']);
});
test('exports wait for every selected measurement to resolve',()=>{
 const delivery={catalog:compactCatalog(rows),revision:'r',charts:availableCompareCharts(rows),aaMetrics:availableAaMetrics(rows),presets:buildComparePresets(rows)};
 const html=renderToStaticMarkup(createElement(CompareExplorer,{models:[rows[0]],delivery,benchmarks:[],defaultModelIds:['a','b']}));
 expect(html).toMatch(/disabled=""[^>]*>CSV with sources/);
 expect(html).toMatch(/disabled=""[^>]*>PNG chart/);
});
