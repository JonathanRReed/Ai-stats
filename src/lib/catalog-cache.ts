
import {getActiveRefreshPolicy} from '../../scripts/source-refresh-policy.mjs';
import {validCatalogRecords} from '../../scripts/public-catalogs.mjs';
export const PUBLIC_CATALOG_NAMES:Record<string,string>={openrouter:'OpenRouter',huggingface:'Hugging Face',litellm:'LiteLLM'};
const object=(value:unknown):Record<string,unknown>|null=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const date=(value:unknown):string|null=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
export function catalogReceiptUpdate(displayedHash:string,row:unknown,now=new Date()){
  const data=object(row);if(!data||typeof data.source_key!=='string'||!Object.hasOwn(PUBLIC_CATALOG_NAMES,data.source_key))return null;
  if(!/^[1-9][0-9]*$/.test(String(data.snapshot_id??'')))return null;
  const fetchedAt=date(data.fetched_at),publishedAt=date(data.published_at);
  if(!fetchedAt||!publishedAt||typeof data.content_hash!=='string'||!/^[a-f0-9]{64}$/.test(data.content_hash))return null;
  const ageHours=Math.max(0,(now.getTime()-Date.parse(fetchedAt))/3600000);
  const status=data.refresh_status==='failed'?'failed':ageHours>getActiveRefreshPolicy(data.source_key).staleAfterHours?'stale':'healthy';
  return {sameSnapshot:displayedHash===data.content_hash,sourceKey:data.source_key,
    contentHash:data.content_hash,snapshotId:String(data.snapshot_id),fetchedAt,publishedAt,
    observedAt:date(data.observed_at),status,ageHours,
    message:typeof data.refresh_message==='string'?data.refresh_message:null};
}
export function parseCatalogCache(value:unknown,sourceKey:string){
  const row=object(value),payload=object(row?.payload);
  if(!row||row.source_key!==sourceKey||!payload||payload.schemaVersion!==1||payload.sourceKey!==sourceKey||
    !Array.isArray(payload.records)||!payload.records.length||payload.records.length!==row.record_count)return null;
  const receipt=catalogReceiptUpdate(String(row.content_hash??''),{...row,observed_at:payload.observedAt});
  if(!receipt)return null;
  if(!validCatalogRecords(sourceKey,payload.records))return null;
  const records=(payload.records as Record<string,unknown>[]).map(record=>({...record,fetched_at:receipt.fetchedAt}));
  return {records,receipt};
}

export function catalogReceiptPresentation(receipt:NonNullable<ReturnType<typeof catalogReceiptUpdate>>){
  if(!receipt.sameSnapshot){
    return {status:receipt.status==='failed'?'failed':'partial',state:receipt.status==='failed'?'bad':'warn',
      label:receipt.status==='failed'?'Refresh failed':receipt.status==='stale'?'Refresh overdue':'New snapshot available',
      message:(receipt.status==='failed'?(receipt.message??'The latest catalog refresh failed.')+' ':
        receipt.status==='stale'?'The catalog refresh is overdue. ':'A newer source snapshot is available. ')+
        'This page still shows an older published snapshot.'};
  }
  return {status:receipt.status,state:receipt.status==='healthy'?'ok':receipt.status==='stale'?'warn':'bad',
    label:(receipt.status==='healthy'?'Checked recently':receipt.status==='stale'?'Refresh overdue':'Failed')+
      ', '+Math.floor(receipt.ageHours)+'h since last successful check',
    message:receipt.message??(receipt.status==='stale'?'The catalog refresh is overdue; the last good snapshot is retained.':
      receipt.status==='failed'?'The latest refresh failed; the last good snapshot is retained.':'The displayed snapshot matches the latest cached source.')};
}
