import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {releaseDatasetRevision} from '../../scripts/app-release.mjs';
import {fromEpochRuns} from './compare-evidence';
import {buildEpochRankingPayload} from './epoch-leaderboard-ranking';
import {epochRankingRevision,withEpochRankingRevision,type EpochRankingContent} from './epoch-ranking-revision';
import type {EpochBenchmark,EpochBenchmarkRun} from './supabase';

const gpqa:EpochBenchmark={id:'gpqa',slug:'gpqa',name:'GPQA',description:null,source:null,metadata:{benchmark:'epoch'}};
// Publisher benchmarks are ranked on the dashboard but are not part of the compare manifest below.
const livebench:EpochBenchmark={id:'publisher_livebench_v1',slug:'publisher_livebench_v1',name:'LiveBench v1',description:null,source:'LiveBench',metadata:{source_key:'livebench',source_url:'https://livebench.ai'}};
const run=(id:string,slug:string,score:number,extra:Partial<EpochBenchmarkRun>={}):EpochBenchmarkRun=>({
 id,model_version:'m:'+id,benchmark_id:slug,benchmark_slug:slug,score,score_metric:'accuracy',score_unit:'percent',
 benchmark_version:'1',higher_is_better:true,conditions:null,organization:'Org',source_name:'Epoch',source_link:null,
 release_date:null,country:null,stderr:null,evaluation_date:null,...extra,
});
const publisherRun=(id:string,score:number)=>run(id,livebench.slug,score,{source_key:'livebench',source_name:'LiveBench'});
const content=(overrides:Partial<EpochRankingContent>={}):EpochRankingContent=>({
 benchmarks:[gpqa,livebench],
 runs:[run('e1',gpqa.slug,90),run('e2',gpqa.slug,80),publisherRun('p1',70),publisherRun('p2',60)],
 labels:{gpqa:'GPQA',publisher_livebench_v1:'LiveBench v1'},
 modelNames:{'m:e1':'Model E1','m:e2':'Model E2','m:p1':'Model P1','m:p2':'Model P2'},
 ...overrides,
});
const compareRevision=(value:EpochRankingContent)=>{
 const manifest={delivery:{},sources:[],benchmarks:[{slug:'gpqa',name:'GPQA'}]};
 return releaseDatasetRevision(manifest,fromEpochRuns(value.runs.filter(row=>row.benchmark_slug==='gpqa'),'2026-10-01T00:00:00.000Z'));
};

test('identical ranking content has a stable sha256 revision regardless of key order',()=>{
 const base=content();
 const reordered=content({modelNames:Object.fromEntries(Object.entries(base.modelNames).reverse()),labels:{publisher_livebench_v1:'LiveBench v1',gpqa:'GPQA'}});
 expect(epochRankingRevision(base)).toMatch(/^[0-9a-f]{64}$/);
 expect(epochRankingRevision(content())).toBe(epochRankingRevision(base));
 expect(epochRankingRevision(reordered)).toBe(epochRankingRevision(base));
});

test('a change or removal only outside the compare manifest moves the ranking revision but not compare datasetRevision',()=>{
 const base=content();
 const rescored=content({runs:base.runs.map(row=>row.id==='p2'?{...row,score:65}:row)});
 const withdrawn=content({runs:base.runs.filter(row=>row.id!=='p2')});
 const dropped=content({benchmarks:[gpqa],runs:base.runs.filter(row=>row.benchmark_slug==='gpqa')});
 const relabeled=content({labels:{...base.labels,publisher_livebench_v1:'LiveBench 2026'}});
 const renamed=content({modelNames:{...base.modelNames,'m:p1':'Renamed P1'}});
 const revisions=[base,rescored,withdrawn,dropped,relabeled,renamed].map(epochRankingRevision);
 expect(new Set(revisions).size).toBe(revisions.length);
 // Compare's own fingerprint is untouched by these non-manifest changes.
 for(const changed of [rescored,withdrawn,dropped,relabeled,renamed])expect(compareRevision(changed)).toBe(compareRevision(base));
});

test('ranked rows, benchmark definitions, and benchmark order inside the ranking move the revision',()=>{
 const base=content();
 const revision=epochRankingRevision(base);
 expect(epochRankingRevision(content({runs:base.runs.filter(row=>row.id!=='e2')}))).not.toBe(revision);
 expect(epochRankingRevision(content({runs:base.runs.map(row=>row.id==='e1'?{...row,score_metric:'pass@1'}:row)}))).not.toBe(revision);
 expect(epochRankingRevision(content({benchmarks:[{...gpqa,name:'GPQA Diamond'},livebench]}))).not.toBe(revision);
 expect(epochRankingRevision(content({benchmarks:[livebench,gpqa]}))).not.toBe(revision);
});

test('SSR and the ranking endpoint share one revision from the same source',()=>{
 const source=withEpochRankingRevision(content());
 const payload=buildEpochRankingPayload(source);
 expect(payload.revision).toBe(source.revision);
 expect(payload.revision).toBe(epochRankingRevision(content()));
 const dashboard=readFileSync(new URL('../components/Dashboard.astro',import.meta.url),'utf8');
 const endpoint=readFileSync(new URL('../pages/api/epoch-ranking/[revision].json.ts',import.meta.url),'utf8');
 const server=readFileSync(new URL('./epoch-leaderboard-server.ts',import.meta.url),'utf8');
 expect(dashboard).toContain('const epochLeaderboard = await getEpochLeaderboardSource();');
 expect(dashboard).toContain('const epochRankingRevision = epochLeaderboard.revision;');
 expect(endpoint).toContain('buildEpochRankingPayload(await getEpochLeaderboardSource())');
 expect(server).toContain('withEpochRankingRevision(');
 expect(server).not.toContain('datasetRevision');
});
