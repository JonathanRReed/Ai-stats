import {expect,test} from 'bun:test';
import {expandSelectionToFamilies,reasoningRank} from './compare-family-lines';

const row=(id:string,family:string,reasoning:string,extra:Record<string,unknown>={})=>({id,family,reasoning,provider:'Lab',source:'aa' as const,current:true as boolean|null,...extra});
const catalog=[row('a-low','Alpha','low'),row('a-high','Alpha','high'),row('a-max','Alpha','max'),row('b-high','Beta','high'),row('b-low','Beta','low'),row('c','Gamma','unknown')];

test('a frontier record brings in every current reasoning level of its family, lowest effort first',()=>{
 expect(expandSelectionToFamilies(catalog,['a-high'])).toEqual(['a-high','a-low','a-max']);
 expect(expandSelectionToFamilies(catalog,['b-high','a-max'])).toEqual(['b-high','a-max','b-low','a-low','a-high']);
});

test('historical, unmeasured and other-source records are never added',()=>{
 const mixed=[...catalog,row('a-old','Alpha','medium',{current:false}),row('a-empty','Alpha','minimal',{detailAvailable:false}),row('or-a','Alpha','xhigh',{source:'openrouter'})];
 expect(expandSelectionToFamilies(mixed,['a-high'])).toEqual(['a-high','a-low','a-max']);
});

test('the frontier survives the limit and a family joins whole or not at all',()=>{
 expect(expandSelectionToFamilies(catalog,['a-high','b-high','c'],4)).toEqual(['a-high','b-high','c','b-low']);
 expect(expandSelectionToFamilies(catalog,['a-high','b-high'],1)).toEqual(['a-high']);
});

test('unknown ids are dropped and the input is not mutated',()=>{
 const ids=['missing','c'];
 expect(expandSelectionToFamilies(catalog,ids)).toEqual(['c']);
 expect(ids).toEqual(['missing','c']);
});

test('reasoning levels rank by effort with unrecorded levels last',()=>{
 expect(['max','unknown','none','xhigh','low'].sort((a,b)=>reasoningRank(a)-reasoningRank(b))).toEqual(['none','low','xhigh','max','unknown']);
});
