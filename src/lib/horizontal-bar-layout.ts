import {plotGeometry} from './compare-geometry';
type BarPoint={id:string;x:number;y:number;label:string};
export function wrapBarLabel(label:string,maxChars:number):string[]{
 const lines:string[]=[];let line='';
 for(const word of label.split(/\s+/)){
  if(line&&(line+' '+word).length>maxChars){lines.push(line);line='';}
  if(word.length>maxChars){if(line){lines.push(line);line='';}for(let i=0;i<word.length;i+=maxChars)lines.push(word.slice(i,i+maxChars));}
  else line=line?line+' '+word:word;
 }
 if(line)lines.push(line);return lines;
}
export function horizontalBarLayout<T extends BarPoint>(points:T[],width:number,scale:'linear'|'log'){
 const visible=points.filter(p=>Number.isFinite(p.y)&&(scale!=='log'||p.y>0));
 const left=Math.min(280,Math.max(125,width*.38)),offset=left-70;
 const domain=plotGeometry(visible.map(p=>({...p,x:p.y,y:0})),'scatter',scale,width-offset,300,20,48);
 const byId=new Map(domain.points.map(p=>[p.id,p]));
 const baseline=scale==='log'?left:domain.points.find(p=>p.x===0)?.cx!==undefined?domain.points.find(p=>p.x===0)!.cx+offset:
  domain.xTicks.find(t=>t.value===0)?.position!==undefined?domain.xTicks.find(t=>t.value===0)!.position+offset:left;
 let cursor=48;
 const groups=[...new Map(visible.map(p=>[p.x,p])).values()];
 const rows=groups.map(group=>{
  const members=visible.filter(p=>p.x===group.x);
  const lines=wrapBarLabel(group.label,Math.max(12,Math.floor((left-18)/6.2)));
  const height=Math.max(44,lines.length*15+18,members.length*19+14);
  const top=cursor;cursor+=height;
  return {x:group.x,label:group.label,lines,top,bottom:cursor,members};
 });
 const ticks=domain.xTicks.map(t=>({...t,position:t.position+offset})).filter((tick,index,all)=>index===0||index%Math.max(1,Math.ceil(55/(all.length>1?all[1].position-all[0].position:55)))===0);
 return {left,baseline,height:Math.max(160,cursor+42),rows,ticks,
  points:rows.flatMap(row=>row.members.map((point,index)=>({...point,end:byId.get(point.id)!.cx+offset,
   cy:row.top+(row.bottom-row.top)/2+(index-(row.members.length-1)/2)*19}))) };
}
