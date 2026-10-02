import {supabase} from './supabase';
import {parseUsageCache} from '../../scripts/sync-openrouter-usage.mjs';
import type {UsageSnapshot} from './openrouter-usage';
export async function getOpenRouterUsageSnapshot(){
 if(!supabase)return null;
 try{
  const {data,error}=await supabase.from('source_snapshot_cache')
   .select('source_key,snapshot_id,content_hash,record_count,payload,fetched_at,published_at,refresh_status')
   .eq('source_key','openrouter-usage').maybeSingle();
  const parsed=error?null:parseUsageCache(data);
  return parsed?{snapshot:parsed.snapshot as UsageSnapshot,receipt:parsed.receipt}:null;
 }catch{return null;}
}
