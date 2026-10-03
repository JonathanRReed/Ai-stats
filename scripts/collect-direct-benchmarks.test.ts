import {test,expect} from 'bun:test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {collectDirectBenchmarks,writeDirectArtifacts} from './collect-direct-benchmarks.mjs';
test('a failed publisher is explicit and cannot overwrite its last-good artifact',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'publisher-test-'));
 try{
  await writeFile(join(dir,'weirdml.json'),'last-good');
  const results=await collectDirectBenchmarks({sources:['weirdml'],fetchImpl:async()=>new Response('rate limited',{status:429})});
  expect(results[0].status).toBe('unavailable');
  await writeDirectArtifacts(results,dir);
  expect(await readFile(join(dir,'weirdml.json'),'utf8')).toBe('last-good');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('publisher identity is allowlisted before any fetch',async()=>{
 let calls=0;
 await expect(collectDirectBenchmarks({sources:['unknown'],fetchImpl:async()=>{calls++;return new Response('{}');}})).rejects.toThrow();
 expect(calls).toBe(0);
});
