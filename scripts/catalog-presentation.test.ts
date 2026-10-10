import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {formatPrice} from '../src/lib/format-utils';
import {hasFiniteMetricValue} from '../src/lib/metric-values';

const card=readFileSync('src/components/ModelCard.astro','utf8');
const dashboard=readFileSync('src/components/Dashboard.astro','utf8');
const values=[null,undefined,0,1.25,Number.NaN,Infinity,-1];
const expected=['-','-','$0.000','$1.250','-','-','-'];

test('server catalog price expressions preserve missing values and explicit zero',()=>{
 const expressions=[...card.matchAll(/\{formatPrice\((.+), 3\)\}/g)].map(match=>match[1]).filter(expression=>expression.includes('model.price_1m_'));
 expect(expressions).toHaveLength(3);
 for(const expression of expressions){
  const argument=new Function('model','return '+expression);
  values.forEach((value,index)=>expect(formatPrice(argument({price_1m_input_tokens:value,price_1m_output_tokens:value,price_1m_blended_3_to_1:value}),3)).toBe(expected[index]));
 }
});

test('browser catalog price formatter agrees with server formatting',()=>{
 const source=dashboard.slice(dashboard.indexOf('    const formatPrice ='),dashboard.indexOf('    const formatCompactNumber ='));
 const format=new Function('formatCatalogPrice',source+';return formatPrice;')(formatPrice);
 values.forEach((value,index)=>expect(format(value,3)).toBe(expected[index]));
});

function recordedEntries(variable:string,model:Record<string,unknown>){
 const start=card.indexOf('const '+variable+' =');
 const end=card.indexOf(';',start);
 return new Function('model','hasFiniteMetricValue',card.slice(start,end+1)+'return '+variable)(model,hasFiniteMetricValue) as Array<[string,unknown]>;
}
test('catalog benchmark entries hide absent evidence while preserving real zero',()=>{
 const model={mmlu_pro:null,gpqa:undefined,hle:0,aime:Number.NaN,livecodebench:'',scicode:Infinity,math_500:0.8};
 expect(recordedEntries('allBenchmarks',model)).toEqual([['HLE',0],['Math 500',0.8]]);
 expect(recordedEntries('allBenchmarks',{})).toEqual([]);
});
test('catalog index entries hide absent evidence while preserving real zero',()=>{
 expect(recordedEntries('aaIndexes',{aa_intelligence_index:0,aa_coding_index:null,aa_math_index:undefined})).toEqual([['AA Index',0]]);
 expect(recordedEntries('aaIndexes',{})).toEqual([]);
});
test('catalog renders an honest empty state and labels MMLU Pro consistently',()=>{
 expect(card).toContain('No benchmark measurements available.');
 expect(dashboard).toContain('No benchmark measurements available.');
 expect(dashboard).not.toContain('>MMLU</');
});
