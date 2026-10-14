import {expect,test} from 'bun:test';
import {providerIdFromHash,searchDirectoryGroups} from './model-directory-search';

const groups=[{provider:'Anthropic',names:['Claude Opus','Claude Sonnet']},{provider:'OpenAI',names:['GPT Astra']},{provider:'Google',names:['Gemini']}];
test('directory shows only matching counts while keeping total inventory visible',()=>{
 const result=searchDirectoryGroups(groups,'opus');
 expect(result.map(group=>group.countText)).toEqual(['1 matching / 2 total','0 matching / 1 total','0 matching / 1 total']);
 expect(result.map(group=>group.visible)).toEqual([true,false,false]);
 expect(result[0].itemMatches).toEqual([true,false]);
 expect(result.every(group=>!group.showRange)).toBe(true);
});
test('clearing search restores all rows, groups, counts and index ranges',()=>{
 const result=searchDirectoryGroups(groups,'');
 expect(result.map(group=>group.countText)).toEqual(['2 models','1 model','1 model']);
 expect(result.every(group=>group.visible&&group.showRange)).toBe(true);
 expect(result[0].itemMatches).toEqual([true,true]);
});
test('provider-name search includes every model and no-results hides every group',()=>{
 expect(searchDirectoryGroups(groups,'anthropic')[0]).toMatchObject({matchCount:2,itemMatches:[true,true],visible:true});
 expect(searchDirectoryGroups(groups,'no such model').every(group=>!group.visible&&group.matchCount===0)).toBe(true);
});
test('malformed provider hashes cannot throw during directory initialization',()=>{
 expect(providerIdFromHash('#provider%20one')).toBe('provider one');
 expect(providerIdFromHash('#%E0%A4%A')).toBeNull();
});
