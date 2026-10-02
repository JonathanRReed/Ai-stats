import {expect,test} from 'bun:test';
const geometry=await import('./compare-geometry').catch(()=>({}));
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
