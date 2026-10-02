import {useEffect,useRef,useState} from 'react';
import CompareExplorer from './CompareExplorer';
import {fetchNewCompareRelease,shouldApplyRelease,type ReleaseCandidate} from '../../lib/compare-release-client';
import type {CompareReleaseManifest} from '../../lib/compare-release';
export default function CompareLive({initial}:{initial:CompareReleaseManifest}){
 const [active,setActive]=useState<ReleaseCandidate>({revision:initial.datasetRevision,manifest:initial});
 const [pending,setPending]=useState<ReleaseCandidate|null>(null);
 const interacted=useRef(false),currentDataset=useRef(initial.datasetRevision);
 useEffect(()=>{
 let cancelled=false,inFlight=false,firstCheck=true,lastCheck=0,controller:AbortController|undefined;
 const check=async()=>{
 if(cancelled||inFlight||document.hidden||Date.now()-lastCheck<60000)return;
 inFlight=true;lastCheck=Date.now();controller=new AbortController();
 try{
 const candidate=await fetchNewCompareRelease(currentDataset.current,fetch,controller.signal);
 if(cancelled)return;
 if(candidate){
 if(shouldApplyRelease(firstCheck,interacted.current)){currentDataset.current=candidate.manifest.datasetRevision;setActive(candidate);setPending(null);}
 else setPending(candidate);
 }
 }catch{ /* Keep the dated static or previously validated data. */ }
 finally{firstCheck=false;inFlight=false;}
 };
 void check();const timer=window.setInterval(()=>void check(),300000);
 const visible=()=>{if(!document.hidden)void check();};document.addEventListener('visibilitychange',visible);
 return()=>{cancelled=true;controller?.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[]);
 return <div onPointerDownCapture={()=>{interacted.current=true;}} onKeyDownCapture={()=>{interacted.current=true;}}>
 {pending?<div className="release-refresh" role="status"><button type="button" onClick={()=>{
 currentDataset.current=pending.manifest.datasetRevision;setActive(pending);setPending(null);
 }}>Refresh data</button></div>:null}
 <CompareExplorer key={active.revision} models={active.manifest.models} delivery={active.manifest.delivery}
 benchmarks={active.manifest.benchmarks} defaultModelIds={active.manifest.defaultModelIds}/>
 </div>;
}
