import {test,expect} from 'bun:test';import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {retainFailedArtifacts} from './collect-direct-benchmarks.mjs';
const snapshot={schemaVersion:1,sourceKey:'weirdml',fetchedAt:'2026-10-02T00:00:00Z',observedAt:null,benchmarkVersion:'v3',sourceUrl:'https://htihle.github.io/weirdml.html',records:[{systemId:'w',modelId:'m',label:'M',benchmarkSlug:'weirdml',benchmarkVersion:'v3',metric:'Composite',unit:'fraction',score:.4,higherIsBetter:true,conditions:{},evaluatedAt:null,sourceUrl:'https://htihle.github.io/weirdml.html'}]};
test('failed feed retains validated evidence and original dates while healthy feeds can advance',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'retain-publisher-'));try{
 await writeFile(join(dir,'weirdml.json'),JSON.stringify(snapshot));
 const result=await retainFailedArtifacts([{source:'weirdml',status:'unavailable',error:'503'},{source:'livebench',status:'ready'}],dir,'2026-10-03T16:00:00Z');
 const retained=JSON.parse(await readFile(join(dir,'weirdml.json'),'utf8'));expect(result[0].status).toBe('retained');expect(result[1].status).toBe('ready');expect(retained.fetchedAt).toBe(snapshot.fetchedAt);expect(retained.lastAttemptAt).toBe('2026-10-03T16:00:00Z');expect(retained.refreshStatus).toBe('failed');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('invalid last-good artifacts cannot permit a partial publication',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'retain-publisher-'));try{
 await writeFile(join(dir,'weirdml.json'),'{}');await expect(retainFailedArtifacts([{source:'weirdml',status:'unavailable'}],dir)).rejects.toThrow();
 }finally{await rm(dir,{recursive:true,force:true});}
});
