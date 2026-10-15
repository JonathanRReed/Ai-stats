import {expect,test} from 'bun:test';
import {compareCatalogScope,compareFamilyKey,familySelectionState,groupCompareFamilies,toggleCompareFamilySelection} from './compare-families';
import type {ExplorerModel} from './compare-series';
import {browseRankingFor,buildBrowseRanks} from './compare-browse-rank';
import {compactCatalog,expandCatalog} from './compare-delivery';
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
 expect(toggleCompareFamilySelection(Array.from({length:99},(_,index)=>'x'+index),['one','two'],true,100)).toHaveLength(99);
 expect(toggleCompareFamilySelection(['low','high','other'],rows.map(row=>row.id),false)).toEqual(['other']);
});

test('picker defaults to chart-compatible sources, keeps explicit selections, and exposes all catalog on request',()=>{
 const rows=[model('aa'),model('route',{source:'openrouter',priceInput:0,priceOutput:2}),model('hf',{source:'huggingface'}),model('epoch',{source:'epoch'})];
 expect(compareCatalogScope(rows,'cost-intelligence','aa_intelligence_index',[]).map(row=>row.id)).toEqual(['aa']);
 expect(compareCatalogScope(rows,'cost-intelligence','aa_intelligence_index',['hf']).map(row=>row.id)).toEqual(['aa','hf']);
 expect(compareCatalogScope(rows,'price','aa_intelligence_index',[]).map(row=>row.id)).toEqual(['route']);
 expect(compareCatalogScope(rows,'benchmark','epoch_gpqa',[]).map(row=>row.id)).toEqual(['epoch']);
 expect(compareCatalogScope(rows,'cost-intelligence','aa_intelligence_index',[],true)).toHaveLength(4);
});

test('price and Epoch scopes use compact capability flags and preserve publisher records',()=>{
 const rows=[
  model('price-only',{source:'aa',priceInput:undefined,priceOutput:undefined,hasTokenPrices:true}),
  model('publisher',{source:'publisher',sourceModelId:'bench-id'}),
  model('epoch',{source:'epoch',sourceModelId:'epoch-id'}),
 ];
 expect(compareCatalogScope(rows,'price','aa_intelligence_index',[]).map(row=>row.id)).toEqual(['price-only']);
 expect(compareCatalogScope(rows,'benchmark','epoch_aider',[]).map(row=>row.id)).toEqual(['publisher','epoch']);
});

const ranked=(rows:ExplorerModel[],chart='task-cost',metricId='aa_intelligence_index')=>browseRankingFor({models:rows,ranks:buildBrowseRanks(rows),chart,metricId});
test('recommended browse order ranks stronger current families before older alphabetical names',()=>{
 const rows=[
  model('claude2',{name:'Claude 2',family:'Claude 2',intelligence:40,aaTaskCost:1,priceBlended:2,indexVersion:'4.3'}),
  model('claude55',{name:'Claude 5.5',family:'Claude 5.5',intelligence:90,aaTaskCost:2,priceBlended:4,indexVersion:'4.3'}),
  model('old',{name:'Claude 3',family:'Claude 3',current:false,intelligence:70,aaTaskCost:1,priceBlended:3,indexVersion:'4.3'}),
  model('unmeasured',{name:'Zeta',family:'Zeta'}),
 ];
 const keys=ranked(rows).keys!;
 expect(keys).toEqual([compareFamilyKey(rows[1]),compareFamilyKey(rows[0])]);
 const groups=groupCompareFamilies(rows,[],'',[],{sort:'recommend',browseOrder:keys});
 expect(groups.map(group=>group.family)).toEqual(['Claude 5.5','Claude 2','Claude 3','Zeta']);
 const alpha=groupCompareFamilies(rows,[],'',[],{sort:'alpha',browseOrder:keys});
 expect(alpha.map(group=>group.family)).toEqual(['Claude 2','Claude 3','Claude 5.5','Zeta']);
});

test('search keeps exact old-model matches findable while broad Claude prefers stronger families',()=>{
 const rows=[
  model('c2',{name:'Claude 2',family:'Claude 2',intelligence:30,aaTaskCost:1,indexVersion:'4.3'}),
  model('c55',{name:'Claude 5.5',family:'Claude 5.5',intelligence:95,aaTaskCost:2,indexVersion:'4.3'}),
 ];
 const order=ranked(rows).keys;
 const broad=groupCompareFamilies(rows,[],'Claude',[],{browseOrder:order});
 expect(broad.map(group=>group.family)).toEqual(['Claude 5.5','Claude 2']);
 const exact=groupCompareFamilies(rows,[],'Claude 2',[],{browseOrder:order});
 expect(exact[0].family).toBe('Claude 2');
});

test('browse ranking uses release ranks and ignores which measurements happen to be loaded',()=>{
 const full=[model('strong',{family:'Strong',intelligence:99,aaTaskCost:1,indexVersion:'4.3'}),model('weak',{family:'Weak',intelligence:10,aaTaskCost:1,indexVersion:'4.3'})];
 const catalog=compactCatalog(full),compactOnly=expandCatalog(catalog);
 // Loaded state 1: nothing loaded. Loaded state 2: only the weak record's chunk loaded.
 for(const loaded of [compactOnly,[compactOnly[0],full[1]]]){
  const order=browseRankingFor({models:loaded,ranks:catalog.browseRanks,chart:'task-cost',metricId:'aa_intelligence_index'}).keys;
  expect(groupCompareFamilies(loaded,[],'',[],{browseOrder:order}).map(group=>group.family)).toEqual(['Strong','Weak']);
 }
});

test('without rank metadata the family list is alphabetical and never pretends to be recommended',()=>{
 const rows=[model('z',{family:'Zed',intelligence:99,aaTaskCost:1,indexVersion:'4.3'}),model('a',{family:'Alpha',intelligence:1,aaTaskCost:1,indexVersion:'4.3'})];
 const missing=browseRankingFor({models:rows,ranks:null,chart:'task-cost',metricId:'aa_intelligence_index'});
 expect(missing.keys).toBeNull();
 expect(missing.basis).toContain('alphabetically');
 expect(groupCompareFamilies(rows,[],'',[],{sort:'recommend',browseOrder:missing.keys}).map(group=>group.family)).toEqual(['Alpha','Zed']);
});
