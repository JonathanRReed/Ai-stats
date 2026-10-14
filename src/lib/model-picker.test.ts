import {expect,test} from 'bun:test';
import {modelPickerPage} from './model-picker';
import type {ExplorerModel} from './compare-series';

const rows:ExplorerModel[]=Array.from({length:28},(_,index)=>({
 id:`provider-${index}:gpt-${index}`,name:index===0?'GPT-6.1 Sol':`Model ${index}`,family:'GPT',provider:index<14?'OpenAI':'Route',source:index<14?'aa':'openrouter',
 sourceModelId:index===0?'gpt-6.1-sol':'gpt-'+index,current:index!==13,priceInput:index===4?0:null,priceOutput:null,
} as ExplorerModel));

test('picker pages preserve catalog order without a query and do not overlap',()=>{
 const current=rows.filter(row=>row.current!==false);
 const first=modelPickerPage(rows,'','all',false,0),second=modelPickerPage(rows,'','all',false,1);
 expect(first.records.map(row=>row.id)).toEqual(current.slice(0,12).map(row=>row.id));
 expect(first).toMatchObject({total:27,page:0,pages:3});
 expect(second.records.map(row=>row.id)).toEqual(current.slice(12,24).map(row=>row.id));
 expect(new Set([...first.records,...second.records].map(row=>row.id)).size).toBe(first.records.length+second.records.length);
});

test('search ranks exact model names and searches provider and source-native identity terms',()=>{
 const exact=modelPickerPage(rows,'gpt-6.1 sol','all',false);
 expect(exact.records[0].id).toBe(rows[0].id);
 expect(modelPickerPage(rows,'openai gpt-1','all',false).records.map(row=>row.id)).toContain('provider-1:gpt-1');
 expect(modelPickerPage(rows,'gpt-6.1-sol','aa',false).records[0].id).toBe(rows[0].id);
});

test('source and history filters preserve variants and empty result bounds',()=>{
 expect(modelPickerPage(rows,'','openrouter',false).total).toBe(14);
 expect(modelPickerPage(rows,'','aa',true).total).toBe(14);
 expect(modelPickerPage(rows,'nothing','all',false,99)).toMatchObject({records:[],total:0,page:0,pages:1});
 expect(modelPickerPage(rows,'','all',false,NaN,0).records).toHaveLength(1);
});
