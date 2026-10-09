import {createHash} from 'node:crypto';
import {readFile,readdir,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {parse}=require('jsonc-parser');
const PATCH='patches/http-cache-semantics@4.2.0.patch';
const PATCH_HASH='70985232a0613af55dd455ec31c02789caad64e3e9c1a2d9c37ab0d9aec8e967';
const MODULE_HASH='79fda54482c2b97fb7ce44f3d5cae5853160171cac555503d332c8c2718a802f';
const ADVISORY='https://github.com/advisories/GHSA-ch52-4w7c-c8xp';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function classifyAudit(report,exitCode){
 if(!report||Array.isArray(report)||typeof report!=='object'||![0,1].includes(exitCode))throw Error('Invalid audit response');
 let excepted=0;
 for(const [name,items] of Object.entries(report)){
  if(!Array.isArray(items)||!items.length)throw Error('Invalid audit findings');
  for(const item of items){
   if(name!=='http-cache-semantics'||!item||item.url!==ADVISORY||item.id!==1240991||item.vulnerable_versions!=='<=4.2.0'||item.severity!=='high')throw Error('Unremediated dependency advisory: '+name);
   excepted++;
  }
 }
 if(excepted>1||(exitCode===1&&excepted!==1))throw Error('Unexpected audit result');
 return {locallyPatchedAdvisories:excepted};
}
export async function verifyPatchedDependency(root=process.cwd()){
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 const errors=[];const lock=parse(await readFile(join(root,'bun.lock'),'utf8'),errors,{allowTrailingComma:true});
 if(errors.length||pkg.patchedDependencies?.['http-cache-semantics@4.2.0']!==PATCH||lock.patchedDependencies?.['http-cache-semantics@4.2.0']!==PATCH)throw Error('Missing cache patch mapping');
 const locked=Object.values(lock.packages??{}).filter(value=>Array.isArray(value)&&String(value[0]).startsWith('http-cache-semantics@'));
 if(locked.length!==1||locked[0][0]!=='http-cache-semantics@4.2.0')throw Error('Unexpected locked cache-policy copies');
 if(hash(await readFile(join(root,PATCH)))!==PATCH_HASH)throw Error('Cache patch integrity mismatch');
 const seen=new Set();let found=0;
 async function walk(dir){
  const canonical=await realpath(dir);if(seen.has(canonical))return;seen.add(canonical);
  if(seen.size>100000)throw Error('Dependency scan limit exceeded');
  const entries=await readdir(dir,{withFileTypes:true});
  const manifest=entries.find(entry=>entry.name==='package.json'&&(entry.isFile()||entry.isSymbolicLink()));
  if(manifest){
   const metadata=JSON.parse(await readFile(join(dir,'package.json'),'utf8'));
   if(metadata.name==='http-cache-semantics'){
    if(metadata.version!=='4.2.0'||(metadata.main&&metadata.main!=='index.js')||metadata.exports)throw Error('Unexpected cache package entrypoint');
    if(hash(await readFile(join(dir,'index.js')))!==MODULE_HASH)throw Error('Unpatched cache-policy copy');
    found++;
   }
  }
  for(const entry of entries)if(entry.isDirectory()||entry.isSymbolicLink()){
   const path=join(dir,entry.name);
   try{await walk(path);}catch(error){if(error?.code!=='ENOTDIR')throw error;}
  }
 }
 await walk(join(root,'node_modules'));
 if(!found)throw Error('Patched cache dependency is absent');
 const entry=require.resolve('http-cache-semantics',{paths:[root]});
 if(hash(await readFile(entry))!==MODULE_HASH||JSON.parse(await readFile(join(dirname(entry),'package.json'),'utf8')).name!=='http-cache-semantics')throw Error('Resolved cache entrypoint mismatch');
 return {verifiedCopies:found};
}
export async function runAudit(){
 const proof=await verifyPatchedDependency();
 const regression=spawnSync(process.execPath,['test','scripts/cache-policy-security.test.ts'],{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
 if(regression.error||regression.status!==0)throw Error('Installed cache regression tests failed');
 const audit=spawnSync(process.execPath,['audit','--json'],{encoding:'utf8',timeout:120000,maxBuffer:10*1024*1024});
 if(audit.error||audit.signal)throw Error('Dependency audit unavailable');
 const result=classifyAudit(JSON.parse(audit.stdout),audit.status);
 console.log(JSON.stringify({...proof,...result}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)runAudit().catch(error=>{console.error(error.message);process.exitCode=1;});
