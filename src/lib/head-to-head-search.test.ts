import {expect,test} from 'bun:test';
import {familyMatchScore,parseVersusQuery,readMatchupSearchIndex,resolveVersusQuery,MATCHUP_INDEX_SCHEMA,type MatchupSearchIndex} from './head-to-head-search';

const index:MatchupSearchIndex={
 families:[
  {s:'claude-opus-5-5',n:'Claude Opus 5.5',p:'Anthropic',r:2,ids:['o1','o2']},
  {s:'claude-opus-5',n:'Claude Opus 5',p:'Anthropic',r:12,ids:['o3']},
  {s:'gpt-6-astra',n:'GPT-6 Astra',p:'OpenAI',r:3,ids:['a1']},
  {s:'command-a',n:'Command A',p:'Cohere',r:null,ids:['c1']},
 ],
 matchups:[{u:'/compare/claude-opus-5-5-vs-gpt-6-astra',a:'claude-opus-5-5',b:'gpt-6-astra'}],
};

test('versus queries are recognised in their common spellings', () => {
 expect(parseVersusQuery('opus vs astra')).toEqual(['opus','astra']);
 expect(parseVersusQuery('Opus VS. Astra')).toEqual(['Opus','Astra']);
 expect(parseVersusQuery('opus versus gpt-6 astra')).toEqual(['opus','gpt-6 astra']);
 expect(parseVersusQuery('opus')).toBeNull();
 expect(parseVersusQuery('vs astra')).toBeNull();
 expect(parseVersusQuery('canvas tools')).toBeNull();
});

test('opus vs astra opens the matchup page, preferring the higher-ranked family', () => {
 expect(resolveVersusQuery('opus vs astra',index)).toMatchObject({kind:'matchup',url:'/compare/claude-opus-5-5-vs-gpt-6-astra',label:'Claude Opus 5.5 vs GPT-6 Astra'});
 expect(resolveVersusQuery('astra versus opus',index)?.url).toBe('/compare/claude-opus-5-5-vs-gpt-6-astra');
});

test('pairs without a page fall back to compare with both families selected', () => {
 const result=resolveVersusQuery('claude opus 5 vs command a',index);
 expect(result?.kind).toBe('compare');
 expect(result?.a.s).toBe('claude-opus-5');
 const params=new URLSearchParams(result!.url.split('?')[1]);
 expect(params.getAll('m')).toEqual(['o3','c1']);
 expect(params.get('chart')).toBe('task-cost');
});

test('both sides naming the same family still yields two different families', () => {
 const result=resolveVersusQuery('opus vs opus',index);
 expect(result?.a.s).not.toBe(result?.b.s);
 expect(resolveVersusQuery('opus vs nothing-like-this',index)).toBeNull();
 expect(resolveVersusQuery('opus vs astra',null)).toBeNull();
});

test('exact names and slugs beat word matches', () => {
 const opus5=index.families[1];
 expect(familyMatchScore('claude opus 5',opus5)).toBe(100);
 expect(familyMatchScore('opus',opus5)).toBe(60);
 expect(familyMatchScore('anthropic opus',opus5)).toBe(40);
 expect(familyMatchScore('',opus5)).toBe(0);
});

test('the payload reader rejects bad shapes and skips unsafe rows', () => {
 expect(()=>readMatchupSearchIndex([])).toThrow();
 expect(()=>readMatchupSearchIndex({schema:'other',families:[],matchups:[]})).toThrow();
 const read=readMatchupSearchIndex({schema:MATCHUP_INDEX_SCHEMA,
  families:[{s:'ok',n:'Ok',p:'L',r:1,ids:['x']},{s:'Bad Slug',n:'B',p:'L',r:null,ids:[]},{s:'two',n:'Two',p:'L',r:null,ids:['y']}],
  matchups:[{u:'/compare/ok-vs-two',a:'ok',b:'two'},{u:'//evil.example/x',a:'ok',b:'two'},{u:'/compare/ok-vs-missing',a:'ok',b:'missing'}]});
 expect(read.families.map(f=>f.s)).toEqual(['ok','two']);
 expect(read.matchups.map(m=>m.u)).toEqual(['/compare/ok-vs-two']);
});

test('a matchup address with no page resolves to the current page or to Compare, and to nothing for unknown families',async()=>{
 const {resolveRetiredMatchup}=await import('./head-to-head-search');
 const index={families:[{s:'alpha',n:'Alpha',p:'Lab',r:1,ids:['a1','a2']},{s:'beta-vs-two',n:'Beta vs Two',p:'Lab',r:2,ids:['b1']},{s:'gamma',n:'Gamma',p:'Other',r:3,ids:['g1']}],
  matchups:[{u:'/compare/alpha-vs-gamma',a:'alpha',b:'gamma'}]};
 // Named in the other order, and with a trailing slash or extension: still the current page.
 expect(resolveRetiredMatchup('/compare/gamma-vs-alpha/',index)).toEqual({url:'/compare/alpha-vs-gamma',label:'Gamma vs Alpha'});
 expect(resolveRetiredMatchup('/compare/gamma-vs-alpha.html',index)?.url).toBe('/compare/alpha-vs-gamma');
 // No page any more: both families open in Compare. The slug itself contains "-vs-".
 const retired=resolveRetiredMatchup('/compare/alpha-vs-beta-vs-two',index)!;
 expect(retired.label).toBe('Compare Alpha and Beta vs Two');
 expect(retired.url.startsWith('/compare?')).toBe(true);
 for(const id of ['a1','a2','b1'])expect(retired.url).toContain('m='+id);
 expect(resolveRetiredMatchup('/compare/alpha-vs-unknown',index)).toBeNull();
 expect(resolveRetiredMatchup('/compare/alpha-vs-alpha',index)).toBeNull();
 expect(resolveRetiredMatchup('/models/alpha-vs-gamma',index)).toBeNull();
 expect(resolveRetiredMatchup('/compare',index)).toBeNull();
});
