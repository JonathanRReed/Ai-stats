import {expect,test} from 'bun:test';
import {familyColor} from '../components/compare/ComparisonChart';
test('the default provider families have distinguishable stable plot colors',()=>{
  const families=['Claude Opus 5.5','GPT-6 Astra','Gemini 4 Argon','Muse Spark 1.3','Grok 4.7','MiMo-V2.6-Pro'];
  expect(new Set(families.map(familyColor)).size).toBe(6);
  for(const family of families)expect(familyColor(family)).toBe(familyColor(family));
});
