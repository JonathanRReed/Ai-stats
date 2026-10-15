import {expect,test} from 'bun:test';
import {BROWSE_RANK_POLICY,browseRankingFor,buildBrowseRanks,decodeRankIndices,validateBrowseRanks} from './compare-browse-rank';
import {compactCatalog,expandCatalog} from './compare-delivery';
import {compareFamilyKey} from './compare-families';
import type {ExplorerModel} from './compare-series';
import type {EpochObservation} from './epoch-observations';

const aa=(id:string,family:string,extra:Partial<ExplorerModel>={}):ExplorerModel=>({id,name:family,family,provider:'Lab',source:'aa',sourceModelId:id,current:true,indexVersion:'4.3',...extra});
const epoch=(id:string,family:string,extra:Partial<ExplorerModel>={}):ExplorerModel=>({id:'epoch:'+id,name:family,family,provider:'Lab',source:'epoch',sourceModelId:id,current:true,...extra});
const obs=(modelVersion:string,value:number,extra:Partial<EpochObservation>={}):EpochObservation=>({id:modelVersion+':'+value,modelVersion,benchmarkSlug:'frontiermath',benchmarkVersion:'v1',metricKey:'accuracy',unit:'percent',value,
 conditions:{shots:0},evaluationDate:'2026-09-01',sourceUrl:null,fetchedAt:null,snapshotId:null,sourceKey:'epoch-ai',...extra});
const families=(rows:ExplorerModel[],keys:string[]|null)=>keys?.map(key=>rows.find(row=>compareFamilyKey(row)===key)!.family)??null;

const rows=[
 aa('coder','Coder',{intelligence:50,coding:95,metrics:{gpqa:40}}),
 aa('thinker','Thinker',{intelligence:90,coding:60,metrics:{gpqa:88}}),
 aa('middle','Middle',{intelligence:70,coding:70,metrics:{gpqa:null}}),
 aa('retired','Retired',{intelligence:99,coding:99,current:false}),
 epoch('e-high','Epoch High'),epoch('e-low','Epoch Low'),epoch('e-other','Epoch Other'),
];
const compact=compactCatalog(rows),catalog=expandCatalog(compact);
const rank=(chart:string,metricId:string,extra:Partial<Parameters<typeof browseRankingFor>[0]>={})=>browseRankingFor({models:catalog,ranks:compact.browseRanks,chart,metricId,...extra});

test('benchmark ranking follows the active AA metric, not always the Intelligence Index',()=>{
 expect(families(catalog,rank('benchmark','aa_intelligence_index').keys)).toEqual(['Thinker','Middle','Coder']);
 expect(families(catalog,rank('benchmark','aa_coding_index').keys)).toEqual(['Coder','Middle','Thinker']);
 // A record without a GPQA measurement is not ranked as if it had one.
 expect(families(catalog,rank('benchmark','gpqa').keys)).toEqual(['Thinker','Coder']);
 expect(rank('benchmark','aa_coding_index').basis).toContain('Coding Index');
 // Historical records never outrank current measured ones.
 expect(families(catalog,rank('benchmark','aa_intelligence_index').keys)).not.toContain('Retired');
});

test('Epoch ranking uses the loaded benchmark asset, its score direction and one comparable cohort',()=>{
 const observations=[obs('e-high',80),obs('e-low',20),obs('e-other',99,{unit:'native',metricKey:'elo'})];
 expect(rank('benchmark','epoch_frontiermath').keys).toBeNull();
 expect(rank('benchmark','epoch_frontiermath').basis).toContain('appears when its results load');
 // Two score units are recorded: refuse to rank them together until one is chosen.
 const mixed=rank('benchmark','epoch_frontiermath',{observations});
 expect(mixed.keys).toBeNull();expect(mixed.basis).toContain('different score metrics');
 const percent=rank('benchmark','epoch_frontiermath',{observations,scoreMetricKey:'["accuracy","percent","v1"]',conditionKey:'[["shots",0]]'});
 expect(families(catalog,percent.keys)).toEqual(['Epoch High','Epoch Low']);
 expect(percent.basis).toContain('higher is better');
 const lowerBetter=rank('benchmark','epoch_btf3_external',{observations:observations.map(row=>({...row,benchmarkSlug:'btf3_external'})),scoreMetricKey:'["accuracy","percent","v1"]',conditionKey:'[["shots",0]]'});
 expect(families(catalog,lowerBetter.keys)).toEqual(['Epoch Low','Epoch High']);
 expect(lowerBetter.basis).toContain('lower is better');
});

