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
