import {createHash} from 'node:crypto';
const PRIVATE_KEYS=/^(raw(?:[_-]?(?:response|body|fetch))?|api[_-]?key|service[_-]?role[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|password|secret)$/i;
export function canonical(value,depth=0){
 if(depth>32)throw new Error('Release nesting exceeds limit');
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='string'){
  if(/^https?:\/\//.test(value)){const url=new URL(value);if(url.username||url.password||[...url.searchParams.keys()].some(key=>/^(token|key|api_key|access_token|signature|password)$/i.test(key)))throw new Error('Private URL in release');}
  return value;
 }
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(Array.isArray(value))return value.map(item=>canonical(item,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>{
 if(PRIVATE_KEYS.test(key))throw new Error('Private field in release');return [key,canonical(item,depth+1)];
 }));
 throw new Error('Release must contain finite JSON data');
}

export const measurementRevision=records=>createHash('sha256').update(JSON.stringify(canonical(JSON.parse(JSON.stringify(records))))).digest('hex');
