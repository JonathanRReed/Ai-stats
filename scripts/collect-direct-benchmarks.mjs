import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {validatePublisherSnapshot} from '../src/lib/publisher-evidence.ts';
import {pathToFileURL} from 'node:url';
import {normalizeLiveBench,normalizeWeirdML,normalizePostTrainBench,normalizeOSWorld,normalizeProofBench,normalizeBlueprintBench,normalizeApexAgents,normalizeGdpPdf,normalizeTerminalBench,publisherContentHash} from './direct-benchmarks.mjs';

const LIVEBENCH_AVERAGING_SHA='8048d175739ea66e8069711ff6e572c684cfc75b';
const SOURCE_KEYS=['livebench','weirdml','posttrainbench','osworld','proofbench','blueprint-bench','apex-agents','gdp-pdf','terminal-bench'];
/** Public, unauthenticated reads only; each failed source retains its prior artifact. */
export async function collectDirectBenchmarks({fetchImpl=(input,init)=>globalThis.fetch(input,init),now=()=>new Date().toISOString(),sources=SOURCE_KEYS}={}){
 if(!Array.isArray(sources)||!sources.length||sources.some(source=>!SOURCE_KEYS.includes(source)))throw new Error('Unknown direct benchmark source');
 const fetchedAt=now();
 const read=async(url,json=true,init={})=>{
  const response=await fetchImpl(url,{...init,headers:{Accept:json?'application/json':'text/plain',...init.headers},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('Publisher fetch failed ('+response.status+')');
  if(Number(response.headers.get('content-length'))>32*1024*1024)throw new Error('Publisher response exceeds size limit');
  const body=await response.text();
  if(Buffer.byteLength(body)>32*1024*1024)throw new Error('Publisher response exceeds size limit');
  return json?JSON.parse(body):body;
 };
 const github=async repo=>{
  const ref=await read('https://api.github.com/repos/'+repo+'/git/ref/heads/main');
  const sha=ref?.object?.sha;if(!/^[a-f0-9]{40}$/.test(sha??''))throw new Error('Invalid publisher commit');
  return {sha,raw:file=>'https://raw.githubusercontent.com/'+repo+'/'+sha+'/'+file,
   contents:file=>'https://api.github.com/repos/'+repo+'/contents/'+file+'?ref='+sha};
 };
 const collectors={
  livebench:async()=>{
   const repo=await github('LiveBench/new-livebench');
   const [files,method]=await Promise.all([read(repo.contents('public')),read(repo.contents('src/Table/Averaging.js'))]);
   if(method?.sha!==LIVEBENCH_AVERAGING_SHA)throw new Error('LiveBench scoring implementation changed; review before updating');
   if(!Array.isArray(files))throw new Error('Invalid LiveBench release listing');
   const names=new Set(files.map(file=>file.name));
   const releases=[...names].filter(name=>/^table_\d{4}_\d{2}_\d{2}\.csv$/.test(name)&&names.has(name.replace('table_','categories_').replace('.csv','.json'))).sort();
   const latest=releases.at(-1);if(!latest)throw new Error('No complete LiveBench release');
   const version=latest.slice(6,-4).replaceAll('_','-');
   const [csv,categories]=await Promise.all([read(repo.raw('public/'+latest),false),read(repo.raw('public/'+latest.replace('table_','categories_').replace('.csv','.json')))]);
   return normalizeLiveBench({version,categories,csv,commit:repo.sha,fetchedAt});
  },
  'terminal-bench':async()=>{
   const origin='https://hub.harborframework.com',url=origin+'/datasets/terminal-bench/terminal-bench/latest?leaderboard=4-0-0&tab=leaderboard';
   const html=await read(url,false),flights=[];
   for(const match of html.matchAll(/<script>self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)){
    try{const block=JSON.parse(match[1]);if(block[0]===1&&typeof block[1]==='string')flights.push(block[1]);}catch{/* Other bootstrap records are not leaderboard data. */}
   }
   // Flight transport chunks may split records. Resolve only plain string
   // references used by the module name and asset paths; never evaluate Flight.
   const lines=flights.join('').split('\n'),strings=new Map();let leaderboards,paths;
   for(const line of lines){
    const record=line.match(/^([a-f0-9]+):(".*")$/);
    if(record){try{const value=JSON.parse(record[2]);if(typeof value==='string')strings.set(record[1],value);}catch{/* Unrelated or incomplete record. */}}
   }
   const resolveString=value=>typeof value==='string'&&/^\$[a-f0-9]+$/.test(value)?strings.get(value.slice(1)):value;
   for(const line of lines){
    const module=line.match(/^[a-f0-9]+:I(\[.*\])$/);if(module){const value=JSON.parse(module[1]);if(resolveString(value[2])==='DatasetLeaderboardPanel')paths=Array.isArray(value[1])?value[1].map(resolveString):value[1];}
    const element=line.match(/^[a-f0-9]+:(\[.*\])$/);if(element){try{const value=JSON.parse(element[1]);if(Array.isArray(value?.[3]?.leaderboards))leaderboards=value[3].leaderboards;}catch{/* Unrelated flight record. */}}
   }
   if(!Array.isArray(leaderboards)||!Array.isArray(paths)||paths.length>30)throw new Error('Terminal-Bench public page schema changed');
   const current=leaderboards.find(item=>item.name==='4-0-0'&&item.visibility==='public');
   if(!current||typeof current.id!=='string'||leaderboards.some(item=>/^\d+-\d+-\d+$/.test(item.name)&&item.name.localeCompare('4-0-0',undefined,{numeric:true})>0))throw new Error('Terminal-Bench version changed; review before updating');
   let action;
   for(const path of [...paths].reverse()){
    if(!/^\/_next\/static\/immutable\/chunks\/[a-zA-Z0-9_-]+\.js$/.test(path))throw new Error('Unexpected Terminal-Bench client asset path');
    const script=await read(origin+path,false);
    const match=script.match(/\.createServerReference\)\("([a-f0-9]{40,64})",[^)]{0,500},"fetchLeaderboardWithRows"\)/);
    if(match){action=match[1];break;}
   }
   if(!action)throw new Error('Public leaderboard read action changed');
   // This is the same unauthenticated read action used by the publisher's public page.
   const response=await read(url,false,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',Accept:'text/x-component','Next-Action':action},body:JSON.stringify([current.id])});
   const result=response.split('\n').find(line=>line.startsWith('1:{'));
   if(!result)throw new Error('Terminal-Bench public result unavailable');
   const payload=JSON.parse(result.slice(2));if(payload.id!==current.id)throw new Error('Terminal-Bench leaderboard identity changed');
   return normalizeTerminalBench(payload,fetchedAt);
  },
  'gdp-pdf':async()=>normalizeGdpPdf(await read('https://surgehq.ai/benchmarks/gdp-pdf',false),fetchedAt),
  'apex-agents':async()=>normalizeApexAgents(await read('https://www.mercor.com/apex/apex-agents-leaderboard/?pass=pass-1',false),fetchedAt),
  proofbench:async()=>{
   const html=await read('https://www.vals.ai/benchmarks/proof_bench',false);
   const paths=[...new Set(html.match(/\/_astro\/benchmark_view_proof_bench\.[a-zA-Z0-9_-]+\.json/g)??[])];
   if(paths.length!==1)throw new Error('ProofBench published data link changed');
   return normalizeProofBench(await read('https://www.vals.ai'+paths[0]),fetchedAt);
  },
  'blueprint-bench':async()=>normalizeBlueprintBench(await read('https://andonlabs.com/evals/blueprint-bench-2',false),fetchedAt),
  osworld:async()=>normalizeOSWorld(await read('https://osworld-v2.xlang.ai/static/data/leaderboard/official-results.json'),fetchedAt),
  weirdml:async()=>normalizeWeirdML(await read('https://htihle.github.io/assets/data/weirdml_v3.json'),fetchedAt),
  posttrainbench:async()=>{
   const repo=await github('aisa-group/posttrainbench-website'),files=await read(repo.contents(''));
   if(!Array.isArray(files))throw new Error('Invalid PostTrainBench release listing');
   const releases=files.map(file=>file.name).filter(name=>/^scores-v\d+\.\d+\.json$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
   const latest=releases.at(-1);if(!latest)throw new Error('No PostTrainBench release');
   return normalizePostTrainBench(await read(repo.raw(latest)),repo.sha,fetchedAt);
  },
 };
 return Promise.all([...new Set(sources)].map(async source=>{
  try{const snapshot=await collectors[source]();return {source,status:'ready',snapshot,contentHash:publisherContentHash(snapshot)};}
  catch(error){return {source,status:'unavailable',error:error instanceof Error?error.message:'Publisher unavailable'};}
 }));
}
export async function writeDirectArtifacts(results,directory){
 await mkdir(directory,{recursive:true});
 for(const result of results){
  if(result.status!=='ready')continue;
  if(!SOURCE_KEYS.includes(result.source))throw new Error('Unknown artifact source');
  const target=path.join(directory,result.source+'.json'),temporary=target+'.tmp';
  await writeFile(temporary,JSON.stringify(result.snapshot)+'\n');await rename(temporary,target);
 }
}

/** Healthy feeds may advance only when every failed feed has a validated last-good artifact. */
export async function retainFailedArtifacts(results,directory,attemptedAt=new Date().toISOString()){
 return Promise.all(results.map(async result=>{
  if(result.status==='ready')return result;
  if(!SOURCE_KEYS.includes(result.source))throw new Error('Unknown retained source');
  const target=path.join(directory,result.source+'.json');
  const previous=validatePublisherSnapshot(JSON.parse(await readFile(target,'utf8')),result.source);
  const snapshot={...previous,refreshStatus:'failed',lastAttemptAt:attemptedAt};
  await writeFile(target+'.tmp',JSON.stringify(snapshot)+'\n');await rename(target+'.tmp',target);
  return {...result,status:'retained',snapshot};
 }));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output-directory')throw new Error('Usage: collect-direct-benchmarks --output-directory <directory>');
 let results=await collectDirectBenchmarks();
 await writeDirectArtifacts(results,args[1]);
 results=await retainFailedArtifacts(results,args[1]);
 console.log(JSON.stringify(results.map(result=>({source:result.source,status:result.status,
  records:result.snapshot?.records.length,version:result.snapshot?.benchmarkVersion,error:result.error,contentHash:result.contentHash})),null,2));
 if(results.some(result=>result.status==='retained'))console.warn('One or more publisher refreshes failed; validated dated evidence was retained.');
}
