import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseCatalogCache,catalogReadReceipt} from '../src/lib/catalog-cache';
const source=readFileSync('src/lib/supabase.ts','utf8');
const reader=source.slice(source.indexOf('async function readPublicCatalog('),source.indexOf('async function fetchHuggingFaceCachedModels'));
const transpiler=new Bun.Transpiler({loader:'ts'});
const code=transpiler.transformSync(reader.replace('export async function','async function'))+';getCompareCatalogSources();';
const hf={source_key:'huggingface',snapshot_id:3,content_hash:'a'.repeat(64),record_count:1,
 fetched_at:'2026-10-01T00:00:00Z',published_at:'2026-10-01T00:10:00Z',refresh_status:'healthy',
 payload:{schemaVersion:1,sourceKey:'huggingface',observedAt:null,records:[{id:'lab/a',model_id:'lab/a',downloads:0,likes:1,tags:[],author:'lab',pipeline_tag:null,library_name:null,last_modified:null}]}};
test('a rejected source query preserves other cached records and explicit unavailable receipts',async()=>{
 const supabase={from:()=>({select:()=>({eq:(_column:string,key:string)=>({maybeSingle:async()=>{
  if(key==='openrouter')throw new Error('test query failure');
  return {data:key==='huggingface'?hf:null,error:null};
 }})})})};
 const result=await runInNewContext(code,{supabase,parseCatalogCache,catalogReadReceipt});
 expect(result.huggingface).toHaveLength(1);expect(result.openrouter).toEqual([]);expect(result.litellm).toEqual([]);
 expect(result.availability).toHaveLength(3);
 expect(result.availability[0]).toMatchObject({sourceKey:'openrouter',available:false,reason:'No validated cache available'});
 expect(result.availability[1]).toMatchObject({sourceKey:'huggingface',available:true,snapshotId:'3'});
});
test('absent database client cannot produce a healthy empty source receipt',async()=>{
 const result=await runInNewContext(code,{supabase:null,parseCatalogCache,catalogReadReceipt});
 expect(result.availability.every((item:{available:boolean;status:string})=>!item.available&&item.status==='unavailable')).toBe(true);
});
