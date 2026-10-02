import {expect,test} from 'bun:test';
import {parseCompareState,serializeCompareState} from './compare-state';
import {buildComparePresets} from './compare-presets';
import {readFileSync} from 'node:fs';
test('saved unavailable exact IDs recover when their record becomes available',()=>{
 const unavailable=parseCompareState(new URLSearchParams('m=openrouter:lab/a'),[]);
 const rows=[{id:'openrouter:lab/a',source:'openrouter',sourceModelId:'lab/a',current:true}];
 expect(parseCompareState(serializeCompareState(unavailable),rows).modelIds).toEqual(['openrouter:lab/a']);
});
test('unresolved source aliases recover only when a unique native record exists',()=>{
 const missing=parseCompareState(new URLSearchParams('source=artificial-analysis&record=a'),[]);
 const rows=[{id:'uuid',slug:'a',source:'aa',sourceModelId:'uuid',current:true}];
 expect(parseCompareState(serializeCompareState(missing),rows).modelIds).toEqual(['uuid']);
 expect(parseCompareState(serializeCompareState(missing),[...rows,{...rows[0],id:'other',sourceModelId:'other'}]).modelIds).toEqual([]);
});
test('presets prefer the newest numeric index version even when an older cohort is larger',()=>{
 const aa=(id:string,indexVersion:string)=>({id,name:id,family:id,provider:id,source:'aa' as const,sourceModelId:id,current:true,indexVersion,intelligence:50,coding:50,priceBlended:.5});
 const presets=buildComparePresets([aa('old1','4.3'),aa('old2','4.3'),aa('new','4.10')]);
 expect(presets.find(p=>p.id==='coding')?.modelIds).toEqual(['new']);
 expect(presets.find(p=>p.id==='budget')?.modelIds).toEqual(['new']);
});
test('general Epoch footer does not promise a specific run comparison',()=>{
 const source=readFileSync('src/components/TaskWorkbench.astro','utf8');
 expect(source).not.toContain('<a href="/compare">Compare runs</a>');
});
