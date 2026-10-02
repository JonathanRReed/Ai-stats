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
  expect(html).toContain('aria-label="Model family legend"');
  expect(html).toContain('Exact data');
  expect(html).toContain('Measured model');
  expect(html).toContain('70');
});

test('price plots label input and output series in the chart and inspection',async()=>{
 const {default:Chart}=await import('../src/components/compare/ComparisonChart');
 const {buildCompareSeries}=await import('../src/lib/compare-series');
 const {parseCompareState}=await import('../src/lib/compare-state');
 const models=[{id:'a',name:'A',family:'A',source:'aa' as const,sourceModelId:'a',current:true,priceInput:1,priceOutput:2}];
 const series=buildCompareSeries({models,observations:[]},parseCompareState(new URLSearchParams('chart=price&m=a'),models));
 const html=renderToStaticMarkup(createElement(Chart,{series,labels:false,activeId:null,onPreview:()=>{},onPin:()=>{},svgRef:{current:null}}));
 expect(html).toContain('Input tokens');expect(html).toContain('Output tokens');
 expect(html).toContain('A · Input tokens:');expect(html).toContain('A · Output tokens:');
});

test('unknown AA membership is visibly disclosed and failed loads have a retry path',async()=>{
 const html=renderToStaticMarkup(createElement(component.default,{models:[{id:'unknown',name:'A',family:'A',source:'aa',sourceModelId:'unknown',current:null,intelligence:20,priceBlended:1}],benchmarks:[],defaultModelIds:['unknown']}));
 expect(html).toContain('Membership unverified');
 expect(html).toContain('Current AA membership could not be verified');
 const source=await Bun.file(new URL('../src/components/compare/CompareExplorer.tsx',import.meta.url)).text();
 expect(source).toContain('Retry benchmark');
 expect(source).toContain('retryAttempt');
 expect(source).toContain('Score metric');
});
