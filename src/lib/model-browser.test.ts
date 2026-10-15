import {expect,test} from 'bun:test';
import {selectBrowserModels,validateBrowserPayload} from './model-browser';
import type {AaModel} from './supabase';
test('full browser keeps free and missing-price models while ordering measured current records',()=>{
 const rows=[{id:'paid',name:'Paid',aa_intelligence_index:40,price_1m_input_tokens:1},{id:'free',name:'Free',aa_intelligence_index:60,price_1m_input_tokens:0},{id:'unknown',name:'Unknown price',aa_intelligence_index:50,price_1m_input_tokens:null},{id:'old',name:'Old',aa_intelligence_index:90,current_source_member:false}].map(r=>({last_seen:'2026-10-15T00:00:00Z',current_source_member:true,...r})) as AaModel[];
 expect(selectBrowserModels(rows,Date.parse('2026-10-15T12:00:00Z')).map(r=>r.id)).toEqual(['free','unknown','paid']);
});
test('browser snapshot validation rejects malformed and duplicated records',()=>{
 expect(validateBrowserPayload({schemaVersion:'ai-stats-model-browser.v1',models:[{id:'a',name:'A'}]})).toHaveLength(1);
 for(const models of [[{id:'a'}],[{id:'a',name:'A'},{id:'a',name:'B'}]])expect(()=>validateBrowserPayload({schemaVersion:'ai-stats-model-browser.v1',models})).toThrow();
 expect(()=>validateBrowserPayload({models:[]})).toThrow();
});
test('opening the browser loads the complete snapshot with a visible failure and retry path',async()=>{
 const source=await Bun.file(new URL('../components/Dashboard.astro',import.meta.url)).text();
 expect(source).toContain("fetch('/api/model-browser.json'");
 expect(source).toContain("browserDisclosure?.addEventListener('toggle'");
 expect(source).toContain('Only the initial preview is shown.');
 expect(source).toContain('Retry model list');
});
