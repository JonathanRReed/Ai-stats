import {expect,test} from 'bun:test';
import {comparisonParams} from './compare-navigation';
import {parseCompareState} from './compare-state';
test('automatic and manual selections retain their navigation intent',()=>{
 const state=parseCompareState(new URLSearchParams('chart=benchmark&metric=epoch_gpqa_diamond&m=a'),[{id:'a'}]);
 expect(comparisonParams(state,true).get('auto')).toBe('1');
 expect(comparisonParams(state,true).get('metric')).toBe('epoch_gpqa_diamond');
 expect(comparisonParams(state,false).has('auto')).toBe(false);
 expect(comparisonParams(state,false).getAll('m')).toEqual(['a']);
});
