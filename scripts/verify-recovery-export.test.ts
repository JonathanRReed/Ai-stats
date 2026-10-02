import {describe,expect,it} from 'bun:test';
import {digest,splitDocuments} from './verify-recovery-export.mjs';
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