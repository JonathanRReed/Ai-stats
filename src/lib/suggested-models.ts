export type SuggestionPoint={id:string;modelId:string;x:number;y:number;provider?:string;family:string;cohortKey:string|null;indexVersion:string|null};
const versionOrder=(a:string,b:string)=>{const left=a.split('.').map(Number),right=b.split('.').map(Number);for(let i=0;i<Math.max(left.length,right.length);i++){const d=(left[i]??0)-(right[i]??0);if(d)return d;}return a.localeCompare(b);};
/** Deterministic, measured-only suggestions from one latest compatible cohort. */
export function suggestedModels(points:SuggestionPoint[],direction:'min'|'max'='min',limit=8):string[]{
 const size=Math.max(0,Math.min(10,Math.floor(limit)));if(!size)return [];
 const valid=points.filter(p=>Number.isFinite(p.x)&&p.x>=0&&Number.isFinite(p.y)&&p.cohortKey&&typeof p.indexVersion==='string'&&/^\d+(?:\.\d+)*$/.test(p.indexVersion));
 const latest=valid.map(p=>p.indexVersion!).sort(versionOrder).at(-1);const groups=new Map<string,SuggestionPoint[]>();
 for(const p of valid.filter(p=>p.indexVersion===latest)){const g=groups.get(p.cohortKey!)??[];g.push(p);groups.set(p.cohortKey!,g);}
 const rows=[...new Map(([...groups].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0]))[0]?.[1]??[]).sort((a,b)=>a.id.localeCompare(b.id)).map(p=>[p.modelId,p])).values()];
 const quality=(a:SuggestionPoint,b:SuggestionPoint)=>b.y-a.y||(direction==='min'?a.x-b.x:b.x-a.x)||a.modelId.localeCompare(b.modelId);
 const frontier=rows.filter(p=>!rows.some(q=>q.modelId!==p.modelId&&(direction==='min'?q.x<=p.x:q.x>=p.x)&&q.y>=p.y&&(q.x!==p.x||q.y!==p.y))).sort(quality);
 const chosen:SuggestionPoint[]=[];const add=(p:SuggestionPoint|undefined)=>{if(p&&chosen.length<size&&!chosen.some(q=>q.modelId===p.modelId))chosen.push(p);};
 add(frontier[0]);add([...frontier].sort((a,b)=>(direction==='min'?a.x-b.x:b.x-a.x)||quality(a,b))[0]);
 const positive=rows.filter(p=>p.x>0).map(p=>p.x),unit=positive.length?Math.min(...positive):1,tx=(x:number)=>Math.log1p(x/unit),maxX=Math.max(1,...rows.map(p=>tx(p.x))),minY=Math.min(0,...rows.map(p=>p.y)),maxY=Math.max(1,...rows.map(p=>p.y));
 const distance=(p:SuggestionPoint,q:SuggestionPoint)=>(tx(p.x)/maxX-tx(q.x)/maxX)**2+((p.y-q.y)/(maxY-minY))**2;
 while(chosen.length<size){const remaining=frontier.filter(p=>!chosen.some(q=>p.modelId===q.modelId));if(!remaining.length)break;remaining.sort((a,b)=>Math.min(...chosen.map(p=>distance(b,p)))-Math.min(...chosen.map(p=>distance(a,p)))||quality(a,b));add(remaining[0]);}
 while(chosen.length<size){const remaining=rows.filter(p=>!chosen.some(q=>p.modelId===q.modelId));if(!remaining.length)break;const providers=new Set(chosen.map(p=>p.provider??p.family)),families=new Set(chosen.map(p=>p.family));remaining.sort((a,b)=>Number(providers.has(a.provider??a.family))-Number(providers.has(b.provider??b.family))||Number(families.has(a.family))-Number(families.has(b.family))||quality(a,b));add(remaining[0]);}
 return chosen.map(p=>p.modelId);
}
