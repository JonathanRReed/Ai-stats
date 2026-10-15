import {expect,test} from 'bun:test';
import {benchmarkConditionOptions} from './benchmark-condition-options';
import {epochScoreKey} from './compare-series';
import type {EpochObservation} from './epoch-observations';
const observation=(id:string,value:number|null,version:string,agent:string):EpochObservation=>({
 id,modelVersion:'model-'+id,benchmarkSlug:'terminal',value,metricKey:'Accuracy',unit:'percent',benchmarkVersion:version,
 conditions:{Agent:agent},evaluationDate:null,sourceUrl:null,fetchedAt:null,snapshotId:null,
});
test('conditions from another metric or benchmark version cannot produce an empty combination',()=>{
 const rows=[observation('a',50,'2.0','A'),observation('b',60,'1.0','B'),observation('missing',null,'2.0','Missing')];
 expect(benchmarkConditionOptions(rows,epochScoreKey(rows[0]))).toEqual(['[["Agent","A"]]']);
 expect(benchmarkConditionOptions(rows,epochScoreKey(rows[1]))).toEqual(['[["Agent","B"]]']);
 expect(benchmarkConditionOptions(rows,null)).toEqual(['[["Agent","A"]]','[["Agent","B"]]']);
});
