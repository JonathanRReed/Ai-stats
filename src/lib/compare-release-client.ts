import {AUTOMATIC_SELECTION_POLICY} from './automatic-selection';
import {readCompareRelease,RELEASE_SCHEMA,type CompareReleaseManifest} from './compare-release';
import {hasBrowseRankContract} from './compare-browse-rank';
export type ReleaseCandidate={revision:string;manifest:CompareReleaseManifest};
type Fetcher=(url:string,init?:RequestInit)=>Promise<Response>;
export const shouldApplyRelease=(firstCheck:boolean,interacted:boolean)=>firstCheck&&!interacted;
/**
 * A live release may replace the rendered one only if it satisfies the same client contract:
 * the current schema, the current browse-rank policy, and data generated no earlier than the
 * page. An older-contract release (for example production before this deployment) is ignored
 * rather than silently dropping ranking metadata the page was rendered with.
 */
export function isCompatibleLiveRelease(manifest:CompareReleaseManifest,notBefore?:string|null):boolean{
 if(manifest.delivery.automaticSelectionPolicy!==AUTOMATIC_SELECTION_POLICY||manifest.schemaVersion!==RELEASE_SCHEMA||!hasBrowseRankContract(manifest.delivery.catalog))return false;
 if(notBefore&&Number.isFinite(Date.parse(notBefore))&&Date.parse(manifest.generatedAt)<Date.parse(notBefore))return false;
 return true;
}
export async function fetchNewCompareRelease(datasetRevision:string,fetchImpl:Fetcher=fetch,signal?:AbortSignal,fresh=false,notBefore?:string|null):Promise<ReleaseCandidate|null>{
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
 // A pre-migration cache cannot remove sources or rank metadata introduced by this deployment.
 if(!isCompatibleLiveRelease(manifest,notBefore))return null;
 return {revision:current.revision,manifest:{...manifest,delivery:{...manifest.delivery,assetBase:root+'/measurements',benchmarkBase:root+'/benchmarks'}}};
}
