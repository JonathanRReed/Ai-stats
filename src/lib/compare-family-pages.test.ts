import {expect,test} from 'bun:test';
import {compareFamilyPage} from './compare-family-pages';
import {groupCompareFamilies} from './compare-families';
import type {ExplorerModel} from './compare-series';

const model=(id:string,family=id,name=id):ExplorerModel=>({id,name,family,provider:'Provider',source:'aa',sourceModelId:id,current:true,reasoning:'unknown'});

test('query results include variant names first while selected records remain represented',()=>{
 const rows=[model('selected','Aster','Aster balanced'),model('matching','Nova','Nova reasoning high'),model('other','Orchid','Orchid v2')];
 const selected=['selected'];
 const selectedGroups=groupCompareFamilies(rows,selected,'');
 const matches=groupCompareFamilies(rows,selected,'nova reasoning high');
 expect(matches.map(group=>group.family)).toEqual(['Nova']);
 expect(selectedGroups[0]?.selectedIds).toEqual(['selected']);
});

test('bounded family pages preserve order, clamp stale pages and expose all pages',()=>{
 const groups=groupCompareFamilies(Array.from({length:29},(_,index)=>model(`m${index}`,`Family ${index}`)),[]);
 expect(compareFamilyPage(groups,0,12).items.map(group=>group.family)).toEqual(groups.slice(0,12).map(group=>group.family));
 expect(compareFamilyPage(groups,1,12).items).toHaveLength(12);
 expect(compareFamilyPage(groups,99,12)).toEqual({page:2,pageCount:3,items:groups.slice(24)});
 expect(compareFamilyPage(groups,0,100).items).toHaveLength(29);
});
