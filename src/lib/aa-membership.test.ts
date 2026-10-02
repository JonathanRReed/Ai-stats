import {expect,test} from 'bun:test';
import * as membership from './aa-membership';
const rows=[{id:'current',name:'Current'},{id:'retired',name:'Retired'}];
const cache={source_key:'artificial-analysis',record_count:1,payload:{schemaVersion:1,sourceKey:'artificial-analysis',
  records:[{id:'current',kind:'model-membership'}]}};
test('validated source membership filters current models without deleting history',()=>{
  expect(membership.filterAaCurrentModels?.(rows,cache)).toEqual([rows[0]]);
  expect(rows).toHaveLength(2);
});
test('unavailable or malformed membership is explicit instead of an empty current cohort',()=>{
  expect(membership.filterAaCurrentModels?.(rows,null)).toBeNull();
  expect(membership.filterAaCurrentModels?.(rows,{...cache,record_count:2})).toBeNull();
  expect(membership.filterAaCurrentModels?.(rows,{...cache,payload:{...cache.payload,records:[{id:'missing',kind:'model-membership'}]}})).toBeNull();
});

test('current source reader filters normal views and can include history explicitly',async()=>{
  const sources={models:async()=>rows,cache:async()=>cache};
  expect((await membership.readAaCohort?.(sources))?.map((row:{id:string})=>row.id)).toEqual(['current']);
  expect((await membership.readAaCohort?.(sources,true))?.map((row:{id:string})=>row.id)).toEqual(['current','retired']);
});
test('cache failure retains rows with unknown membership rather than claiming current',async()=>{
  const result=await membership.readAaCohort?.({models:async()=>rows,cache:async()=>{throw new Error('offline');}});
  expect(result?.[0].current_source_member).toBeNull();
  expect(result).toHaveLength(2);
});
