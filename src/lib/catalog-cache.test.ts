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

test('a superseded displayed snapshot cannot keep its healthy badge after live refresh failure',()=>{
 const receipt=cache.catalogReceiptUpdate('b'.repeat(64),row)!;
 expect(cache.catalogReceiptPresentation(receipt)).toMatchObject({status:'failed',label:'Refresh failed',state:'bad'});
 expect(cache.catalogReceiptPresentation(receipt).message).toContain('older published snapshot');
 const healthy=cache.catalogReceiptUpdate('b'.repeat(64),{...row,refresh_status:'healthy',fetched_at:new Date().toISOString()})!;
 expect(cache.catalogReceiptPresentation(healthy)).toMatchObject({status:'partial',label:'New snapshot available',state:'warn'});
});

test('catalog read receipts preserve valid snapshot metadata and disclose unusable inputs',()=>{
 expect(cache.catalogReadReceipt('huggingface',cache.parseCatalogCache(row,'huggingface'))).toMatchObject({
 sourceKey:'huggingface',available:true,status:'failed',snapshotId:'3',contentHash:'a'.repeat(64),fetchedAt:'2026-10-01T00:00:00.000Z'});
 for(const invalid of [null,{...row,record_count:2},{...row,payload:{...row.payload,records:[{}]}}]){
  expect(cache.catalogReadReceipt('huggingface',cache.parseCatalogCache(invalid,'huggingface'))).toMatchObject({
   sourceKey:'huggingface',available:false,status:'unavailable',reason:'No validated cache available',fetchedAt:null});
 }
});
