import {expect,test} from 'bun:test';
import {scatterLabels} from './scatter-labels';
const bounds={left:70,right:900,top:30,bottom:450};
test('labels stay near data instead of drawing lines across the chart',()=>{
 const points=Array.from({length:12},(_,i)=>({id:String(i),group:String(i),label:'Model '+i,cx:180+i*20,cy:70+i*25}));
 const labels=scatterLabels(points,bounds);
 expect(labels.length).toBeGreaterThan(5);
 for(const label of labels){
  expect(Math.min(Math.abs(label.labelX-label.cx),Math.abs(label.labelX+label.width-label.cx),Math.abs(label.labelX+label.width/2-label.cx))).toBeLessThanOrEqual(12);
  expect(Math.abs(label.labelY-label.cy)).toBeLessThanOrEqual(48);
  expect(label.labelX).toBeGreaterThanOrEqual(bounds.left);
  expect(label.labelX+label.width).toBeLessThanOrEqual(bounds.right);
 }
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
  const a=labels[i],b=labels[j];
  expect(a.labelX<b.labelX+b.width&&a.labelX+a.width>b.labelX&&a.labelY-11<b.labelY+4&&a.labelY+4>b.labelY-11).toBe(false);
 }
});
test('dense labels are omitted rather than overlapping or moving measured points',()=>{
 const points=Array.from({length:30},(_,i)=>({id:String(i),group:String(i),label:'Model '+i,cx:300,cy:200}));
 const before=JSON.stringify(points),labels=scatterLabels(points,bounds,'29');
 expect(labels.length).toBeLessThan(30);
 expect(labels.some(label=>label.id==='29')).toBe(true);
 expect(JSON.stringify(points)).toBe(before);
});
