/**
 * "x vs y" lookups for the command palette. Deliberately import-free so the palette bundle,
 * which ships on every page, stays small. The payload comes from /matchups.json.
 */
export type PaletteFamily={s:string;n:string;p:string;r:number|null;ids:string[]};
export type PaletteMatchup={u:string;a:string;b:string};
export type MatchupSearchIndex={families:PaletteFamily[];matchups:PaletteMatchup[]};
export const MATCHUP_INDEX_SCHEMA='ai-stats-matchups.v1';

export type VersusResult={
 kind:'matchup'|'compare';
 url:string;
 label:string;
 a:PaletteFamily;
 b:PaletteFamily;
};

const slug=(value:string)=>value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

/** "opus vs astra", "x versus y", "x vs. y" give both sides; anything else gives null. */
export function parseVersusQuery(query:string):[string,string]|null{
 const match=query.trim().match(/^(.+?)\s+(?:vs\.?|versus)\s+(.+)$/i);
 if(!match)return null;
 const left=match[1].trim(),right=match[2].trim();
 return left&&right?[left,right]:null;
}

/** How well a typed term names a family; 0 means it does not. */
export function familyMatchScore(term:string,family:Pick<PaletteFamily,'s'|'n'|'p'>):number{
 const t=term.trim().toLowerCase().replace(/\s+/g,' ');if(!t)return 0;
 const name=family.n.toLowerCase(),termSlug=slug(t);
 if(name===t||(termSlug&&termSlug===family.s))return 100;
 if(name.startsWith(t)||(termSlug&&family.s.startsWith(termSlug)))return 80;
 if(new RegExp(`(^|[^a-z0-9])${escape(t)}`).test(name))return 60;
 const hay=`${slug(family.n)} ${slug(family.p)}`;
 const tokens=t.split(' ').map(slug).filter(Boolean);
 if(tokens.length&&tokens.every(token=>hay.includes(token)))return 40;
 return 0;
}

const better=(x:{score:number;family:PaletteFamily},y:{score:number;family:PaletteFamily})=>
 y.score-x.score||(x.family.r??Infinity)-(y.family.r??Infinity)||x.family.n.length-y.family.n.length||x.family.n.localeCompare(y.family.n);

function candidates(term:string,families:readonly PaletteFamily[]){
 return families.map(family=>({family,score:familyMatchScore(term,family)})).filter(entry=>entry.score>0).sort(better);
}

/** The compare link with both families selected; matches serializeCompareState's output. */
export function compareHrefForFamilies(a:PaletteFamily,b:PaletteFamily):string{
 const params=new URLSearchParams();
 params.set('chart','task-cost');
 for(const id of [...new Set([...a.ids,...b.ids])].slice(0,100))params.append('m',id);
 params.set('metric','aa_intelligence_index');
 params.set('scale','log');
 params.set('labels','1');
 return `/compare?${params.toString()}`;
}

/**
 * Resolves "x vs y" to two different families (best match per side, ranked families first),
 * then to the matchup page when one exists, otherwise to /compare with both selected.
 */
export function resolveVersusQuery(query:string,index:MatchupSearchIndex|null):VersusResult|null{
 const sides=parseVersusQuery(query);
 if(!sides||!index)return null;
 const left=candidates(sides[0],index.families),right=candidates(sides[1],index.families);
 if(!left.length||!right.length)return null;
 let a=left[0].family,b=right.find(entry=>entry.family.s!==a.s)?.family;
 if(!b){
  // Both sides name the same best family; give the left side its next-best match instead.
  const alt=left.find(entry=>entry.family.s!==right[0].family.s)?.family;
  if(!alt)return null;
  a=alt;b=right[0].family;
 }
 const page=index.matchups.find(matchup=>(matchup.a===a.s&&matchup.b===b!.s)||(matchup.a===b!.s&&matchup.b===a.s));
 return page
  ?{kind:'matchup',url:page.u,label:`${a.n} vs ${b.n}`,a,b}
  :{kind:'compare',url:compareHrefForFamilies(a,b),label:`Compare ${a.n} and ${b.n}`,a,b};
}

const text=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=512;
const sitePath=(value:unknown,prefix:string):value is string=>text(value)&&value.startsWith(prefix)&&!value.startsWith('//')&&!/[\s\\]/.test(value);

/** Validates the /matchups.json payload; rows that do not fit are skipped, not trusted. */
export function readMatchupSearchIndex(payload:unknown):MatchupSearchIndex{
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Invalid matchup index');
 const body=payload as Record<string,unknown>;
 if(body.schema!==MATCHUP_INDEX_SCHEMA||!Array.isArray(body.families)||!Array.isArray(body.matchups))throw new Error('Invalid matchup index');
 const families:PaletteFamily[]=[];const slugs=new Set<string>();
 for(const row of body.families){
  if(!row||typeof row!=='object')continue;
  const f=row as Record<string,unknown>;
  if(!text(f.s)||!/^[a-z0-9-]+$/.test(f.s)||!text(f.n)||!text(f.p)||slugs.has(f.s))continue;
  if(!(f.r===null||(typeof f.r==='number'&&Number.isInteger(f.r)&&f.r>0)))continue;
  if(!Array.isArray(f.ids)||!f.ids.every(text))continue;
  slugs.add(f.s);families.push({s:f.s,n:f.n,p:f.p,r:f.r,ids:f.ids as string[]});
 }
 const matchups:PaletteMatchup[]=[];
 for(const row of body.matchups){
  if(!row||typeof row!=='object')continue;
  const m=row as Record<string,unknown>;
  if(!sitePath(m.u,'/compare/')||!text(m.a)||!text(m.b)||!slugs.has(m.a)||!slugs.has(m.b))continue;
  matchups.push({u:m.u,a:m.a,b:m.b});
 }
 return {families,matchups};
}

/**
 * Matchup pages are rebuilt from the current rankings, so a pair that had a page last month may not
 * have one today. Given the address of a missing page, find where that comparison lives now: the
 * current matchup page if the slugs still pair up, otherwise Compare with both families selected.
 * Family slugs can themselves contain "-vs-", so every split point is tried.
 */
export function resolveRetiredMatchup(pathname:string,index:MatchupSearchIndex):{url:string;label:string}|null{
 const match=/^\/compare\/([a-z0-9-]+)$/.exec(pathname.replace(/\/+$/,'').replace(/\.html$/,''));
 if(!match)return null;
 const pair=match[1],bySlug=new Map(index.families.map(family=>[family.s,family]));
 for(let at=pair.indexOf('-vs-');at>=0;at=pair.indexOf('-vs-',at+1)){
  const a=bySlug.get(pair.slice(0,at)),b=bySlug.get(pair.slice(at+4));
  if(!a||!b||a.s===b.s)continue;
  const page=index.matchups.find(item=>(item.a===a.s&&item.b===b.s)||(item.a===b.s&&item.b===a.s));
  return page?{url:page.u,label:`${a.n} vs ${b.n}`}:{url:compareHrefForFamilies(a,b),label:`Compare ${a.n} and ${b.n}`};
 }
 return null;
}
