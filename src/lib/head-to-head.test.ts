import {expect,test} from 'bun:test';
import type {ExplorerModel} from './compare-series';
import {
 assignFamilySlugs,buildH2HChart,buildH2HFamilies,compareHrefFor,createMatchupLookup,gapDifference,latestIndexVersion,
 matchLevels,matchupTitle,matchupsFor,percentOf,ratioDifference,selectMatchups,sharedBenchmarks,strongestRecord,
} from './head-to-head';
import {compareHrefForFamilies} from './head-to-head-search';
import {parseCompareState} from './compare-state';

let n=0;
const rec=(family:string,provider:string,reasoning:string,intelligence:number|null,extra:Partial<ExplorerModel>={}):ExplorerModel=>({
 id:`id-${++n}`,name:reasoning==='unknown'?family:`${family} (${reasoning})`,family,provider,reasoning,source:'aa',sourceModelId:`id-${n}`,
 current:true,intelligence,indexVersion:'5',aaTaskCost:1,priceBlended:2,...extra,
});
const names={a:'Alpha',b:'Beta'};

test('families group current AA records and rank by their highest Index on the newest version', () => {
 const families=buildH2HFamilies([
  rec('Alpha','LabA','low',30),rec('Alpha','LabA','high',50),
  rec('Beta','LabB','high',55,{indexVersion:'4'}),rec('Beta','LabB','low',20),
  rec('Gamma','LabC','high',null),
  rec('Old','LabC','high',90,{current:false}),
  {...rec('Epoch','LabD','unknown',99),source:'epoch'},
 ]);
 expect(families.map(f=>[f.name,f.topIndex,f.rank])).toEqual([['Alpha',50,1],['Beta',20,2],['Gamma',null,null]]);
 expect(families[0].records.map(r=>r.reasoning)).toEqual(['low','high']);
 expect(latestIndexVersion([rec('A','L','x',1,{indexVersion:'10'}),rec('B','L','x',1,{indexVersion:'9'})])).toBe('10');
});

test('colliding family slugs are disambiguated deterministically', () => {
 const slugs=assignFamilySlugs([
  {key:'k1',name:'Nova',provider:'Lab One'},{key:'k2',name:'Nova',provider:'Lab Two'},
  {key:'k3',name:'Command A+',provider:'Cohere'},{key:'k4',name:'Command A',provider:'Cohere'},
  {key:'k5',name:'Solo',provider:'X'},
 ]);
 expect(slugs.get('k1')).toBe('nova-lab-one');
 expect(slugs.get('k2')).toBe('nova-lab-two');
 expect(slugs.get('k4')).toBe('command-a');
 expect(slugs.get('k3')).toBe('command-a-plus');
 expect(slugs.get('k5')).toBe('solo');
 // Same result whatever the input order.
 const reversed=assignFamilySlugs([
  {key:'k5',name:'Solo',provider:'X'},{key:'k4',name:'Command A',provider:'Cohere'},{key:'k3',name:'Command A+',provider:'Cohere'},
  {key:'k2',name:'Nova',provider:'Lab Two'},{key:'k1',name:'Nova',provider:'Lab One'},
 ]);
 expect([...reversed].sort()).toEqual([...slugs].sort());
 // Identical names in one lab fall back to numeric suffixes in key order.
 const twins=assignFamilySlugs([{key:'b',name:'Twin',provider:'L'},{key:'a',name:'Twin',provider:'L'}]);
 expect([twins.get('a'),twins.get('b')]).toEqual(['twin','twin-2']);
});

test('pair selection: all top pairs plus same-lab pairs in the wider pool, slugs sorted in the path', () => {
 const records=[
  rec('Zeta','LabA','high',90),rec('Alpha','LabB','high',80),rec('Mu','LabA','high',70),
  rec('Nu','LabC','high',60),rec('Xi','LabA','high',50),rec('Omicron','LabD','high',40),rec('NoIndex','LabA','high',null),
 ];
 const families=buildH2HFamilies(records);
 const matchups=selectMatchups(families,3,5);
 const paths=matchups.map(m=>m.path).sort();
 expect(paths).toEqual([
  '/compare/alpha-vs-mu','/compare/alpha-vs-zeta','/compare/mu-vs-xi','/compare/mu-vs-zeta','/compare/xi-vs-zeta',
 ]);
 const zetaMu=matchups.find(m=>m.path==='/compare/mu-vs-zeta')!;
 expect(zetaMu.a.slug).toBe('mu');expect(zetaMu.reason).toBe('top-and-lab');
 expect(matchups.find(m=>m.path==='/compare/xi-vs-zeta')!.reason).toBe('lab');
 expect(new Set(paths).size).toBe(paths.length);
 const lookup=createMatchupLookup(matchups);
 expect(lookup.has('zeta','mu')).toBe(true);
 expect(lookup.has('mu','zeta')).toBe(true);
 expect(lookup.has('nu','zeta')).toBe(false);
 expect(lookup.has('mu','mu')).toBe(false);
 expect(matchupsFor('zeta',matchups,families,'/compare/mu-vs-zeta').map(m=>m.opponent.slug)).toEqual(['alpha','xi']);
});

test('levels match only where both families recorded the same level; nothing is dropped', () => {
 const a=[rec('A','L','low',10),rec('A','L','high',30),rec('A','L','max',40),rec('A','L','max',null,{name:'A (Special, max)'})];
 const b=[rec('B','M','high',35),rec('B','M','max',45),rec('B','M','none',5),rec('B','M','unknown',7)];
 const match=matchLevels(a,b);
 expect(match.shared.map(row=>[row.level,row.a.intelligence,row.b.intelligence])).toEqual([['high',30,35],['max',40,45]]);
 expect(match.onlyA.map(u=>[u.record.reasoning,u.why])).toEqual([['low','level-only-here'],['max','extra-variant']]);
 expect(match.onlyB.map(u=>[u.record.reasoning,u.why])).toEqual([['none','level-only-here'],['unknown','level-not-recorded']]);
 const total=match.shared.length*2+match.onlyA.length+match.onlyB.length;
 expect(total).toBe(a.length+b.length);
});

