import {expect,test} from 'bun:test';
import * as geometry from './compare-geometry';
test('linear scatter coordinates stay finite and within the plotting area',()=>{
  const result=geometry.plotGeometry?.([{id:'a',x:0,y:0},{id:'b',x:10,y:100}],'scatter','linear');
  expect(result?.points).toHaveLength(2);
  for(const point of result?.points??[]){expect(Number.isFinite(point.cx)).toBe(true);expect(point.cx).toBeGreaterThanOrEqual(70);expect(point.cy).toBeGreaterThanOrEqual(20);}
});
test('log scales use logarithmic intervals rather than silently linear positions',()=>{
  const result=geometry.plotGeometry?.([{id:'a',x:1,y:1},{id:'b',x:10,y:2},{id:'c',x:100,y:3}],'scatter','log');
  expect(result?.points[1].cx-result?.points[0].cx).toBeCloseTo(result?.points[2].cx-result?.points[1].cx);
});
test('empty and equal-valued datasets have nonzero finite axes',()=>{
  for(const points of [[],[{id:'a',x:0,y:0}]]){
    const result=geometry.plotGeometry?.(points,'bars','linear');
    expect(result).toBeDefined();
    expect(result?.yTicks.every((tick:{position:number})=>Number.isFinite(tick.position))).toBe(true);
  }
});

test('axes use readable rounded ticks rather than arbitrary decimal subdivisions',()=>{
  const result=geometry.plotGeometry([{id:'a',x:20,y:57.6}],'scatter','linear');
  expect(result.yTicks.every(tick=>Number.isInteger(tick.value))).toBe(true);
  expect(geometry.plotGeometry([{id:'a',x:1,y:1},{id:'b',x:100,y:2}],'scatter','log').xTicks.map(tick=>tick.value)).toEqual([1,10,100]);
});

test('dense mobile grouped bars retain positive visible widths within their bands',()=>{
  const points=Array.from({length:80},(_,index)=>({id:String(index),x:Math.floor(index/2),y:index+1}));
  const plot=geometry.plotGeometry(points,'bars','linear',300,420);
  for(const point of plot.points){expect(point.visibleBarWidth).toBeGreaterThan(0);expect(point.visibleBarWidth).toBeLessThanOrEqual(point.barWidth);}
});

test('large finite logarithmic values cannot hang tick generation',async()=>{
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync(process.execPath,['-e',"import {plotGeometry} from './src/lib/compare-geometry.ts';const result=plotGeometry([{id:'extreme',x:1e308,y:1}],'scatter','log');if(!result.xTicks.every(t=>Number.isFinite(t.position))||!Number.isFinite(result.points[0].cx))process.exit(2);"],{cwd:process.cwd(),timeout:2000});
 expect(result.status).toBe(0);
});

test('negative-only bar values retain a visible zero baseline inside the plot',()=>{
 const plot=geometry.plotGeometry([{id:'a',x:0,y:-100},{id:'b',x:1,y:-80}],'bars','linear',300,420);
 expect(plot.baseline).toBeGreaterThanOrEqual(plot.top);
 expect(plot.baseline).toBeLessThanOrEqual(plot.bottom);
 for(const point of plot.points){expect(point.cy).toBeGreaterThanOrEqual(plot.top);expect(point.cy).toBeLessThanOrEqual(plot.bottom);}
});

test('log geometry omits nonpositive coordinates instead of clamping to Number.MIN_VALUE',()=>{
  const plot=geometry.plotGeometry([{id:'zero',x:0,y:10},{id:'neg',x:-5,y:10},{id:'pos',x:10,y:10}],'scatter','log');
  expect(plot.points.map(point=>point.id)).toEqual(['pos']);
  expect(plot.points[0].cx).toBeGreaterThan(70);
  expect(Number.isFinite(plot.points[0].cx)).toBe(true);
});

test('all-nonpositive log input yields an empty plot with finite empty-domain ticks',()=>{
  const plot=geometry.plotGeometry([{id:'zero',x:0,y:1},{id:'neg',x:-1,y:2}],'scatter','log');
  expect(plot.points).toEqual([]);
  expect(plot.xTicks.every(tick=>Number.isFinite(tick.position))).toBe(true);
});

