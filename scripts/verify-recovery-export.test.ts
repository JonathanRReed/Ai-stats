import {describe,expect,it} from 'bun:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {digest,splitDocuments,verifyRecovery} from './verify-recovery-export.mjs';
describe('recovery row preservation',()=>{
 it('retains exact large integers, whitespace and escaped braces',()=>{
  const a=String.raw`{"id":9223372036854775807,"value":1.234567890123456789,"text":"}\"{","nested":[{"x":1}]}`;
  const b='{\n "id":2,"text":"line\\nnext"\n}';
  expect(splitDocuments(a+'\n'+b)).toEqual([a,b]);
 });
 it('rejects incomplete rows',()=>{expect(()=>splitDocuments('{"id":')).toThrow();});
 it('rejects invalid JSON',()=>{expect(()=>splitDocuments('{bad}')).toThrow();});
 it('uses raw UTF-8 checksums',()=>{expect(digest('')).toBe('d41d8cd98f00b204e9800998ecf8427e');expect(splitDocuments('{"emoji":"🐕"}')).toEqual(['{"emoji":"🐕"}']);});
});
it('rejects omitted manifest tables before loading an isolated database',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'recovery-coverage-test-'));
 try{
  await writeFile(path.join(dir,'start-manifest.json'),JSON.stringify({tables:[{table_name:'public.required'}]}));
  await writeFile(path.join(dir,'export-progress.json'),'[]');
  await expect(verifyRecovery(dir,'unused-module')).rejects.toThrow('Recovery table set is incomplete');
 }finally{await rm(dir,{recursive:true,force:true});}
});
