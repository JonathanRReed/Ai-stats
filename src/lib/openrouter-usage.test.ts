import {expect,test} from 'bun:test';
import * as view from './openrouter-usage';
const snapshot={schemaVersion:1,period:'day',estimated:false,filters:{},asOf:'2026-10-02T02:00:00Z',
 startDate:'2026-09-29',endDate:'2026-10-01',missingDays:['2026-09-30'],
 sourceUrl:'https://openrouter.ai/rankings',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
 rows:[{date:'2026-09-29',modelPermaslug:'lab/a',totalTokens:'60'},
 {date:'2026-09-29',modelPermaslug:'lab/b',totalTokens:'20'},
 {date:'2026-09-29',modelPermaslug:'other',totalTokens:'20'},
 {date:'2026-10-01',modelPermaslug:'lab/b',totalTokens:'0'}]};
test('usage share uses all source traffic including Other, never selected-only totals',()=>{
 const result=view.buildUsageSeries?.(snapshot,7,['lab/a'],'share');
 expect(result?.days[0]).toMatchObject({date:'2026-09-29',totalTokens:'100',available:true});
 expect(result?.days[0].parts.find(part=>part.key==='lab/a')).toMatchObject({tokens:'60',value:60});
 expect(result?.days[0].parts.find(part=>part.key==='other')).toMatchObject({tokens:'20',value:20});
 expect(result?.days[0].parts.find(part=>part.key==='unselected')).toMatchObject({tokens:'20',value:20});
 expect(result?.denominator).toBe('All reported OpenRouter traffic');
});
test('missing day and missing model stay unknown; zero traffic has no percentage',()=>{
 const result=view.buildUsageSeries?.(snapshot,7,['lab/a'],'share');
 expect(result?.days[1]).toMatchObject({date:'2026-09-30',available:false,totalTokens:null});
 expect(result?.days[2].parts.find(part=>part.key==='lab/a')).toMatchObject({tokens:null,value:null});
 expect(result?.days[2].parts.every(part=>part.value===null)).toBe(true);
});
test('exact totals survive large integers while chart coordinates remain finite',()=>{
 const huge={...snapshot,rows:[{date:'2026-09-29',modelPermaslug:'lab/a',totalTokens:'9007199254740993'},
 {date:'2026-09-29',modelPermaslug:'other',totalTokens:'7'}]};
 const result=view.buildUsageSeries?.(huge,30,['lab/a'],'volume');
 expect(result?.days[0].totalTokens).toBe('9007199254741000');
 expect(Number.isFinite(result?.days[0].parts[0].value)).toBe(true);
});
test('window choices disclose available history and carry source attribution',()=>{
 const result=view.buildUsageSeries?.(snapshot,90,[],'share');
 expect(result?.requestedDays).toBe(90);expect(result?.availableDays).toBe(2);
 expect(result?.asOf).toBe(snapshot.asOf);
 expect(result?.sourceUrl).toBe('https://openrouter.ai/rankings');
 expect(()=>view.buildUsageSeries?.(snapshot,14,[],'share')).toThrow();
});

test('day inspection supports native button activation and bounded keyboard navigation',()=>{
 for(const key of ['Enter',' '])expect(view.usageKeyboardIndex?.(key,2,7)).toBe(2);
 expect(view.usageKeyboardIndex?.('ArrowRight',6,7)).toBe(6);
 expect(view.usageKeyboardIndex?.('ArrowLeft',0,7)).toBe(0);
 expect(view.usageKeyboardIndex?.('Home',4,7)).toBe(0);
 expect(view.usageKeyboardIndex?.('End',2,7)).toBe(6);
 expect(view.usageKeyboardIndex?.('Tab',2,7)).toBeNull();
});
