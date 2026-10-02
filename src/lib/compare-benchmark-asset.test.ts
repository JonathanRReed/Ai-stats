import {expect,test} from 'bun:test';
import {validateBenchmarkAsset} from './compare-benchmark-asset';
import {fromEpochRuns} from './compare-evidence';
import snapshot from '../../public/data/epoch-benchmark-snapshot.json';
const row={id:'row',modelVersion:'version',benchmarkSlug:'test',metricKey:'score',unit:'native' as const,value:1,conditions:{shots:5},evaluationDate:null,sourceUrl:'https://example.com/run',fetchedAt:'2026-10-02T12:00:00Z',snapshotId:null};
const asset=()=>({schemaVersion:1,slug:'test',name:'Test',fetchedAt:row.fetchedAt,observations:[structuredClone(row)]});
test('complete benchmark evidence retains conditions and original source metadata',()=>{
 expect(validateBenchmarkAsset(asset(),'test')).toEqual([row]);
 for(const bad of [undefined,[],{shots:Infinity},{shots:[]}])expect(()=>validateBenchmarkAsset({...asset(),observations:[{...row,conditions:bad}]},'test')).toThrow();
 expect(()=>validateBenchmarkAsset({...asset(),observations:[row,row]},'test')).toThrow();
 expect(()=>validateBenchmarkAsset({...asset(),observations:[{...row,fetchedAt:null}]},'test')).toThrow();
});
test('checked Epoch snapshot satisfies the shared browser and publisher contract',()=>{
 const observations=fromEpochRuns(snapshot.runs as Parameters<typeof fromEpochRuns>[0],snapshot.fetched_at);
 for(const slug of new Set(observations.map(row=>row.benchmarkSlug))){
 const rows=observations.filter(row=>row.benchmarkSlug===slug);
 expect(validateBenchmarkAsset({schemaVersion:1,slug,name:slug,fetchedAt:snapshot.fetched_at,observations:rows},slug)).toHaveLength(rows.length);
 }
});
