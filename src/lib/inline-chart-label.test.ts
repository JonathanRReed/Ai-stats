import {expect,test} from 'bun:test';
import {inlineChartLabel} from './inline-chart-label';
test('long active labels stay within mobile chart bounds',()=>{
 const bounds={left:70,right:336,top:60};
 for(const x of [70,180,336]){
  const label=inlineChartLabel('Claude Sonnet 5.5 (Max, Default Fallback)',x,65,bounds);
  expect(label.x).toBeGreaterThanOrEqual(bounds.left);
  expect(label.x+label.width).toBeLessThanOrEqual(bounds.right);
  expect(label.y).toBeGreaterThan(bounds.top);
  expect(label.text.endsWith('…')).toBe(true);
 }
});
