import {expect,test} from 'bun:test';
import {readFile} from 'node:fs/promises';
test('published PoliBench evidence includes the checked October 2 refresh',async()=>{
 const snapshot=JSON.parse(await readFile('public/data/polibench-snapshot.json','utf8'));
 expect(Date.parse(snapshot.freshness.generatedAt)).toBeGreaterThanOrEqual(Date.parse('2026-10-02T22:36:56.284Z'));
 expect(snapshot.source.commit).toMatch(/^[a-f0-9]{40}$/);
 expect(snapshot.source.commit).not.toBe('f49763cdbca9387d823ba19578992434b5ac04b0');
 expect(snapshot.counts.models).toBeGreaterThanOrEqual(113);
 expect(snapshot.counts.models).toBe(snapshot.models.length);
 expect(snapshot.counts.runs).toBe(snapshot.runs.length);
 expect(new Set(snapshot.models.map((m:{modelSlug:string})=>m.modelSlug)).size).toBe(snapshot.models.length);
 expect(snapshot.evidence.paperRelease).toBe('not_frozen');
 expect(snapshot.evidence.humanValidation).toBe('not_collected');
 expect(snapshot.evidence.externalValidation).toBe('not_externally_validated');
});