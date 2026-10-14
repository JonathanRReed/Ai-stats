export type EndpointCandidate={id:string;group:string;label:string;cx:number;cy:number};
export type EndpointLabel=EndpointCandidate&{labelY:number};

/** Position family labels in a separate lane without altering measured points. */
export function endpointLabels(candidates:readonly EndpointCandidate[],options:{top:number;bottom:number;gap?:number;activeId?:string|null}):EndpointLabel[]{
 const {top,bottom,activeId}=options;const gap=options.gap??20;
 if(!Number.isFinite(top)||!Number.isFinite(bottom)||bottom<top||!Number.isFinite(gap)||gap<=0)return [];
 const groups=new Map<string,EndpointCandidate>();
 for(const point of candidates){
  if(!Number.isFinite(point.cx)||!Number.isFinite(point.cy))continue;
  const old=groups.get(point.group);
  if(!old||point.cx>old.cx||(point.cx===old.cx&&(point.cy<old.cy||(point.cy===old.cy&&point.id<old.id))))groups.set(point.group,point);
 }
 const capacity=Math.floor((bottom-top)/gap)+1;
 let endpoints=[...groups.values()].sort((a,b)=>a.cy-b.cy||a.group.localeCompare(b.group));
 if(endpoints.length>capacity){
  const selected=new Set<number>();const activeGroup=candidates.find(point=>point.id===activeId)?.group;
  const activeIndex=endpoints.findIndex(point=>point.group===activeGroup);if(activeIndex>=0)selected.add(activeIndex);
  for(let i=0;selected.size<capacity&&i<capacity;i++)selected.add(capacity===1?0:Math.round(i*(endpoints.length-1)/(capacity-1)));
  for(let i=0;selected.size<capacity;i++)selected.add(i);
  endpoints=endpoints.filter((_,index)=>selected.has(index));
 }
 const output=endpoints.map(point=>({...point,labelY:Math.max(top,Math.min(bottom,point.cy))}));
 for(let i=1;i<output.length;i++)output[i].labelY=Math.max(output[i].labelY,output[i-1].labelY+gap);
 if(output.length&&output[output.length-1].labelY>bottom){
  output[output.length-1].labelY=bottom;
  for(let i=output.length-2;i>=0;i--)output[i].labelY=Math.min(output[i].labelY,output[i+1].labelY-gap);
 }
 return output;
}
