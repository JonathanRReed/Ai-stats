import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('theme toggle follows this document when another tab changed the saved preference',()=>{
  let saved='dark';
  const root={dataset:{theme:'dark'},classList:{toggle:()=>{}},style:{colorScheme:'dark'}};
  const context={window:{} as {__ecoTheme?:{toggle:()=>void}},document:{documentElement:root,querySelector:()=>null,addEventListener:()=>{}},
    localStorage:{getItem:()=>saved,setItem:(_key:string,value:string)=>{saved=value;}}};
  runInNewContext(readFileSync('scripts/static-js/site-theme.js','utf8'),context);
  saved='light';
  context.window.__ecoTheme?.toggle();
  expect(root.dataset.theme).toBe('light');
});
