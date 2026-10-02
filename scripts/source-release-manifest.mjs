import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

const retrievalKeys = new Set(['fetchedAt','fetched_at','publishedAt','published_at','last_seen','first_seen','updated_at']);
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key])=>!retrievalKeys.has(key)).sort(([a],[b])=>a.localeCompare(b))
    .map(([key,item])=>[key,canonical(item)]));
  return value;
};
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function buildSourceReleaseManifest(input) {
  if (!input?.aa?.models?.length || !input.epoch || !input.polibench) throw new Error('Missing release source input');
  const models=input.aa.models.map(model=>{
    const {source_metadata: metadata,...rest}=model;
    if (!metadata) return rest;
    const {observed_at: _retrieved,...conditions}=metadata;
    return {...rest,source_metadata:conditions};
  }).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  return {schemaVersion:1,sources:{
    'artificial-analysis':hash(models),
    'epoch-ai':hash({models:input.epoch.models,benchmarks:input.epoch.benchmarks,runs:input.epoch.runs}),
    polibench:hash(input.polibench),
  }};
}
export async function writeSourceReleaseManifest(inputPath, outputPath) {
  if (!inputPath || !outputPath) throw new Error('Input and output paths are required');
  const manifest=buildSourceReleaseManifest(JSON.parse(await readFile(inputPath,'utf8')));
  await mkdir(dirname(outputPath),{recursive:true});
  await writeFile(outputPath,JSON.stringify(manifest)+'\n');
  return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  writeSourceReleaseManifest(process.argv[2],process.argv[3]).then(result=>console.log(JSON.stringify(result)))
    .catch(()=>{console.error('Source release manifest failed validation');process.exitCode=1;});
}
