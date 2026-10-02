import {expect,test} from 'bun:test';
import * as cache from './catalog-cache';
const row={source_key:'huggingface',snapshot_id:3,content_hash:'a'.repeat(64),record_count:1,
 fetched_at:'2026-10-01T00:00:00Z',published_at:'2026-10-01T00:10:00Z',refresh_status:'failed',refresh_message:'Retaining last good data',
 payload:{schemaVersion:1,sourceKey:'huggingface',observedAt:null,records:[{id:'lab/a',model_id:'lab/a',downloads:0,likes:1,tags:[],author:'lab',pipeline_tag:null,library_name:null,last_modified:null}]}};
test('failed refreshes retain dated cached models instead of assigning a new fetch time',()=>{
 const parsed=cache.parseCatalogCache?.(row,'huggingface');
 expect(parsed?.records[0]).toMatchObject({id:'lab/a',downloads:0,fetched_at:'2026-10-01T00:00:00.000Z'});
 expect(parsed?.receipt).toMatchObject({status:'failed',snapshotId:'3',contentHash:'a'.repeat(64),observedAt:null});
});
test('wrong-source, malformed, duplicate and count-mismatched caches are rejected',()=>{
 for(const invalid of [{...row,source_key:'openrouter'},{...row,record_count:2},
  {...row,fetched_at:'not a date'},
  {...row,payload:{...row.payload,records:[row.payload.records[0],row.payload.records[0]]}}])
  expect(cache.parseCatalogCache?.(invalid,'huggingface')).toBeNull();
});
test('metadata updates only describe the displayed snapshot when hashes match',()=>{
 expect(cache.catalogReceiptUpdate?.('a'.repeat(64),{...row,content_hash:'b'.repeat(64)})).toMatchObject({sameSnapshot:false});
 expect(cache.catalogReceiptUpdate?.('a'.repeat(64),row)).toMatchObject({sameSnapshot:true,status:'failed'});
});
