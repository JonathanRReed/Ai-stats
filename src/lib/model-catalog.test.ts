import {expect,test} from 'bun:test';
import {catalogCoverage,catalogIndex} from './model-catalog';
import type {ExplorerModel} from './compare-series';
const aa:ExplorerModel={id:'uuid',name:'Same',family:'Same',source:'aa',sourceModelId:'uuid',current:true};
const route:ExplorerModel={id:'openrouter:lab/free',name:'Same',family:'Same',source:'openrouter',sourceModelId:'lab/free',current:true,priceInput:0};
test('coverage counts source records without inventing unique model totals',()=>{
 const result=catalogCoverage([aa,route,aa,{...aa,id:'old',current:false}]);
 expect(result.records).toBe(3);expect(result.historical).toBe(1);
 expect(result.sources).toEqual([{key:'aa',name:'Artificial Analysis',count:2},{key:'openrouter',name:'OpenRouter',count:1}]);
});
test('search preserves measured page URLs and gives other records exact comparison links',()=>{
 const result=catalogIndex([aa,route],[{id:'uuid',name:'Same',provider:'Lab',path:'/models/same',indexes:[]}]);
 expect(result[0].u).toBe('/models/same');expect(result[1].u).toBe('/compare?m=openrouter%3Alab%2Ffree&chart=price');
 expect(result[1].p).toContain('OpenRouter');expect(result[1].i).toBeNull();
});

test('partial source reads cannot be labelled a complete catalog',()=>{
 const result=catalogCoverage([aa],['OpenRouter']);
 expect(result.complete).toBe(false);expect(result.unavailableSources).toEqual(['OpenRouter']);
 expect(catalogCoverage([aa,route],[]).complete).toBe(true);
});

test('unknown AA membership stays explicit rather than being counted as current',()=>{
 expect(catalogCoverage([{...aa,current:null}])).toMatchObject({membershipUnverified:1,historical:0});
});
