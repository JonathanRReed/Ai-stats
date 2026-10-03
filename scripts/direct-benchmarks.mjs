import {createHash} from 'node:crypto';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
const timestamp=value=>{
 if(!text(value)||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('Invalid source timestamp');
 return new Date(value).toISOString();
};
const commit=value=>{
 if(!/^[a-f0-9]{7,40}$/.test(value??''))throw new Error('Missing publisher commit');
 return value;
};
const nonempty=records=>{
 if(!records.length)throw new Error('No complete publisher results; retain last good snapshot');
 if(new Set(records.map(row=>row.systemId)).size!==records.length)throw new Error('Duplicate publisher system identity');
 return records;
};
export function parseBenchmarkCsv(body){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<body.length;i++){
  const c=body[i],next=body[i+1];
  if(c==='"'){if(quoted&&next==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(field);field='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}
  else field+=c;
 }
 if(quoted)throw new Error('Unterminated CSV field');
 if(field||row.length){row.push(field);rows.push(row);}
 const [header,...values]=rows;
 if(!header?.length||new Set(header).size!==header.length)throw new Error('Invalid CSV header');
 return values.map(values=>{if(values.length!==header.length)throw new Error('CSV column count changed');return Object.fromEntries(header.map((key,i)=>[key,values[i]]));});
}

/** Published Global Average is the mean of category means, NOT question-weighted. */
export function normalizeLiveBench({version,categories,csv,commit:revision,fetchedAt}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(version)||new Date(version+'T00:00:00Z').toISOString().slice(0,10)!==version)throw new Error('Invalid LiveBench release');
 commit(revision);const fetched=timestamp(fetchedAt);
 const groups=Object.entries(categories??{});
 if(!groups.length||groups.some(([,columns])=>!Array.isArray(columns)||!columns.length||columns.some(column=>!text(column))))throw new Error('Invalid LiveBench category schema');
 const rows=parseBenchmarkCsv(csv),records=[];
 for(const row of rows){
  const modelId=text(row.model);if(!modelId)continue;
  const means=groups.map(([name,columns])=>{
   const values=columns.map(column=>row[column]?.trim()).filter(value=>value!==undefined&&value!=='').map(Number);
   if(!values.length||values.some(value=>!finite(value)||value<0||value>100))return null;
   return [name,values.reduce((a,b)=>a+b,0)/values.length];
  });
  if(means.some(value=>value===null))continue;
  const scores=Object.fromEntries(means),values=Object.values(scores);
  // These two source-published overrides are present in upstream Averaging.js.
  const publishedOverride=modelId==='grok-3-thinking'?72:modelId==='grok-3'?58:null;
  const score=publishedOverride??Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(2));
  records.push({systemId:'livebench:'+version+':'+modelId,modelId,label:modelId,benchmarkSlug:'livebench',benchmarkVersion:version,
   metric:'Global Average',unit:'points',score,higherIsBetter:true,conditions:{aggregation:'equal category means'},
   categoryScores:scores,evaluatedAt:null,sourceUrl:'https://livebench.ai/',sourceCommit:revision});
 }
 return {schemaVersion:1,sourceKey:'livebench',fetchedAt:fetched,observedAt:null,benchmarkVersion:version,
  sourceUrl:'https://github.com/LiveBench/new-livebench/blob/'+revision+'/public/table_'+version.replaceAll('-','_')+'.csv',
  records:nonempty(records)};
}

/** Preserve provider/harness-specific systems and published composite scores. */
export function normalizeWeirdML(payload,fetchedAt){
 if(payload?.schema_version!==1||payload.mode!=='real'||!Array.isArray(payload.models))throw new Error('Unsupported WeirdML source schema');
 const observed=timestamp(payload.generated),fetched=timestamp(fetchedAt);commit(payload.source_commit);
 const records=payload.models.filter(model=>model.synthetic!==true).map(model=>{
  if(!text(model.id)||!text(model.name)||!finite(model.score)||model.score<0||model.score>1)throw new Error('Invalid WeirdML result');
  if(!Array.isArray(model.harnesses)||!model.harnesses.length)throw new Error('Missing WeirdML system conditions');
  const harnesses=model.harnesses.map(h=>{if(!text(h.name)||!text(h.version))throw new Error('Missing harness identity');return h.name+'@'+h.version;}).join(' · ');
  return {systemId:'weirdml:v3:'+model.id,modelId:text(model.slug)??model.id,label:model.name,benchmarkSlug:'weirdml',benchmarkVersion:'v3',
   metric:'Composite score',unit:'fraction',score:model.score,higherIsBetter:true,
   conditions:{agent:text(model.agent),harnesses,reasoningEffort:text(model.reasoning_effort)},
   interval:Array.isArray(model.interval)&&model.interval.length===2&&model.interval.every(finite)?model.interval:null,
   runs:Number.isSafeInteger(model.runs)?model.runs:null,evaluatedAt:null,sourceUrl:'https://htihle.github.io/weirdml.html',sourceCommit:payload.source_commit};
 });
 return {schemaVersion:1,sourceKey:'weirdml',fetchedAt:fetched,observedAt:observed,benchmarkVersion:'v3',
  sourceUrl:'https://htihle.github.io/assets/data/weirdml_v3.json',records:nonempty(records)};
}

/** Use the publisher's weighted aggregate; never substitute historical v1.1. */
export function normalizePostTrainBench(payload,revision,fetchedAt){
 if(payload?.resultsVersion!=='v1.2'||!Array.isArray(payload.benchmarkKeys)||!payload.benchmarkKeys.length||!payload.benchmarkWeights||!payload.aggregatedScores)throw new Error('Unsupported PostTrainBench source schema');
 commit(revision);const fetched=timestamp(fetchedAt);
 const weights=payload.benchmarkKeys.map(key=>payload.benchmarkWeights[key]);
 if(weights.some(value=>!finite(value)||value<0)||Math.abs(weights.reduce((a,b)=>a+b,0)-1)>1e-8)throw new Error('Invalid PostTrainBench weighting');
 const records=Object.entries(payload.aggregatedScores).map(([modelId,result])=>{
  if(!text(modelId)||!finite(result.avg)||result.avg<0||result.avg>100||!Number.isSafeInteger(result.n)||result.n<1)throw new Error('Invalid PostTrainBench result');
  return {systemId:'posttrainbench:v1.2:'+modelId,modelId,label:modelId,benchmarkSlug:'posttrainbench',benchmarkVersion:'v1.2',
   metric:'Weighted aggregate',unit:'percent',score:result.avg,higherIsBetter:true,
   conditions:{benchmarkWeights:JSON.stringify(payload.benchmarkWeights)},runs:result.n,
   standardDeviation:finite(result.std)?result.std:null,evaluatedAt:null,
   sourceUrl:'https://posttrainbench.com/',sourceCommit:revision};
 });
 return {schemaVersion:1,sourceKey:'posttrainbench',fetchedAt:fetched,observedAt:null,benchmarkVersion:'v1.2',
  sourceUrl:'https://github.com/aisa-group/posttrainbench-website/blob/'+revision+'/scores-v1.2.json',records:nonempty(records)};
}
export const publisherContentHash=snapshot=>createHash('sha256').update(JSON.stringify({sourceKey:snapshot.sourceKey,benchmarkVersion:snapshot.benchmarkVersion,records:snapshot.records})).digest('hex');
