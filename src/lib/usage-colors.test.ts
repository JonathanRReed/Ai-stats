import {expect,test} from 'bun:test';
import {usageColors} from './usage-colors';

test('previously colliding DeepSeek models have distinct colors',()=>{
 const keys=['deepseek/deepseek-v4.1-flash-20260910','deepseek/deepseek-v4-flash-20260731'];
 const colors=usageColors(keys);
 expect(colors.get(keys[0])).not.toBe(colors.get(keys[1]));
});

test('eight selected models always receive unique colors, stable under reordering',()=>{
 const keys=Array.from({length:8},(_,index)=>'model/'+index);
 const a=usageColors(keys),b=usageColors([...keys].reverse());
 expect(a).toEqual(b);
 expect(new Set(keys.map(key=>a.get(key))).size).toBe(8);
});

test('aggregate colors are reserved and duplicate identities are harmless',()=>{
 const colors=usageColors(['other','unselected','a','a']);
 expect(colors.size).toBe(3);
 expect(colors.get('other')).toBe('#636c78');
 expect(colors.get('unselected')).toBe('#90979e');
});
