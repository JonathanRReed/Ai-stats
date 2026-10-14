import {describe,expect,it} from 'bun:test';
import {suggestedModels} from './suggested-models';
const p=(id:string,x:number,y:number,extra:Record<string,unknown>={})=>({id,modelId:id,x,y,provider:id,family:id,cohortKey:'4.3:long',indexVersion:'4.3',...extra});
describe('suggestedModels',()=>{
 it('selects stable frontier endpoints and tradeoffs',()=>{const rows=Array.from({length:20},(_,i)=>p('m'+i,i,i));const ids=suggestedModels(rows);expect(ids).toHaveLength(8);expect(ids).toContain('m0');expect(ids).toContain('m19');expect(suggestedModels([...rows].reverse())).toEqual(ids);});
 it('chooses one cohort from the latest valid version',()=>{const rows=[p('old',1,100,{indexVersion:'4.2',cohortKey:'4.2:long'}),p('new-a',1,30),p('new-b',2,40),p('other',1,90,{cohortKey:'4.3:short'}),p('bad',0,200,{indexVersion:'latest'})];expect(new Set(suggestedModels(rows))).toEqual(new Set(['new-a','new-b']));});
 it('fills with measured diverse comparisons and handles higher-is-better X',()=>{const rows=[p('winner',1,100),...Array.from({length:10},(_,i)=>p('other'+i,i+2,90-i))];expect(suggestedModels(rows)).toHaveLength(8);expect(new Set(suggestedModels([p('fast',100,40),p('smart',10,100),p('slow',1,1)],'max',2))).toEqual(new Set(['fast','smart']));});
 it('keeps zero, excludes invalid points, deduplicates identities, and never pads',()=>{expect(suggestedModels([p('zero',0,120),p('neg',-1,200),p('nan',1,NaN)])).toEqual(['zero']);expect(suggestedModels([])).toEqual([]);expect(suggestedModels([p('a',1,10),p('a2',1,10,{modelId:'a'}),p('b',2,20)])).toHaveLength(2);});
 it('allows newly measured leaders to change future suggestions',()=>{const rows=Array.from({length:12},(_,i)=>p('m'+i,i+1,i+10));const before=suggestedModels(rows);expect(suggestedModels([...rows,p('leader',.5,100)])).toContain('leader');expect(suggestedModels(rows)).toEqual(before);});
});
