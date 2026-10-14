import {expect,test} from 'bun:test';
import {readModelSearchIndex} from './model-search-index';
import {catalogIndex} from './model-catalog';

const row=(extra:Record<string,unknown>={})=>({n:'Example (High)',p:'Example Lab · AA',u:'/models/example-high',i:0,...extra});

test('preserves model names, zero and missing scores, and source-native routes',()=>{
 expect(readModelSearchIndex([row(),row({u:'/compare?m=epoch%3Aexample&chart=benchmark',i:null})])).toEqual([
  {n:'Example (High)',p:'Example Lab · AA',u:'/models/example-high',i:0},
  {n:'Example (High)',p:'Example Lab · AA',u:'/compare?m=epoch%3Aexample&chart=benchmark',i:null},
 ]);
});

test('rejects malformed records before filtering or formatting',()=>{
 for(const payload of [null,{},[null],[row({n:4})],[row({p:null})],[row({i:'42'})],[row({i:Infinity})],[row({i:true})],[row({n:' '})]])expect(()=>readModelSearchIndex(payload)).toThrow();
});

test('rejects external, executable, and unintended routes',()=>{
 for(const url of ['https://example.com/models/a','//example.com/models/a','javascript:alert(1)','/\\example.com/models/a','/about','/models/../about','/models/a/b','/models/%2e%2e','/models/a%2fb','/compare\n?m=a'])expect(()=>readModelSearchIndex([row({u:url})])).toThrow();
});

test('deduplicates destinations and strips fields that search does not use',()=>{
 expect(readModelSearchIndex([row(),row()])).toHaveLength(1);
 expect(readModelSearchIndex([row({extra:'ignored'})])).toEqual([{n:'Example (High)',p:'Example Lab · AA',u:'/models/example-high',i:0}]);
});

test('current catalog URL generation stays within the validator route policy',()=>{
 const records=[{id:'aa:one',name:'One',family:'One',source:'aa',current:true,sourceModelId:'one'},
  {id:'epoch:two',name:'Two',family:'Two',source:'epoch',current:true,sourceModelId:'two'},
  {id:'openrouter:three',name:'Three',family:'Three',source:'openrouter',current:true,sourceModelId:'three'}] as never;
 const generated=catalogIndex(records,[]);
 expect(()=>readModelSearchIndex(generated)).not.toThrow();
});
