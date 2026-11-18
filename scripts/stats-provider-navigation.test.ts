import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('shared provider action opens folded model results before filtering and scrolling',()=>{
 // The provider board moved from Dashboard.astro into its own client module (two-space indent inside the factory).
 const source=readFileSync('src/components/dashboard/client/openrouter-board.ts','utf8');
 const body=source.match(/const openOpenRouterProviderRow = \(row\) => \{([\s\S]*?)\n {2}\};/)?.[1];
 expect(body).toBeDefined();
 class Details{open=false;}
 const disclosure=new Details();const searchInput={value:''};const states:boolean[]=[];
 const context={HTMLDetailsElement:Details,searchInput,applySearch(){states.push(disclosure.open);},setView(){},document:{getElementById(id:string){return id==='stats-models'?disclosure:{scrollIntoView(){states.push(disclosure.open);}}}}};
 runInNewContext('(row=>{'+body+'})({dataset:{openrouterProviderQuery:"openai"}})',context);
 expect(disclosure.open).toBe(true);expect(searchInput.value).toBe('openai');expect(states).toEqual([true,true]);
});
