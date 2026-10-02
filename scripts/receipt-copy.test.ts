import {expect,test} from 'bun:test';import {readFileSync} from 'node:fs';
test('receipt copy does not call unlinked data unpublished or derived prices copied',()=>{
 const page=readFileSync('src/pages/models/[slug].astro','utf8');
 expect(page).not.toContain('Not published');
 expect(page).not.toContain('Every number below is copied');
 expect(page).not.toContain('Current, fully measured');
 expect(page).toContain('3:1 input/output weighting');
});
