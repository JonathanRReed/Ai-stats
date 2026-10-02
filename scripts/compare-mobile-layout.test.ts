import {expect,test} from 'bun:test';
import {existsSync,readFileSync} from 'node:fs';
const path='src/styles/compare-explorer.css';
const css=existsSync(path)?readFileSync(path,'utf8'):'';
const component=readFileSync('src/components/compare/CompareExplorer.tsx','utf8');
test('mobile explorer uses a native modal filter drawer and returns focus',()=>{
  expect(component).toContain('<dialog');
  expect(component).toContain('.showModal()');
  expect(component).toContain('onCancel');
  expect(component).toContain('filterButton.current?.focus()');
  expect(css).toContain('@media (max-width: 900px)');
  expect(css).toContain('grid-template-columns: 1fr');
  expect(css).toContain('.desktop-model-selector');
});
test('chart tabs and tables stay scrollable while reduced motion is respected',()=>{
  expect(css).toContain('overflow-x: auto');
  expect(css).toContain('prefers-reduced-motion');
  expect(css).toContain('font-family: var(--font-mono)');
});
