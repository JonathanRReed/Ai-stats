import type {EpochBenchmark, EpochBenchmarkRun} from './supabase';
import {getEpochBenchmarkLabel} from './benchmark-catalog';

export function buildBenchmarkCohorts(benchmark:EpochBenchmark, runs:EpochBenchmarkRun[]) {
 const groups=new Map<string,EpochBenchmarkRun[]>();
 for(const run of runs){
  if(run.benchmark_slug!==benchmark.slug||typeof run.score!=='number'||!Number.isFinite(run.score))continue;
  const identity=JSON.stringify([run.benchmark_version??null,run.score_metric??null,run.score_unit??'native',run.higher_is_better??benchmark.slug!=='btf3_external']);
  const group=groups.get(identity)??[];group.push(run);groups.set(identity,group);
 }
 return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([identity,group])=>{
  const [version,metric,unit,higherIsBetter]=JSON.parse(identity) as [string|null,string|null,string,boolean];
  const baseKey='epoch_'+benchmark.slug;
  const key=groups.size===1?baseKey:baseKey+'__'+encodeURIComponent(identity);
  const publisher=Boolean(benchmark.metadata?.source_key);
  const label=[getEpochBenchmarkLabel(benchmark),version&&!getEpochBenchmarkLabel(benchmark).includes(version)?version:null,metric??'Metric unspecified',higherIsBetter?null:'lower is better',publisher?null:'Epoch'].filter(Boolean).join(' · ');
  return {key,metricKey:baseKey,label,version,metric,unit,higherIsBetter,runs:[...group].sort((a,b)=>(higherIsBetter?-1:1)*((a.score??0)-(b.score??0))||a.id.localeCompare(b.id))};
 });
}

export function benchmarkRecordHref(model:{source_key?:string;model_version:string;conditions?:Record<string,unknown>|null;score_metric?:string|null;score_unit?:string;benchmark_version?:string|null},metric:string){
 return '/compare?'+new URLSearchParams({
  source:model.source_key?'publisher':'epoch-ai',record:model.model_version,chart:'benchmark',metric,
  ...(model.conditions?{condition:JSON.stringify(Object.entries(model.conditions).sort(([a],[b])=>a.localeCompare(b)))}:{}),
  score_metric:JSON.stringify([model.score_metric??'Unknown metric',model.score_unit==='fraction'?'percent':model.score_unit??'native',...(model.benchmark_version?[model.benchmark_version]:[])])
 }).toString();
}
export function benchmarkRunSettings(model:{conditions?:Record<string,unknown>|null}){
 return Object.entries(model.conditions??{}).filter(([key])=>/^(agent|agent version|harness|harness version|reasoning effort|reasoningEffort|livebench version|metr version)$/i.test(key)).map(([,value])=>String(value)).join(' · ');
}
