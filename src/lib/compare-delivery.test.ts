import {expect,test} from 'bun:test';
import {compactCatalog,expandCatalog,measurementBucket,validateMeasurementChunk} from './compare-delivery';
import type {ExplorerModel} from './compare-series';
import {BROWSE_RANK_POLICY} from './compare-browse-rank';
const models:ExplorerModel[]=Array.from({length:200},(_,i)=>({id:'litellm:lab/'+i,source:'litellm',sourceModelId:'lab/'+i,name:'Model '+i,family:'Model '+i,provider:'Lab',reasoning:'unknown',current:true,priceInput:.001,priceOutput:.002,sourceUrl:'https://models.litellm.ai/',observedAt:null,fetchedAt:'2026-10-02'}));
test('compact catalog keeps all source identities and search facets without measurements',()=>{
 const payload=compactCatalog(models),rows=expandCatalog(payload);
 expect(rows).toHaveLength(200);
 expect(rows[199]).toMatchObject({id:'litellm:lab/199',sourceModelId:'lab/199',provider:'Lab',hasTokenPrices:true,detailAvailable:true});
 expect(rows[199].priceInput).toBeUndefined();
 expect(JSON.stringify(payload).length).toBeLessThan(JSON.stringify(models).length*.55);
});
test('catalog roundtrip preserves history, membership unknown and source-native exceptions',()=>{
 const rows:ExplorerModel[]=[{...models[0],id:'uuid',source:'aa',sourceModelId:'uuid',slug:'a-high',current:false,family:'A',reasoning:'high'},
 {...models[1],id:'catalog:x',source:'catalog',sourceModelId:'custom-native',current:null}];
 expect(expandCatalog(compactCatalog(rows))).toMatchObject(rows.map(row=>({id:row.id,name:row.name,source:row.source,sourceModelId:row.sourceModelId,current:row.current,family:row.family,reasoning:row.reasoning})));
});
test('measurement chunks reject mismatched revisions, foreign identities and malformed values',()=>{
 const bucket=measurementBucket(models[0].id);const rows=models.filter(row=>measurementBucket(row.id)===bucket);
 const known=expandCatalog(compactCatalog(models));
 const payload={schemaVersion:1,revision:'abc',bucket,records:rows};
 expect(validateMeasurementChunk(payload,'abc',bucket,known)).toEqual(rows);
 expect(()=>validateMeasurementChunk({...payload,revision:'old'},'abc',bucket,known)).toThrow();
 expect(()=>validateMeasurementChunk({...payload,records:[{...rows[0],source:'aa'}]},'abc',bucket,known)).toThrow();
 expect(()=>validateMeasurementChunk({...payload,records:[{...rows[0],priceInput:'0'}]},'abc',bucket,known)).toThrow();
 expect(()=>validateMeasurementChunk({...payload,records:[]},'abc',bucket,known)).toThrow();
 for(const malformed of [{family:{}},{observedAt:42},{reasoning:[]},{indexVersion:4.3},{metrics:false},{metrics:0},{metrics:''}])expect(()=>validateMeasurementChunk({...payload,records:[{...rows[0],...malformed},...rows.slice(1)]},'abc',bucket,known)).toThrow();
});

test('compact catalog carries revision-consistent browse ranks without restoring measurement fields',()=>{
 const ranked:ExplorerModel[]=[
  {...models[0],id:'aa:c2',source:'aa',sourceModelId:'c2',name:'Claude 2',family:'Claude 2',intelligence:40,aaTaskCost:1,priceBlended:2,indexVersion:'4.3'},
  {...models[1],id:'aa:c55',source:'aa',sourceModelId:'c55',name:'Claude 5.5',family:'Claude 5.5',intelligence:99,aaTaskCost:2,priceBlended:4,indexVersion:'4.3'},
 ];
 const payload=compactCatalog(ranked);
 expect(payload.browseRanks?.policy).toBe(BROWSE_RANK_POLICY);
 expect(payload.browseRanks?.ranks['task-cost']).toEqual(['4.3','1.0']);
 expect(expandCatalog(payload)[0].intelligence).toBeUndefined();
 expect(JSON.stringify(payload).length).toBeLessThan(JSON.stringify(ranked).length*2);
 // The rank contract is explicit even when nothing can be ranked.
 expect(compactCatalog(models).browseRanks).toEqual({policy:BROWSE_RANK_POLICY,ranks:{}});
});
