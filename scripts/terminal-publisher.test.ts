import {test,expect} from 'bun:test';import {collectDirectBenchmarks} from './collect-direct-benchmarks.mjs';import {normalizeTerminalBench} from './direct-benchmarks.mjs';
const payload={id:'board',name:'4-0-0',visibility:'public',rows:[{id:'row',leaderboard_id:'board',status:'display',metadata:{agent_display:{label:'Codex'},model_display:{label:'GPT-6 Astra'},model_org:{label:'OpenAI'},reasoning_effort:'max',date:'2026-09-03'},metrics:{accuracy:58.18,n_trials:330,accuracy_ci95_half_width:2.79,total_tokens:1529778322,total_cost_usd:3267.18},updated_at:'2026-09-10T21:58:00Z'}]};
test('Terminal-Bench preserves full published precision and trial provenance',()=>{const row=normalizeTerminalBench(payload,'2026-10-03T16:00:00Z').records[0];expect(row.score).toBe(58.18);expect(row.conditions.trials).toBe(330);expect(row.confidence95HalfWidth).toBe(2.79);expect(row.evaluatedAt).toBeNull();});
const html=(newer=false)=>{const flight='51:I'+JSON.stringify([123,['/_next/static/immutable/chunks/read.js'],'DatasetLeaderboardPanel'])+'\n4f:'+JSON.stringify(['$','$L51',null,{leaderboards:[{id:'board',name:'4-0-0',visibility:'public'},...(newer?[{id:'next',name:'5-0-0',visibility:'public'}]:[])]}]);return '<script>self.__next_f.push('+JSON.stringify([1,flight])+')</script>';};
test('Terminal collector discovers only the named public read action without credentials',async()=>{
 const calls:Array<{url:string,init?:RequestInit}>=[];
 const results=await collectDirectBenchmarks({sources:['terminal-bench'],fetchImpl:async(url,init)=>{
 calls.push({url:String(url),init});
 if(init?.method==='POST'){expect(init.headers.Authorization).toBeUndefined();expect(init.body).toBe('["board"]');return new Response('0:{}\n1:'+JSON.stringify(payload)+'\n');}
 if(String(url).endsWith('read.js'))return new Response('let fn=(0,tc.createServerReference)("'+'a'.repeat(40)+'",tc.callServer,void 0,tc.findSourceMapURL,"fetchLeaderboardWithRows")');
 return new Response(html());
 }});
 expect(results[0].status).toBe('ready');expect(calls).toHaveLength(3);
});
test('a newer Terminal benchmark release requires review before collection',async()=>{
 let calls=0;const results=await collectDirectBenchmarks({sources:['terminal-bench'],fetchImpl:async()=>{calls++;return new Response(html(true));}});
 expect(results[0].status).toBe('unavailable');expect(calls).toBe(1);
});
