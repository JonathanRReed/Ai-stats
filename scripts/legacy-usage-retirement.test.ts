import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {getOpenRouterUsageRankings} from '../src/lib/supabase';
test('legacy usage output remains compatible without fetching HTML or inventing weekly totals',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=(async()=>{calls++;return new Response('<html></html>');}) as unknown as typeof fetch;
 try{expect(await getOpenRouterUsageRankings()).toEqual([]);expect(calls).toBe(0);}
 finally{globalThis.fetch=original;}
});
test('catalog tables do not offer unsupported weekly tokens or request counts',()=>{
 const source=readFileSync('src/components/Dashboard.astro','utf8');
 expect(source).not.toContain('OpenRouter weekly usage');
 expect(source).not.toContain('{ key: "usage", label: "Usage tokens"');
 expect(source).not.toContain('{ key: "requests", label: "Usage requests"');
 expect(source).toContain('id="openrouter-col-value">Catalog models');
});
