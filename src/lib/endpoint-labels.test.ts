import {expect,test} from 'bun:test';
import {endpointLabels} from './endpoint-labels';
const p=(id:string,group:string,cy:number,cx=500)=>({id,group,label:id,cx,cy});
test('chooses the rightmost actual endpoint per compatible group',()=>{
 const labels=endpointLabels([p('left','a',30,100),p('right','a',60,900),p('other','b',80)],{top:0,bottom:100});
 expect(labels.find(row=>row.group==='a')).toMatchObject({id:'right',cx:900,cy:60});
});
test('spaces collisions inside the lane and keeps labels bounded',()=>{
 const labels=endpointLabels([p('a','a',40),p('b','b',40),p('c','c',40)],{top:0,bottom:80,gap:20});
 expect(labels.map(row=>row.labelY)).toEqual([40,60,80]);expect(labels.every(row=>row.labelY>=0&&row.labelY<=80)).toBe(true);
});
test('source and cohort identity can keep same family labels separate',()=>{
 const labels=endpointLabels([p('aa','aa:lab:Opus:4.3',20),p('epoch','epoch:lab:Opus:unknown',40)],{top:0,bottom:100});
 expect(labels).toHaveLength(2);
});
test('provider identity keeps same-source same-family endpoints separate',()=>{
 const labels=endpointLabels([p('anthropic','aa:Anthropic:Opus:4.3',20),p('proxy','aa:ProxyCo:Opus:4.3',40)],{top:0,bottom:100});
 expect(labels.map(row=>row.group)).toEqual(['aa:Anthropic:Opus:4.3','aa:ProxyCo:Opus:4.3']);
});
test('active group is retained when label capacity is exceeded',()=>{
 const candidates=Array.from({length:10},(_,i)=>p(String(i),'g'+i,i*10));
 const labels=endpointLabels(candidates,{top:0,bottom:20,gap:20,activeId:'8'});
 expect(labels).toHaveLength(2);expect(labels.some(row=>row.id==='8')).toBe(true);
});
test('invalid coordinates are excluded',()=>{
 expect(endpointLabels([p('bad','x',Number.NaN),p('ok','y',20)],{top:0,bottom:100}).map(row=>row.id)).toEqual(['ok']);
});
test('zero-height lane returns one bounded label',()=>{
 expect(endpointLabels([p('a','a',50),p('b','b',20)],{top:10,bottom:10}).map(row=>row.labelY)).toEqual([10]);
});
test('ties are deterministic',()=>{
 expect(endpointLabels([p('z','g',20),p('a','g',20)],{top:0,bottom:100})[0].id).toBe('a');
});
