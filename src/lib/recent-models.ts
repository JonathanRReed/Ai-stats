export type ReleaseCandidate={id:string;name:string|null;family:string;provider:string;releaseDate:string|null;current:boolean|null;score:number|null};

export function recentModelReleases<T extends ReleaseCandidate>(models:T[],referenceDate=new Date().toISOString().slice(0,10),limit=6):T[]{
 const valid=(date:string|null):date is string=>Boolean(date&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date&&date<=referenceDate);
 const score=(model:T)=>typeof model.score==='number'&&Number.isFinite(model.score)?model.score:-Infinity;
 const ordered=models.filter(model=>model.current===true&&valid(model.releaseDate)).sort((a,b)=>b.releaseDate!.localeCompare(a.releaseDate!)||score(b)-score(a)||a.id.localeCompare(b.id));
 const families=new Set<string>();
 return ordered.filter(model=>{const key=JSON.stringify([model.provider,model.family]);if(families.has(key))return false;families.add(key);return true;}).slice(0,Math.max(0,limit));
}
