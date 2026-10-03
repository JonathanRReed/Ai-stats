import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseCompareState} from '../src/lib/compare-state';
test('source-native small values are not guessed to be percentages',()=>{
 const source=readFileSync('src/components/Dashboard.astro','utf8');
 const body=source.slice(source.indexOf('const formatEpochLeaderboardScore =')).match(/=> \{([\s\S]*?)\n\};/)?.[1];
 expect(body).toBeDefined();
 const format=runInNewContext('(score,unit)=>{'+body+'}');
 expect(format(.8,'native')).toBe('0.8');
 expect(format(.8,'fraction')).toBe('80.0%');
 expect(format(.8,'percent')).toBe('0.8%');
 expect(source).toContain('data-compare-href={isEpoch ? epochRunHref(model, key)');
});
test('saved versioned score selection survives URL parsing',()=>{
 const params=new URLSearchParams('chart=benchmark&metric=epoch_terminalbench_external');
 params.set('score_metric',JSON.stringify(['Accuracy','percent','2.0']));
 expect(parseCompareState(params,[]).scoreMetricKey).toBe(JSON.stringify(['Accuracy','percent','2.0']));
});
