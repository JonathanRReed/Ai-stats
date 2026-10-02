import {expect,test} from 'bun:test';
import {createMeasurementLoader,compactCatalog,expandCatalog,measurementBucket} from './compare-delivery';
const rows=[{id:'a',source:'aa' as const,sourceModelId:'a',name:'A',family:'A',current:true,intelligence:42}];
const catalog=expandCatalog(compactCatalog(rows)),revision='revision';
test('concurrent measurement requests share a successful fetch',async()=>{
 let calls=0;
 const loader=createMeasurementLoader(revision,catalog,async()=>{calls++;return Response.json({schemaVersion:1,revision,bucket:measurementBucket('a'),records:rows});});
 const [a,b]=await Promise.all([loader.load(['a']),loader.load(['a'])]);
 expect(calls).toBe(1);expect(a).toEqual(rows);expect(b).toEqual(rows);
 await loader.load(['a']);expect(calls).toBe(1);
});
test('failed loads are retryable and never cache a stale revision',async()=>{
 let calls=0;
 const loader=createMeasurementLoader(revision,catalog,async()=>{calls++;return Response.json({schemaVersion:1,revision:calls===1?'old':revision,bucket:measurementBucket('a'),records:rows});});
 await expect(loader.load(['a'])).rejects.toThrow();
 expect(await loader.load(['a'])).toEqual(rows);expect(calls).toBe(2);
});
test('unknown selections cannot cause arbitrary resource requests',async()=>{
 let calls=0;const loader=createMeasurementLoader(revision,catalog,async()=>{calls++;throw new Error('unexpected');});
 expect(await loader.load(['https://foreign.test'])).toEqual([]);expect(calls).toBe(0);
});

test('measurement fetching stays within four concurrent chunk requests',async()=>{
 const many=Array.from({length:100},(_,i)=>({...rows[0],id:'model'+i,sourceModelId:'model'+i,name:'Model '+i}));
 let active=0,max=0;
 const loader=createMeasurementLoader(revision,expandCatalog(compactCatalog(many)),async url=>{
 active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,1));
 const bucket=String(url).split('/').at(-1)!.replace('.json','');
 active--;return Response.json({schemaVersion:1,revision,bucket,records:many.filter(row=>measurementBucket(row.id)===bucket)});
 });
 expect(await loader.load(many.map(row=>row.id))).toHaveLength(100);expect(max).toBeLessThanOrEqual(4);
});