test('Epoch runs with different test settings are not ranked together',()=>{
 const observations=[obs('e-high',80,{conditions:{shots:5}}),obs('e-low',20)];
 const unset=rank('benchmark','epoch_frontiermath',{observations,scoreMetricKey:'["accuracy","percent","v1"]',conditionKey:null});
 expect(unset.keys).toBeNull();expect(unset.basis).toContain('different test settings');
 const zeroShot=rank('benchmark','epoch_frontiermath',{observations,scoreMetricKey:'["accuracy","percent","v1"]',conditionKey:'[["shots",0]]'});
 expect(families(catalog,zeroShot.keys)).toEqual(['Epoch Low']);
});

test('switching benchmarks changes ranks without depending on loaded measurement chunks',()=>{
 const intelligence=families(catalog,rank('benchmark','aa_intelligence_index').keys);
 const coding=families(catalog,rank('benchmark','aa_coding_index').keys);
 // Late measurement load: replace the compact rows with fully measured ones; ranks are unchanged.
 const loaded=catalog.map(model=>rows.find(row=>row.id===model.id)??model);
 expect(families(loaded,browseRankingFor({models:loaded,ranks:compact.browseRanks,chart:'benchmark',metricId:'aa_intelligence_index'}).keys)).toEqual(intelligence);
 expect(families(loaded,browseRankingFor({models:loaded,ranks:compact.browseRanks,chart:'benchmark',metricId:'aa_coding_index'}).keys)).toEqual(coding);
 expect(intelligence).not.toEqual(coding);
});

test('AA ranks never order scores from different index versions against each other',()=>{
 const versions=[aa('new-a','New A',{intelligence:60,aaTaskCost:1,indexVersion:'4.3'}),aa('new-b','New B',{intelligence:55,aaTaskCost:1,indexVersion:'4.3'}),
  aa('old-a','Old A',{intelligence:99,aaTaskCost:1,indexVersion:'3'})];
 const ranks=buildBrowseRanks(versions);
 expect(ranks.ranks['task-cost'][0]).toBe('4.3');
 expect(decodeRankIndices(ranks.ranks['task-cost'][1])).toEqual([0,1]);
 const result=browseRankingFor({models:versions,ranks,chart:'task-cost',metricId:'aa_intelligence_index'});
 expect(result.basis).toContain('index version 4.3');
});

test('rank validation rejects foreign policies, unknown keys, duplicates and non-representative rows',()=>{
 const two=[aa('a','A',{intelligence:2,aaTaskCost:1}),aa('a2','A',{intelligence:3,aaTaskCost:1}),aa('b','B',{intelligence:1,aaTaskCost:1})];
 const valid=buildBrowseRanks(two);
 expect(validateBrowseRanks(valid,two)).toEqual(valid);
 expect(decodeRankIndices(valid.ranks['task-cost'][1])).toEqual([0,2]);
 expect(()=>validateBrowseRanks({...valid,policy:'compare-browse-rank.v1'},two)).toThrow();
 expect(()=>validateBrowseRanks({policy:BROWSE_RANK_POLICY,ranks:{benchmark:['4.3','0']}},two)).toThrow();
 expect(()=>validateBrowseRanks({policy:BROWSE_RANK_POLICY,ranks:{'task-cost':['4.3','0.0']}},two)).toThrow();
 expect(()=>validateBrowseRanks({policy:BROWSE_RANK_POLICY,ranks:{'task-cost':['4.3','1']}},two)).toThrow();
 expect(()=>validateBrowseRanks({policy:BROWSE_RANK_POLICY,ranks:{'task-cost':['4.3','9']}},two)).toThrow();
 expect(()=>validateBrowseRanks({policy:BROWSE_RANK_POLICY,ranks:{'task-cost':['latest','0']}},two)).toThrow();
});

test('compact rank payload stays small: ranked AA families only, base-36 row indices',()=>{
 const many:ExplorerModel[]=[
  ...Array.from({length:600},(_,index)=>aa('aa'+index,'AA '+index,{intelligence:index%97,coding:index%89,aaTaskCost:1,priceBlended:1,outputSpeed:10,aaEvaluationCost:1,priceInput:1,metrics:{gpqa:index%83}})),
  ...Array.from({length:6000},(_,index)=>({...epoch('x'+index,'Other '+index),source:'litellm' as const,id:'litellm:x'+index})),
 ];
 const catalog=compactCatalog(many);
 const rankBytes=JSON.stringify(catalog.browseRanks).length,rowBytes=JSON.stringify(catalog.rows).length;
 // 600 ranked families × (5 charts + price + 3 metrics) ≈ 5.4k indices; must stay a small fraction of the catalog.
 expect(rankBytes).toBeLessThan(rowBytes*.06);
 expect(rankBytes).toBeLessThan(600*9*4.2);
});
