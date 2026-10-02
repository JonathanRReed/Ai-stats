import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
test('public comparison copy omits editorial disclaimers and repeated narration',()=>{
 const files=['src/components/compare/CompareExplorer.tsx','src/components/IntelligenceOverview.astro','src/pages/models/index.astro','src/pages/index.astro'];
 for(const path of files){
 const text=readFileSync(path,'utf8');
 for(const phrase of ['not a recommendation','Nothing here is a ranking','No single winner score','Source-native count, not a cross-source percentage'])expect(text).not.toContain(phrase);
 }
});
test('concise calculation notes keep the price formula and source conditions',()=>{
 const text=readFileSync('src/components/compare/CompareExplorer.tsx','utf8');
 expect(text).toContain('three input tokens for each output token');
 expect(text).toContain('same AA index version and timing');
 expect(text).toContain('Historical AA');
 expect(text).toContain('sourceUrl');
});
