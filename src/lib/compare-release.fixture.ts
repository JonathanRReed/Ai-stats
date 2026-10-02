import {compactCatalog} from './compare-delivery';
import {availableCompareCharts,availableAaMetrics,buildComparePresets} from './compare-presets';
const rows=['a','b'].map(id=>({id,name:id,family:id,source:'aa' as const,sourceModelId:id,current:true,intelligence:42,priceBlended:1,indexVersion:'4.3'}));
export const fixture=()=>({schemaVersion:'ai-stats-compare-release.v1',generatedAt:'2026-10-02T12:00:00.000Z',models:rows,defaultModelIds:['a','b'],benchmarks:[],
 sources:[{sourceKey:'artificial-analysis',fetchedAt:'2026-10-02T12:00:00.000Z',publishedAt:null,observedAt:null,contentHash:null,snapshotId:null,status:'healthy',available:true}],delivery:{revision:'a'.repeat(64),catalog:compactCatalog(rows),presets:buildComparePresets(rows),charts:availableCompareCharts(rows),aaMetrics:availableAaMetrics(rows)}});
