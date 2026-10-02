import {expect,test} from 'bun:test';
import {readCompareRelease} from './compare-release';
import {compactCatalog} from './compare-delivery';
import {availableCompareCharts,availableAaMetrics,buildComparePresets} from './compare-presets';
const rows=['a','b'].map(id=>({id,name:id,family:id,source:'aa' as const,sourceModelId:id,current:true,intelligence:42,priceBlended:1,indexVersion:'4.3'}));
export const fixture=()=>({schemaVersion:'ai-stats-compare-release.v1',generatedAt:'2026-10-02T12:00:00.000Z',models:rows,defaultModelIds:['a','b'],benchmarks:[],
 sources:[],delivery:{revision:'a'.repeat(64),catalog:compactCatalog(rows),presets:buildComparePresets(rows),charts:availableCompareCharts(rows),aaMetrics:availableAaMetrics(rows)}});
test('versioned release validates the complete searchable catalog and default chart',()=>{
 expect(readCompareRelease(fixture()).models).toHaveLength(2);
});
test('malformed compact metadata and absent default identities are rejected',()=>{
 const value=fixture();
 expect(()=>readCompareRelease({...value,schemaVersion:'unknown'})).toThrow();
 expect(()=>readCompareRelease({...value,defaultModelIds:['a','missing']})).toThrow();
 expect(()=>readCompareRelease({...value,delivery:{...value.delivery,catalog:{providers:['Lab'],rows:[['a']]}}})).toThrow();
 expect(()=>readCompareRelease({...value,models:[{...rows[0],observedAt:42},rows[1]]})).toThrow();
 expect(()=>readCompareRelease({...value,benchmarks:[{slug:'../secret',name:'Invalid'}]})).toThrow();
});
