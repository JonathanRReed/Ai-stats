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
