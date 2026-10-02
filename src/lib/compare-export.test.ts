import {expect,test} from 'bun:test';
import * as exporter from './compare-export';
test('CSV receipts include source, date and units and neutralize formula-like labels',()=>{
  const csv=exporter.seriesCsv?.([{label:'=WEBSERVICE("bad")',x:0,y:8,unit:'percent',
    reasoning:'unknown',receipt:{source:'Epoch AI',sourceUrl:'https://epoch.ai/benchmarks',observedAt:'2025-01-01',
    fetchedAt:'2026-10-02',indexVersion:null,conditions:{format:'diff'},snapshotId:'1'}}]);
  expect(csv).toContain('Source');
  expect(csv).toContain('2025-01-01');
  expect(csv).toContain('percent');
  expect(csv).toContain("'=WEBSERVICE");
});

test('bar exports omit plot positions and retain numeric negative values as numbers',()=>{
  const point={label:'A',x:0,y:-8,unit:'native',receipt:{source:'Epoch AI',sourceUrl:null,observedAt:null,fetchedAt:null,indexVersion:null,conditions:null,snapshotId:null}};
  const csv=exporter.seriesCsv([point],{includeX:false,xLabel:'Model',yLabel:'Score'});
  expect(csv.split('\r\n')[0]).not.toContain('"X"');
  expect(csv).toContain('"-8"');
  expect(csv).not.toContain("'"+'-8');
});

test('exports retain exact model, observation, series, and index identity',()=>{
  const receipt={source:'AA',sourceUrl:null,observedAt:null,fetchedAt:null,indexVersion:'v4',conditions:null,snapshotId:null};
  const csv=exporter.seriesCsv([
    {id:'a:input',modelId:'a',series:'input',label:'Same name',x:0,y:2,unit:'USD / 1M tokens',receipt},
    {id:'a:output',modelId:'a',series:'output',label:'Same name',x:0,y:2,unit:'USD / 1M tokens',receipt},
    {id:'b:input',modelId:'b',series:'input',label:'Same name',x:1,y:2,unit:'USD / 1M tokens',receipt},
  ],{includeX:false});
  expect(csv).toContain('"Model ID"');expect(csv).toContain('"Observation ID"');expect(csv).toContain('"Series"');
  expect(csv).toContain('"a:input"');expect(csv).toContain('"a:output"');expect(csv).toContain('"b:input"');expect(csv).toContain('"v4"');
});

test('exports identify the benchmark and distinguish retrieved dates from observation dates',()=>{
 const point={id:'run',modelId:'epoch:a',series:'observation',label:'A',x:0,y:8,unit:'percent',receipt:{source:'Epoch AI',sourceUrl:null,observedAt:null,fetchedAt:'2026-10-02T01:00:00Z',indexVersion:null,conditions:null,snapshotId:'1'}};
 const options={includeX:false,metricId:'epoch_aider',metricName:'Aider Polyglot'};
 const csv=exporter.seriesCsv([point],options);
 expect(csv).toContain('epoch_aider');expect(csv).toContain('Aider Polyglot');
 const caption=exporter.chartExportCaption?.([point],options.metricName);
 expect(caption).toContain('Aider Polyglot');expect(caption).toContain('retrieved 2026-10-02');expect(caption).not.toContain('observed 2026-10-02');
});
