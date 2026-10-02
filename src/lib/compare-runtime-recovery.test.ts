import {expect,test} from 'bun:test';
import {createMeasurementLoader,compactCatalog,expandCatalog,measurementBucket} from './compare-delivery';
import {buildComparePresets} from './compare-presets';
test('a successful shared bucket also recovers a previously failed selected record',async()=>{
 const a='a',b=Array.from({length:300},(_,i)=>'b'+i).find(id=>measurementBucket(id)===measurementBucket(a))!;
 const rows=[a,b].map(id=>({id,name:id,family:id,source:'aa' as const,sourceModelId:id,current:true,intelligence:42}));
 let calls=0;const loader=createMeasurementLoader('r',expandCatalog(compactCatalog(rows)),async()=>{
 return ++calls===1?new Response('',{status:503}):Response.json({schemaVersion:1,revision:'r',bucket:measurementBucket(a),records:rows});});
 expect((await loader.loadPartial([a])).failedIds).toEqual([a]);
 expect((await loader.loadPartial([b])).records.map(row=>row.id)).toEqual([a,b]);
});
test('each preset uses its newest eligible cohort and names that index',()=>{
 const aa=(id:string,indexVersion:string,coding:number|null,priceBlended:number)=>({id,name:id,family:id,provider:id,source:'aa' as const,sourceModelId:id,current:true,indexVersion,intelligence:50,coding,priceBlended});
 const presets=buildComparePresets([aa('older','4.3',60,.5),aa('newer','4.4',null,5)]);
 expect(presets.find(p=>p.id==='coding')?.modelIds).toEqual(['older']);
 expect(presets.find(p=>p.id==='coding')?.description).toContain('4.3');
 expect(presets.find(p=>p.id==='budget')?.modelIds).toEqual(['older']);
});
