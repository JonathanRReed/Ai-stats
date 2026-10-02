import {expect,test} from 'bun:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as component from '../src/components/compare/CompareExplorer';
test('explorer server renders a real chart and exact-data fallback without browser globals',()=>{
  expect(component.default).toBeDefined();
  if(!component.default)return;
  const html=renderToStaticMarkup(createElement(component.default,{models:[{id:'a',name:'Measured model',family:'Measured',source:'aa',
    sourceModelId:'a',current:true,intelligence:70,priceBlended:2,indexVersion:'4.2',performancePrompt:'long'}],
    benchmarks:[],defaultModelIds:['a']}));
  expect(html).toContain('Compare models');
  expect(html).toContain('<svg');
  expect(html).toContain('Exact data');
  expect(html).toContain('Measured model');
  expect(html).toContain('70');
});