test('unrecorded levels never match each other', () => {
 const match=matchLevels([rec('A','L','unknown',10)],[rec('B','M','unknown',12)]);
 expect(match.shared).toEqual([]);
 expect(match.onlyA).toHaveLength(1);expect(match.onlyB).toHaveLength(1);
});

test('strongest record is the highest Index, ties broken by lower task cost', () => {
 const x=rec('A','L','high',50,{aaTaskCost:5}),y=rec('A','L','max',50,{aaTaskCost:3}),z=rec('A','L','low',null);
 expect(strongestRecord([x,y,z])?.id).toBe(y.id);
 expect(strongestRecord([z])).toBeNull();
});

test('point gaps name the higher side and need both values', () => {
 expect(gapDifference(59.1,54.9,names)?.text).toBe('Alpha 4.2 points higher');
 expect(gapDifference(50,51,names)).toMatchObject({subject:'b',text:'Beta 1 point higher'});
 expect(gapDifference(50.04,50,names)?.subject).toBeNull();
 expect(gapDifference(null,50,names)).toBeNull();
 expect(gapDifference(50,undefined,names)).toBeNull();
 expect(gapDifference(Number.NaN,50,names)).toBeNull();
});

test('ratios state the smaller side as a share of the larger and need both values', () => {
 expect(ratioDifference(6.2,10,names,'price')).toMatchObject({subject:'a',text:'Alpha: 62% of the price'});
 expect(ratioDifference(10,2.5,names,'cost')?.text).toBe('Beta: 25% of the cost per task');
 expect(ratioDifference(3,3,names,'speed')).toMatchObject({subject:null,text:'Same'});
 expect(ratioDifference(0,3,names,'price')?.text).toBe('Alpha is recorded at zero');
 expect(ratioDifference(null,3,names,'price')).toBeNull();
 expect(ratioDifference(3,null,names,'latency')).toBeNull();
 expect(ratioDifference(-1,3,names,'price')).toBeNull();
 expect(percentOf(0.995)).toBe('99.5%');
 expect(percentOf(0.0004)).toBe('under 0.1%');
 expect(percentOf(0.05)).toBe('5%');
 expect(percentOf(0.623)).toBe('62%');
});

test('chart uses task cost only when both families have it, and lists what it cannot plot', () => {
 const a={name:'A',records:[rec('A','L','high',50,{aaTaskCost:2}),rec('A','L','low',30,{aaTaskCost:null}),rec('A','L','none',null)]};
 const b={name:'B',records:[rec('B','M','high',40,{aaTaskCost:0})]};
 const blended=buildH2HChart(a,b);
 expect(blended.axis).toBe('blended-price');
 expect(blended.points).toHaveLength(3);
 const c={name:'C',records:[rec('C','M','high',45,{aaTaskCost:4}),rec('C','M','low',20,{aaTaskCost:0})]};
 const task=buildH2HChart(a,c);
 expect(task.axis).toBe('task-cost');
 expect(task.points.map(p=>[p.side,p.x])).toEqual([['a',2],['b',4]]);
 expect(task.unplotted.map(u=>u.side)).toEqual(['a','b']);
 expect(task.unplotted[1].reason).toContain('$0');
});

test('benchmarks appear only when both records have a score, each on its own scale', () => {
 const a=rec('A','L','high',50,{metrics:{aa_intelligence_index:50,gpqa:0.81,hle:0.2,aa_coding_index:40}});
 const b=rec('B','M','high',48,{metrics:{aa_intelligence_index:48,gpqa:0.78,hle:null,aa_coding_index:44.5}});
 const rows=sharedBenchmarks(a,b,names);
 expect(rows.map(r=>[r.key,r.scale])).toEqual([['aa_coding_index','points'],['gpqa','percent']]);
 expect(rows[1].difference.text).toBe('Alpha 3 percentage points higher');
 expect(rows[0].difference.text).toBe('Beta 4.5 points higher');
});

test('compare links select both families and round-trip through the compare state parser', () => {
 const href=compareHrefFor(['x','y','z']);
 const params=new URLSearchParams(href.split('?')[1]);
 expect(params.get('chart')).toBe('task-cost');
 expect(params.getAll('m')).toEqual(['x','y','z']);
 const state=parseCompareState(params,[{id:'x'},{id:'y'},{id:'z'}]);
 expect(state.modelIds).toEqual(['x','y','z']);
 expect(state.scale).toBe('log');
 // The palette's import-free builder produces the same link.
 expect(compareHrefForFamilies({s:'a',n:'A',p:'L',r:1,ids:['x','y']},{s:'b',n:'B',p:'M',r:2,ids:['z']})).toBe(href);
});

test('titles stay specific and bounded', () => {
 expect(matchupTitle('Claude Opus 5.5','GPT-6 Astra')).toBe('Claude Opus 5.5 vs GPT-6 Astra: price, speed and AA Index | AI Stats');
 expect(matchupTitle('DeepSeek V4.1 Flash 1017','Qwen3.8-Flash-Next')).toBe('DeepSeek V4.1 Flash 1017 vs Qwen3.8-Flash-Next | AI Stats');
 expect(matchupTitle('A very long family name indeed','Another very long family name here')).toBe('A very long family name indeed vs Another very long family name here');
});
