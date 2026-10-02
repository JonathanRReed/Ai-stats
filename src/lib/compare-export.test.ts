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
