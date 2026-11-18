import {expect,test} from 'bun:test';
import {existsSync} from 'node:fs';
import {providerIcon} from './provider-icons';

test('labs resolve by provider name first, then by family name',()=>{
 expect(providerIcon('OpenAI','GPT-6 Astra')?.src).toBe('/icons/providers/openai.svg');
 expect(providerIcon('Anthropic','Claude Opus 5.5')).toEqual({src:'/icons/providers/anthropic.svg',mono:true});
 expect(providerIcon(undefined,'Gemini 4 Carbon')?.src).toBe('/icons/providers/google.svg');
 expect(providerIcon('Z AI')?.src).toBe('/icons/providers/zai.svg');
 expect(providerIcon('SpaceXAI','Grok 4.7')?.src).toBe('/icons/providers/xai.svg');
});

test('an unknown lab has no mark rather than a wrong one',()=>{
 expect(providerIcon('Example Lab','Beam 1.0')).toBeNull();
 expect(providerIcon()).toBeNull();
});

test('every mark on file exists in public/icons',()=>{
 for(const [provider,family] of [['OpenAI',''],['Anthropic',''],['Google',''],['Meta',''],['Mistral',''],['Cohere',''],['DeepSeek',''],['Alibaba',''],['xAI',''],['NVIDIA',''],['Microsoft',''],['Moonshot',''],['Perplexity',''],['ByteDance',''],['MiniMax',''],['Zhipu','']]){
  const mark=providerIcon(provider,family);
  expect(mark).not.toBeNull();
  expect(existsSync('public'+mark!.src)).toBe(true);
 }
});
