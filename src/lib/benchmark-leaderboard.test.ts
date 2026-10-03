import {expect,test} from 'bun:test';
import {buildBenchmarkCohorts,benchmarkRecordHref,leaderboardBarWidth} from './benchmark-leaderboard';
import type {EpochBenchmark,EpochBenchmarkRun} from './supabase';
const benchmark:EpochBenchmark={id:'b',slug:'btf3_external',name:'BTF-3',description:null,source:'Epoch'};
const row=(id:string,score:number,extra:Partial<EpochBenchmarkRun>={}):EpochBenchmarkRun=>({id,score,model_version:id,benchmark_id:'b',benchmark_slug:benchmark.slug,organization:null,country:null,stderr:null,release_date:null,score_metric:'Brier',score_unit:'native',...extra});
test('BTF-3 ranks lower scores first, including zero',()=>{
 const [group]=buildBenchmarkCohorts(benchmark,[row('high',.9),row('zero',0),row('low',.2)]);
 expect(group.runs.map(r=>r.id)).toEqual(['zero','low','high']);expect(group.label).toContain('lower is better');
});
test('versions, metric units and directions never share a leaderboard',()=>{
 const groups=buildBenchmarkCohorts(benchmark,[row('v1',.1,{benchmark_version:'1'}),row('v2',.2,{benchmark_version:'2'}),row('pct',20,{benchmark_version:'2',score_unit:'percent'}),row('unknown',.3),row('nan',NaN)]);
 expect(groups).toHaveLength(4);expect(new Set(groups.map(g=>g.key)).size).toBe(4);expect(groups.every(g=>g.runs.length===1)).toBe(true);
});
test('direct publisher attribution and exact record deep links survive',()=>{
 const b={...benchmark,slug:'publisher_terminal_bench_4_0_0',name:'Terminal-Bench 4.0.0',metadata:{source_key:'terminal-bench'}};
 const r=row('astra-codex',58.2,{benchmark_slug:b.slug,benchmark_version:'4.0.0',source_key:'terminal-bench',score_metric:'accuracy',score_unit:'percent',higher_is_better:true,conditions:{agent:'Codex',reasoningEffort:'max'}});
 const [g]=buildBenchmarkCohorts(b,[r]);expect(g.label).not.toContain('Epoch');
 const url=new URL(benchmarkRecordHref(r,g.metricKey),'https://example.com');expect(url.searchParams.get('source')).toBe('publisher');expect(url.searchParams.get('record')).toBe('astra-codex');expect(JSON.parse(url.searchParams.get('score_metric')!)).toEqual(['accuracy','percent','4.0.0']);expect(url.searchParams.get('condition')).toContain('Codex');
});

test('lower-is-better decorative bars keep the winning score longest without changing data',()=>{
 expect(leaderboardBarWidth(.12,[.12,.135],false)).toBe(100);expect(leaderboardBarWidth(.135,[.12,.135],false)).toBeCloseTo(88.8889,3);
 expect(leaderboardBarWidth(0,[0,.1],false)).toBe(100);expect(leaderboardBarWidth(.1,[0,.1],false)).toBe(0);
 expect(leaderboardBarWidth(2,[2,4],true)).toBe(50);
});
