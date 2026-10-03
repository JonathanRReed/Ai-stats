import {test,expect} from 'bun:test';import {preferPublisherBenchmarks} from './benchmark-catalog';import type {EpochBenchmark} from './supabase';
const b=(slug:string,metadata:Record<string,string|null>|null=null):EpochBenchmark=>({id:slug,slug,name:slug,description:null,source:'Epoch',metadata});
test('Stats uses available direct publisher evidence and preserves archives in the input',()=>{
 const rows=[b('terminalbench_external'),b('publisher_terminal_bench_4_0_0',{source_key:'terminal-bench'}),b('other')];
 expect(preferPublisherBenchmarks(rows).map(x=>x.slug)).toEqual(['publisher_terminal_bench_4_0_0','other']);expect(rows).toHaveLength(3);
 expect(preferPublisherBenchmarks([rows[0]])).toEqual([rows[0]]);
});
test('superseded versions disappear from the default menu only when their replacement is present',()=>{
 const old=b('old',{superseded_by:'New'}),current=b('new',{benchmark:'New'});
 expect(preferPublisherBenchmarks([old,current])).toEqual([current]);expect(preferPublisherBenchmarks([old])).toEqual([old]);
});
