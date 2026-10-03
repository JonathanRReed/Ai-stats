import {test,expect} from 'bun:test';
import {epochScoreKey} from '../src/lib/compare-series';
test('benchmark versions never share a score-series key',()=>{
 const row={metricKey:'Accuracy',unit:'fraction' as const};
 expect(epochScoreKey({...row,benchmarkVersion:'2.0'})).not.toBe(epochScoreKey({...row,benchmarkVersion:'4.0'}));
 expect(epochScoreKey(row)).toBe(JSON.stringify(['Accuracy','percent']));
});
