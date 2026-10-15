import { endpointLabels, type EndpointCandidate } from './endpoint-labels';

export type ScatterLabel = EndpointCandidate & { labelX:number; labelY:number; width:number };

/** Nearby, non-overlapping labels; dense groups remain available through inspection. */
export function scatterLabels(points:readonly EndpointCandidate[], bounds:{left:number;right:number;top:number;bottom:number},activeId:string|null=null,priorityIds:ReadonlySet<string>=new Set()):ScatterLabel[]{
  const endpoints=endpointLabels(points,{top:bounds.top,bottom:bounds.bottom,gap:1,activeId});
  const activeGroup=points.find(point=>point.id===activeId)?.group;
  endpoints.sort((a,b)=>Number(b.group===activeGroup)-Number(a.group===activeGroup)||Number(priorityIds.has(b.id))-Number(priorityIds.has(a.id))||a.cy-b.cy||a.group.localeCompare(b.group));
  const labels:ScatterLabel[]=[];
  for(const point of endpoints){
    const width=Math.min(166,Math.max(32,point.label.length*6.2));
    const offsets=[[12,-12],[12,16],[-width-12,-12],[-width-12,16],[12,-32],[12,36],[-width-12,-32],[-width-12,36],[-width/2,-24],[-width/2,28],[-width/2,-44],[-width/2,48]];
    for(const [dx,dy] of offsets){
      const labelX=point.cx+dx,labelY=point.cy+dy;
      if(labelX<bounds.left||labelX+width>bounds.right||labelY-11<bounds.top||labelY+4>bounds.bottom)continue;
      if(labels.some(other=>labelX<other.labelX+other.width+7&&labelX+width+7>other.labelX&&labelY-14<other.labelY+7&&labelY+7>other.labelY-14))continue;
      if(points.some(other=>other.id!==point.id&&other.cx>labelX-6&&other.cx<labelX+width+6&&other.cy>labelY-15&&other.cy<labelY+8))continue;
      labels.push({...point,labelX,labelY,width});
      break;
    }
  }
  return labels;
}
