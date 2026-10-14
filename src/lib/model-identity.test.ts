import {expect,test} from 'bun:test';
import * as identity from './model-identity';
import {parseCompareState} from './compare-state';
test('exact links retain UUID and free-route identity',()=>{
 expect(identity.compareRecordHref('uuid')).toBe('/compare?m=uuid');
 expect(identity.compareRecordHref('openrouter:lab/model:free','price')).toBe('/compare?m=openrouter%3Alab%2Fmodel%3Afree&chart=price');
});
test('homepage leader links request the AA Intelligence measure explicitly',()=>{
 const url=identity.compareRecordHref('e994a6e0-d36b-4dab-8ae1-c1b469e4d9e2','benchmark',false,'aa_intelligence_index');
 const state=parseCompareState(new URL(url,'https://example.test').searchParams,[{id:'e994a6e0-d36b-4dab-8ae1-c1b469e4d9e2',source:'aa',sourceModelId:'e994a6e0-d36b-4dab-8ae1-c1b469e4d9e2',name:'Muse Wonder Full (Max)',current:true}]);
 expect(state).toMatchObject({chart:'benchmark',metricId:'aa_intelligence_index',modelIds:['e994a6e0-d36b-4dab-8ae1-c1b469e4d9e2']});
});
test('source-qualified links cannot select another source with the same name',()=>{
 const rows=[{id:'uuid',source:'aa',sourceModelId:'uuid',slug:'model-high',name:'Same',current:true},
 {id:'epoch:model-high',source:'epoch',sourceModelId:'model-high',name:'Same',current:true}];
 const link=identity.sourceRecordHref('artificial-analysis','model-high');
 expect(parseCompareState(new URL(link,'https://example.test').searchParams,rows).modelIds).toEqual(['uuid']);
 expect(parseCompareState(new URLSearchParams('source=epoch-ai&record=model-high'),rows).modelIds).toEqual(['epoch:model-high']);
});
test('AA source slug resolves current UUID without reviving historical records',()=>{
 const rows=[{id:'old',source:'aa',slug:'a',sourceModelId:'old',current:false},{id:'new',source:'aa',slug:'a',sourceModelId:'new',current:true}];
 expect(parseCompareState(new URLSearchParams('source=artificial-analysis&record=a'),rows).modelIds).toEqual(['new']);
 expect(parseCompareState(new URLSearchParams('source=artificial-analysis&record=a&history=1'),rows).modelIds).toEqual([]);
 expect(parseCompareState(new URLSearchParams('source=artificial-analysis&record=a&history=1'),rows).missingModelIds).toEqual(['artificial-analysis:a']);
});
test('unknown source reference never falls back to a similar name',()=>{
 const state=parseCompareState(new URLSearchParams('source=unknown&record=a'),[{id:'a',name:'a'}]);
 expect(state.modelIds).toEqual([]);expect(state.missingModelIds).toEqual(['unknown:a']);
});

test('measured page links select the exact UUID even when source display names collide',async()=>{
 const {buildPassportRoutes}=await import('./model-passport');
 expect(buildPassportRoutes('Same',[],'uuid')).toMatchObject({aiStatsCompare:'/compare?m=uuid'});
});
test('historical search records preserve the explicit history switch',()=>{
 expect(identity.compareRecordHref('old',undefined,true)).toBe('/compare?m=old&history=1');
});
