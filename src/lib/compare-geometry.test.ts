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
