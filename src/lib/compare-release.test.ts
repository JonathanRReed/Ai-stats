import {expect,test} from 'bun:test';
import {readCompareRelease} from './compare-release';
import {fixture} from './compare-release.fixture';
import {compactCatalog} from './compare-delivery';
import {selectTokenPriceModels} from './compare-presets';
test('versioned release validates the complete searchable catalog and default chart',()=>{
 expect(readCompareRelease(fixture()).models).toHaveLength(2);
});
test('malformed compact metadata and absent default identities are rejected',()=>{
 const value=fixture();
 expect(()=>readCompareRelease({...value,schemaVersion:'unknown'})).toThrow();
 expect(()=>readCompareRelease({...value,defaultModelIds:['a','missing']})).toThrow();
 expect(()=>readCompareRelease({...value,delivery:{...value.delivery,catalog:{providers:['Lab'],rows:[['a']]}}})).toThrow();
 expect(()=>readCompareRelease({...value,models:[{...value.models[0],observedAt:42},value.models[1]]})).toThrow();
 expect(()=>readCompareRelease({...value,benchmarks:[{slug:'../secret',name:'Invalid'}]})).toThrow();
});
test('older releases remain readable without suggestions while v3 requires a complete selection map',()=>{
 const value=fixture();expect(readCompareRelease(value).delivery.suggestedModelIds?.['task-cost']).toEqual(['a','b']);
 const older={...value,schemaVersion:'ai-stats-compare-release.v2',delivery:{...value.delivery,suggestedModelIds:undefined}};
 expect(readCompareRelease(older).delivery.suggestedModelIds).toBeUndefined();
 expect(()=>readCompareRelease({...value,delivery:{...value.delivery,suggestedModelIds:undefined}})).toThrow(/require complete chart suggestion metadata/);
 expect(()=>readCompareRelease({...value,delivery:{...value.delivery,suggestedModelIds:{...value.delivery.suggestedModelIds,'speed-intelligence':undefined}}})).toThrow();
 expect(()=>readCompareRelease({...value,delivery:{...value.delivery,suggestedModelIds:{...value.delivery.suggestedModelIds,'cost-intelligence':['missing']}}})).toThrow();
 expect(()=>readCompareRelease({...value,models:[value.models[0]]})).toThrow(/Invalid release seed/);
});
test('generated token-price suggestions round-trip without a retired cheap model',()=>{
 const value=fixture();
 const current=[
  {...value.models[0],priceInput:1,priceOutput:2},
  {...value.models[1],priceInput:2,priceOutput:2},
  {...value.models[0],id:'retired',sourceModelId:'retired',current:false,priceInput:0,priceOutput:0},
 ];
 const priceIds=selectTokenPriceModels(current);
 const release={...value,delivery:{...value.delivery,catalog:compactCatalog(current),suggestedModelIds:{...value.delivery.suggestedModelIds,price:priceIds}}};
 expect(priceIds).toEqual(['a','b']);
 expect(readCompareRelease(release).delivery.suggestedModelIds?.price).toEqual(['a','b']);
});