test('extreme finite positive log values map exactly without a 1e±300 clamp',()=>{
  const values=[Number.MIN_VALUE,1e-310,1e-305,1e-301,1,1e301,1e305,Number.MAX_VALUE];
  const plot=geometry.plotGeometry(values.map((x,index)=>({id:String(index),x,y:1})),'scatter','log');
  const cx=plot.points.map(point=>point.cx);
  expect(cx.every(Number.isFinite)).toBe(true);
  // Strictly increasing: distinct finite positives are never collapsed onto a clamp boundary.
  for(let index=1;index<cx.length;index++)expect(cx[index]).toBeGreaterThan(cx[index-1]);
  for(const value of cx){expect(value).toBeGreaterThanOrEqual(plot.left);expect(value).toBeLessThanOrEqual(plot.right);}
  // Positions are proportional to log10 distance across the full double range.
  const span=plot.right-plot.left,decades=Math.ceil(Math.log10(Number.MAX_VALUE))-Math.floor(Math.log10(Number.MIN_VALUE));
  expect(cx[4]-plot.left).toBeCloseTo((0-Math.floor(Math.log10(Number.MIN_VALUE)))/decades*span,6);
  expect(plot.xTicks.length).toBeLessThanOrEqual(12);
  expect(plot.xTicks.every(tick=>Number.isFinite(tick.position)&&tick.label.length>0)).toBe(true);
  expect(plot.xTicks[0].label).toBe('1e-324');
  expect(new Set(plot.xTicks.map(tick=>tick.label)).size).toBe(plot.xTicks.length);
});

test('a single log decade keeps its point inside a one-decade-padded domain',()=>{
  const plot=geometry.plotGeometry([{id:'a',x:100,y:1}],'scatter','log');
  expect(plot.xTicks.map(tick=>tick.label)).toEqual(['10','100','1,000']);
  expect(plot.points[0].cx).toBeCloseTo((plot.left+plot.right)/2,6);
});

test('log bars sit on the bottom baseline and tiny positive bars stay visible',()=>{
  const plot=geometry.plotGeometry([{id:'tiny',x:0,y:1e-320},{id:'big',x:1,y:1e300}],'bars','log',600,420);
  expect(plot.baseline).toBe(plot.bottom);
  expect(plot.points.every(point=>Number.isFinite(point.cy)&&point.cy<=plot.bottom&&point.cy>=plot.top)).toBe(true);
  expect(plot.points[0].cy).toBeLessThan(plot.bottom);
});

test('speed log axes use nearby readable bounds instead of an empty extra decade',()=>{
 const plot=geometry.plotGeometry([{id:'slow',x:45,y:50},{id:'fast',x:1430.58,y:6}],'scatter','log');
 expect(plot.points[1].cx).toBeGreaterThan(plot.left+(plot.right-plot.left)*.8);
 expect(plot.xTicks.every(tick=>tick.position>=plot.left-.001&&tick.position<=plot.right+.001)).toBe(true);
});
test('a lone non-power-of-ten log value retains a finite nonzero domain',()=>{
 const plot=geometry.plotGeometry([{id:'one',x:2,y:70}],'scatter','log');
 expect(Number.isFinite(plot.points[0].cx)).toBe(true);
 expect(plot.points[0].cx).toBeGreaterThan(plot.left);
 expect(plot.points[0].cx).toBeLessThan(plot.right);
});
test('extreme narrow log ranges keep readable exponent labels and finite geometry',()=>{
 for(const values of [[1e308,Number.MAX_VALUE],[1e-310,2e-310]]){
  const plot=geometry.plotGeometry(values.map((x,i)=>({id:String(i),x,y:i+1})),'scatter','log');
  expect(plot.points.every(point=>Number.isFinite(point.cx))).toBe(true);
  expect(plot.xTicks.every(tick=>!tick.label.includes('.')&&tick.label.length<12)).toBe(true);
 }
});
