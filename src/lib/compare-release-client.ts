import {readCompareRelease,type CompareReleaseManifest} from './compare-release';
export type ReleaseCandidate={revision:string;manifest:CompareReleaseManifest};
type Fetcher=(url:string,init?:RequestInit)=>Promise<Response>;
export const shouldApplyRelease=(firstCheck:boolean,interacted:boolean)=>firstCheck&&!interacted;
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
 return {revision:current.revision,manifest:{...manifest,delivery:{...manifest.delivery,assetBase:root+'/measurements',benchmarkBase:root+'/benchmarks'}}};
}
