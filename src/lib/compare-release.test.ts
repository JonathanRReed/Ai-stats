import {expect,test} from 'bun:test';
import {readCompareRelease} from './compare-release';
import {fixture} from './compare-release.fixture';
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
test('suggestion maps are optional for older releases and validate measured current identities',()=>{
 const value=fixture();expect(readCompareRelease(value).delivery.suggestedModelIds).toBeUndefined();
 expect(readCompareRelease({...value,delivery:{...value.delivery,suggestedModelIds:{'cost-intelligence':['a']}}}).delivery.suggestedModelIds?.['cost-intelligence']).toEqual(['a']);
 expect(()=>readCompareRelease({...value,delivery:{...value.delivery,suggestedModelIds:{'cost-intelligence':['missing']}}})).toThrow();
});
