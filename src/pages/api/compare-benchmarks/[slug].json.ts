import type {APIRoute,GetStaticPaths} from 'astro';
import {getEpochEvidence} from '../../../lib/epoch-evidence';
import {fromEpochRuns} from '../../../lib/compare-evidence';
import {getEpochBenchmarkLabel,getEpochBenchmarksWithRuns} from '../../../lib/benchmark-catalog';
export const prerender=true;
export const getStaticPaths:GetStaticPaths=async()=>{
  const evidence=await getEpochEvidence();
  return getEpochBenchmarksWithRuns(evidence.epochBenchmarks,evidence.epochRuns)
    .filter(benchmark=>/^[a-z0-9_-]+$/.test(benchmark.slug))
    .map(benchmark=>({params:{slug:benchmark.slug},props:{payload:{schemaVersion:1,slug:benchmark.slug,
      name:getEpochBenchmarkLabel(benchmark),fetchedAt:evidence.fetchedAt,
      observations:fromEpochRuns(evidence.epochRuns.filter(run=>run.benchmark_slug===benchmark.slug),evidence.fetchedAt)}}}));
};
export const GET:APIRoute=async({props})=>new Response(JSON.stringify(props.payload),{
  headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'},
});
