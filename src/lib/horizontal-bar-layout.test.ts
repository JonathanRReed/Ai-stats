import {expect,test} from 'bun:test';
import {horizontalBarLayout} from './horizontal-bar-layout';
test('long bar identities wrap into separate rows on mobile and desktop',()=>{
 for(const width of [320,480,760,1200]){
 const points=Array.from({length:16},(_,i)=>({id:String(i),x:Math.floor(i/2),y:i,label:'Claude Opus 5.5 (Maximum reasoning, Default Fallback) variant '+Math.floor(i/2)}));
 const layout=horizontalBarLayout(points,width,'linear');
 expect(layout.rows).toHaveLength(8);
 for(let i=1;i<layout.rows.length;i++)expect(layout.rows[i].top).toBeGreaterThanOrEqual(layout.rows[i-1].bottom);
 for(const row of layout.rows)expect(row.lines.join(' ')).toBe(row.label);
 expect(layout.points.every(p=>Number.isFinite(p.end)&&p.end<=width-24)).toBe(true);
 }
});
test('zero bars keep truthful zero width and a readable value, while Log excludes them',()=>{
 const rows=[{id:'zero',x:0,y:0,label:'Free route'},{id:'paid',x:1,y:2,label:'Paid route'}];
 const linear=horizontalBarLayout(rows,360,'linear');
 expect(linear.points[0].end).toBe(linear.baseline);
 expect(horizontalBarLayout(rows,360,'log').points.map(p=>p.id)).toEqual(['paid']);
});
