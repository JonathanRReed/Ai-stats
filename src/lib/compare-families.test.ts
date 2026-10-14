import {expect,test} from 'bun:test';
import {familySelectionState,groupCompareFamilies,toggleCompareFamilySelection} from './compare-families';
import type {ExplorerModel} from './compare-series';
const model=(id:string,extra:Partial<ExplorerModel>={}):ExplorerModel=>({id,name:id,family:'Opus',provider:'Anthropic',source:'aa',sourceModelId:id,current:true,reasoning:'unknown',...extra});

test('families are keyed by exact source, provider, and family while search includes variant names',()=>{
 const rows=[model('low',{name:'Opus 5.5 (Low)',reasoning:'low'}),model('high',{name:'Opus 5.5 (High)',reasoning:'high'}),model('route',{source:'openrouter',provider:'Anthropic',family:'Opus'})];
 expect(groupCompareFamilies(rows,[],'high')).toHaveLength(1);
 expect(groupCompareFamilies(rows,[])).toHaveLength(2);
});

test('selected exact IDs produce mixed state without expanding and family toggle stays scoped',()=>{
 const rows=[model('low',{reasoning:'low'}),model('high',{reasoning:'high'}),model('max',{reasoning:'max'})];
 const group=groupCompareFamilies(rows,['low'])[0];
 expect(familySelectionState(group)).toBe('mixed');
 expect(toggleCompareFamilySelection(['low'],rows.map(row=>row.id),true)).toEqual(['low','high','max']);
 expect(toggleCompareFamilySelection(['low','high','other'],rows.map(row=>row.id),false)).toEqual(['other']);
});
