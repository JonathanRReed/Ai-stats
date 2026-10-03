import {test,expect} from 'bun:test';import {selectBenchmarkModels} from './compare-state';
test('benchmark choices admit original publisher records and preserve source identity',()=>{
 const catalog=[{id:'aa:same',source:'aa',sourceModelId:'same'},{id:'epoch:same',source:'epoch',sourceModelId:'same'},{id:'publisher:same',source:'publisher',sourceModelId:'same'}];
 expect(selectBenchmarkModels(catalog,[{modelVersion:'same',sourceKey:'livebench',value:40}])).toEqual(['publisher:same']);
 expect(selectBenchmarkModels(catalog,[{modelVersion:'same',value:0}])).toEqual(['epoch:same']);
 expect(selectBenchmarkModels(catalog,[{modelVersion:'same',value:null}])).toEqual([]);
});