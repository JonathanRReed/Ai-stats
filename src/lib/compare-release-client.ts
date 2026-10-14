import {readCompareRelease,RELEASE_SCHEMA,type CompareReleaseManifest} from './compare-release';
export type ReleaseCandidate={revision:string;manifest:CompareReleaseManifest};
type Fetcher=(url:string,init?:RequestInit)=>Promise<Response>;
export const shouldApplyRelease=(firstCheck:boolean,interacted:boolean)=>firstCheck&&!interacted;
/**
 * Older v2 releases can contain a newer measurement snapshot without the
 * chart-specific suggestions added by the current site build. Keep the
 * build-time suggestions only for identities that still exist in that
 * snapshot; all displayed measurements continue to come from the new release.
 */
export function inheritCompareSuggestions(initial:CompareReleaseManifest,updated:CompareReleaseManifest):CompareReleaseManifest{
 const supplied=updated.delivery.suggestedModelIds??{};
 const rows=new Map(updated.delivery.catalog.rows.map(row=>[row[0],row]));
 const inherited:NonNullable<typeof initial.delivery.suggestedModelIds>={};
 for(const [chart,ids] of Object.entries(initial.delivery.suggestedModelIds??{})){
  if(supplied[chart as keyof typeof supplied]!==undefined)continue;
  const compatible=ids.filter(id=>{
   const row=rows.get(id);if(!row)return false;
   if(chart==='price')return Boolean(row[9]&1);
   return row[3]===0&&row[4]===true&&Boolean(row[9]&2);
  }).slice(0,8);
  if(compatible.length)inherited[chart as keyof typeof inherited]=compatible;
 }
 if(!Object.keys(inherited).length)return updated;
 const suggestions={...inherited,...supplied};
 const taskCost=suggestions['task-cost'];
 return {...updated,defaultModelIds:taskCost?.length?taskCost:updated.defaultModelIds,
  delivery:{...updated.delivery,suggestedModelIds:suggestions}};
}
export async function fetchNewCompareRelease(datasetRevision:string,fetchImpl:Fetcher=fetch,signal?:AbortSignal,fresh=false):Promise<ReleaseCandidate|null>{
 signal=signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000);
 const response=await fetchImpl('/api/releases/current.json',{cache:'no-store',signal,...(fresh?{headers:{'Cache-Control':'no-cache'}}:{})});
 if(response.status===404||response.status===503)return null;
 if(!response.ok)throw new Error('Release check failed');
 const current=await response.json();
 if(current?.schemaVersion!==1||typeof current.revision!=='string'||!/^[a-f0-9]{64}$/.test(current.revision)||
 typeof current.datasetRevision!=='string'||!/^[a-f0-9]{64}$/.test(current.datasetRevision))throw new Error('Invalid release pointer');
 if(current.datasetRevision===datasetRevision)return null;
 const root='/api/releases/'+current.revision;
 const result=await fetchImpl(root+'/manifest.json',{cache:'force-cache',signal});
 if(!result.ok)throw new Error('Release manifest unavailable');
 const manifest=readCompareRelease(await result.json());
 if(manifest.datasetRevision!==current.datasetRevision)throw new Error('Release changed during refresh');
 // A pre-migration cache cannot remove sources introduced by this deployment.
 if(manifest.schemaVersion!==RELEASE_SCHEMA)return null;
 return {revision:current.revision,manifest:{...manifest,delivery:{...manifest.delivery,assetBase:root+'/measurements',benchmarkBase:root+'/benchmarks'}}};
}
