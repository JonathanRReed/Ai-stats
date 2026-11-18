import {expect,test} from 'bun:test';
import {bestUnderBudget,dominators,isoValueLevels,isRecentRelease,newestDate,niceValue,releasedBy,releaseMonths,sizeScale,stalenessTier} from './chart-overlays';

test('guide numbers round to 1, 2 or 5 times a power of ten',()=>{
 expect([0.013,0.27,4,7,74,740].map(niceValue)).toEqual([0.01,0.2,5,5,50,500]);
 expect(niceValue(0)).toBe(0);expect(niceValue(-3)).toBe(0);expect(niceValue(Number.NaN)).toBe(0);
});

test('value lines run through the data and ignore zero-cost records',()=>{
 const points=[{x:0,y:50},{x:.1,y:20},{x:1,y:40},{x:10,y:60}];
 expect(isoValueLevels(points)).toEqual([5,50,200]);
 expect(isoValueLevels([{x:1,y:10}])).toEqual([]);
 expect(isoValueLevels([{x:0,y:10},{x:0,y:20}])).toEqual([]);
});

test('the budget answer is the highest score at or under the budget, cheaper on a tie',()=>{
 const points=[{id:'a',x:1,y:40},{id:'b',x:2,y:55},{id:'c',x:1.5,y:55},{id:'d',x:9,y:70}];
 expect(bestUnderBudget(points,2)?.id).toBe('c');
 expect(bestUnderBudget(points,1)?.id).toBe('a');
 expect(bestUnderBudget(points,.5)).toBeNull();
});

test('a record is beaten only by same-cohort records that are no worse on both axes',()=>{
 const points:Array<{id:string;x:number;y:number;cohortKey:string|null}>=[
  {id:'target',x:2,y:50,cohortKey:'5:long'},{id:'cheaper',x:1,y:50,cohortKey:'5:long'},{id:'better',x:2,y:60,cohortKey:'5:long'},
  {id:'twin',x:2,y:50,cohortKey:'5:long'},{id:'pricier',x:3,y:90,cohortKey:'5:long'},{id:'other-version',x:1,y:99,cohortKey:'4:long'},
 ];
 expect(dominators(points[0],points).map(point=>point.id)).toEqual(['better','cheaper']);
 expect(dominators({...points[0],cohortKey:null},points)).toEqual([]);
 // On a speed axis further right is better.
 expect(dominators(points[0],points,true).map(point=>point.id)).toEqual(['pricier','better']);
});

test('point size is area-true and skips unmeasured speeds',()=>{
 const radius=sizeScale([25,100,400],2,10);
 expect(radius(25)).toBe(2);expect(radius(400)).toBe(10);expect(radius(100)).toBeCloseTo(4.667,3);
 expect(radius(undefined)).toBeNull();expect(radius(0)).toBeNull();
 expect(sizeScale([])(10)).toBeNull();
 expect(sizeScale([50,50],2,10)(50)).toBe(6);
});

test('staleness and recency are measured against the newest record shown, not the clock',()=>{
 expect(stalenessTier('2026-11-18','2026-11-18')).toBe(0);
 expect(stalenessTier('2026-10-30','2026-11-18')).toBe(1);
 expect(stalenessTier('2026-08-01','2026-11-18')).toBe(2);
 expect(stalenessTier(null,'2026-11-18')).toBe(0);
 expect(isRecentRelease('2026-10-29','2026-11-18')).toBe(true);
 expect(isRecentRelease('2026-09-01','2026-11-18')).toBe(false);
 expect(isRecentRelease('2026-12-01','2026-11-18')).toBe(false);
 expect(isRecentRelease(undefined,'2026-11-18')).toBe(false);
 expect(newestDate(['2026-01-02',null,'2026-03-04T10:00:00Z','bad'])).toBe('2026-03-04T10:00:00.000Z');
 expect(newestDate([null])).toBeNull();
});

test('the timeline has one step per month and a record counts from its release month',()=>{
 expect(releaseMonths(['2025-11-20',null,'2026-02-03'])).toEqual(['2025-11-01','2025-12-01','2026-01-01','2026-02-01']);
 expect(releaseMonths([])).toEqual([]);
 expect(releasedBy('2026-02-28','2026-02-01')).toBe(true);
 expect(releasedBy('2026-03-01','2026-02-01')).toBe(false);
 expect(releasedBy(null,'2026-02-01')).toBe(false);
});
