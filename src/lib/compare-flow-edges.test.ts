import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {buildPassportRoutes} from './model-passport';
import {parseCompareState} from './compare-state';
test('passport routes fall back to their exact inventory record only when native cache is absent',()=>{
 const alias={sourceKey:'huggingface',sourceName:'Hugging Face',sourceModelKey:'lab/a',sourceModelName:'A',matchMethod:'source_native' as const,confidence:1,provenance:'native',updatedAt:'2026-10-02'};
 const link=buildPassportRoutes('A',[alias],undefined,'catalog:hf-a').aiStatsCompare;
 const params=new URL(link,'https://example.test').searchParams;
 const inventory={id:'catalog:hf-a',source:'catalog',sourceModelId:'hf-a'};
 expect(parseCompareState(params,[inventory]).modelIds).toEqual([inventory.id]);
 const native={id:'huggingface:lab/a',source:'huggingface',sourceModelId:'lab/a'};
 expect(parseCompareState(params,[native,inventory]).modelIds).toEqual([native.id]);
 expect(parseCompareState(params,[native,{...native,id:'duplicate'},inventory]).modelIds).toEqual([]);
});
test('cheapest token route includes recorded zero but excludes null and video-only rows',()=>{
 const source=readFileSync('src/components/Dashboard.astro','utf8');
 const code=source.slice(source.indexOf('const getBestOpenRouterPriceModel ='),source.indexOf('const renderOpenRouterProviderLeaderboard ='));
 const choose=runInNewContext(code+';getBestOpenRouterPriceModel',{parseFiniteMetricValue:(value:unknown)=>value===null||value===undefined?null:typeof value==='number'?value:null});
 const rows=[{id:'unknown',prompt_price_1m:null,output_modalities:['text']},{id:'paid',prompt_price_1m:1,output_modalities:['text']},{id:'video',prompt_price_1m:0,output_modalities:['video']},{id:'free',prompt_price_1m:0,output_modalities:['text']}];
 expect(choose(rows,'input_price')?.model.id).toBe('free');
 expect(choose(rows.slice(0,1),'input_price')).toBeNull();
});
