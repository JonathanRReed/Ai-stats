import {useEffect,useRef,useState} from 'react';
import CompareExplorer from './CompareExplorer';
import {fetchNewCompareRelease,shouldApplyRelease,type ReleaseCandidate} from '../../lib/compare-release-client';
import type {CompareReleaseManifest} from '../../lib/compare-release';
export default function CompareLive({initial}:{initial:CompareReleaseManifest}){
 const [active,setActive]=useState<ReleaseCandidate>({revision:initial.datasetRevision,manifest:initial});
 const [refreshing,setRefreshing]=useState(false);
 const manualRefresh=useRef(false);
 const requestVersion=useRef(0),mounted=useRef(true);
 const [pending,setPending]=useState<ReleaseCandidate|null>(null);
 const interacted=useRef(false),currentDataset=useRef(initial.datasetRevision);
 useEffect(()=>{
 mounted.current=true;
 let cancelled=false,inFlight=false,firstCheck=true,lastCheck=0,controller:AbortController|undefined;
 const check=async()=>{
 if(cancelled||inFlight||manualRefresh.current||document.hidden||Date.now()-lastCheck<60000)return;
 inFlight=true;lastCheck=Date.now();controller=new AbortController();const version=++requestVersion.current;
 try{
 const candidate=await fetchNewCompareRelease(currentDataset.current,fetch,controller.signal);
 if(cancelled||version!==requestVersion.current)return;
 if(candidate){
 if(shouldApplyRelease(firstCheck,interacted.current)){currentDataset.current=candidate.manifest.datasetRevision;setActive(candidate);setPending(null);}
 else setPending(candidate);
 }else setPending(null);
 }catch{ /* Keep the dated static or previously validated data. */ }
 finally{firstCheck=false;inFlight=false;}
 };
 void check();const timer=window.setInterval(()=>void check(),300000);
 const visible=()=>{if(!document.hidden)void check();};document.addEventListener('visibilitychange',visible);
 return()=>{cancelled=true;mounted.current=false;requestVersion.current++;controller?.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[]);
 const refresh=async()=>{
 if(manualRefresh.current)return;manualRefresh.current=true;setRefreshing(true);const version=++requestVersion.current;
 try{
 const candidate=await fetchNewCompareRelease(currentDataset.current,fetch,undefined,true);
 if(!mounted.current||version!==requestVersion.current)return;
 if(candidate){currentDataset.current=candidate.manifest.datasetRevision;setActive(candidate);}
 setPending(null);
 }catch{ /* Leave the current comparison intact and allow another explicit retry. */ }
 finally{manualRefresh.current=false;if(mounted.current)setRefreshing(false);}
 };
 return <div onPointerDownCapture={()=>{interacted.current=true;}} onKeyDownCapture={()=>{interacted.current=true;}}>
 {pending?<div className="release-refresh" role="status"><button type="button" disabled={refreshing} onClick={()=>void refresh()}>{refreshing?'Refreshing…':'Refresh data'}</button></div>:null}
 <CompareExplorer key={active.revision} models={active.manifest.models} delivery={active.manifest.delivery}
 benchmarks={active.manifest.benchmarks} defaultModelIds={active.manifest.defaultModelIds}/>
 </div>;
}
