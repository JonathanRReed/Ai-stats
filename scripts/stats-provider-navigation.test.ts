import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('shared provider action opens folded model results before filtering and scrolling',()=>{
 const source=readFileSync('src/components/Dashboard.astro','utf8');
 const body=source.match(/const openOpenRouterProviderRow = \(row\) => \{([\s\S]*?)\n {4}\};/)?.[1];
 expect(body).toBeDefined();
 class Details{open=false;}
 const disclosure=new Details();const searchInput={value:''};const states:boolean[]=[];
 const context={HTMLDetailsElement:Details,searchInput,applySearch(){states.push(disclosure.open);},setView(){},document:{getElementById(id:string){return id==='stats-models'?disclosure:{scrollIntoView(){states.push(disclosure.open);}}}}};
 runInNewContext('(row=>{'+body+'})({dataset:{openrouterProviderQuery:"openai"}})',context);
 expect(disclosure.open).toBe(true);expect(searchInput.value).toBe('openai');expect(states).toEqual([true,true]);
});
