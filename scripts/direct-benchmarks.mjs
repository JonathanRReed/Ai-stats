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

/** The current OSWorld release is explicit on each result, not inferred from model dates. */
export function normalizeOSWorld(payload,fetchedAt){
 if(payload?.benchmarkVersion!=='OSWorld 2.0'||!Array.isArray(payload.releaseVersions)||!Array.isArray(payload.results)||payload.defaultMetric!=='binaryAccuracy')throw new Error('Unsupported OSWorld source schema');
 const versions=payload.releaseVersions;
 if(versions.at(-1)!=='v2.1')throw new Error('OSWorld release changed; review before updating');
 const version='v2.1',records=payload.results.filter(row=>row.releaseVersion===version&&row.official===true&&row.datasetScope==='full').map(row=>{
  if(!text(row.model)||!text(row.reasoning)||!text(row.toolSetting)||!Number.isSafeInteger(row.stepBudget)||row.stepBudget<=0||!finite(row.binaryAccuracy)||row.binaryAccuracy<0||row.binaryAccuracy>100)throw new Error('Invalid OSWorld result');
  const systemId='osworld:'+JSON.stringify([version,row.model,row.reasoning,row.toolSetting,row.stepBudget,row.datasetScope]);
  return {systemId,modelId:row.model,label:row.model,benchmarkSlug:'osworld',benchmarkVersion:version,metric:'Binary Accuracy',unit:'percent',score:row.binaryAccuracy,higherIsBetter:true,
   conditions:{reasoningEffort:row.reasoning,toolSetting:row.toolSetting,stepBudget:row.stepBudget,datasetScope:row.datasetScope},evaluatedAt:null,sourceUrl:'https://osworld-v2.xlang.ai/'};
 });
 return {schemaVersion:1,sourceKey:'osworld',fetchedAt:timestamp(fetchedAt),observedAt:null,benchmarkVersion:version,sourceUrl:'https://osworld-v2.xlang.ai/static/data/leaderboard/official-results.json',
  publisherUpdatedDate:typeof payload.updatedAt==='string'?payload.updatedAt:null,records:nonempty(records)};
}

export function normalizeProofBench(payload,fetchedAt){
 const meta=payload?.metadata;
 if(meta?.slug!=='proof_bench'||meta.version!=='1.1'||meta.archived!==false||!payload.tasks?.overall||!Array.isArray(meta.models))throw new Error('Unsupported ProofBench release');
 const records=Object.entries(payload.tasks.overall).map(([modelId,row])=>{
  if(!meta.models.includes(modelId)||!finite(row.accuracy)||row.accuracy<0||row.accuracy>100)throw new Error('Invalid ProofBench result');
  return {systemId:'proofbench:v1.1:'+modelId,modelId,label:modelId,provider:text(row.provider)??modelId.split('/')[0],benchmarkSlug:'proofbench',benchmarkVersion:'v1.1',metric:'Accuracy',unit:'percent',score:row.accuracy,higherIsBetter:true,
   conditions:{reasoningEffort:text(row.reasoning_effort)??text(row.compute_effort),harness:text(row.harness),temperature:finite(row.temperature)?row.temperature:null,maxOutputTokens:Number.isSafeInteger(row.max_output_tokens)?row.max_output_tokens:null},
   stderr:finite(row.stderr)?row.stderr:null,evaluatedAt:null,sourceUrl:'https://www.vals.ai/benchmarks/proof_bench'};
 });
 if(records.length!==meta.total_models||records.length!==meta.models.length)throw new Error('Incomplete ProofBench result set');
 return {schemaVersion:1,sourceKey:'proofbench',fetchedAt:timestamp(fetchedAt),observedAt:null,benchmarkVersion:'v1.1',sourceUrl:'https://www.vals.ai/benchmarks/proof_bench',publisherUpdatedDate:meta.updated,records:nonempty(records)};
}

const htmlText=value=>value.replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:\d+|x[a-f0-9]+);/gi,entity=>{
 const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '};
 if(named[entity])return named[entity];
 const numeric=entity.slice(2,-1),point=numeric[0].toLowerCase()==='x'?parseInt(numeric.slice(1),16):Number(numeric);
 return point<=0x10ffff?String.fromCodePoint(point):'';
}).replace(/\s+/g,' ').trim();
/** Only the publisher's explicitly headed scoreboard, not charts or narrative figures. */
export function normalizeBlueprintBench(html,fetchedAt){
 if(typeof html!=='string'||!html.includes('Blueprint-Bench 2'))throw new Error('Unsupported Blueprint-Bench page');
 const tables=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
 const parsed=tables.map(table=>[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row=>[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell=>htmlText(cell[1]))));
 const boards=parsed.filter(rows=>JSON.stringify(rows[0])===JSON.stringify(['','Model','Score']));
 if(boards.length!==1)throw new Error('Blueprint-Bench scoreboard changed');
 const records=boards[0].slice(1).filter(row=>row[1]!=='Human*').map(row=>{
  if(row.length!==3||!/^\d+$/.test(row[0])||!text(row[1])||!/^\d+\.\d+(\*\*)?$/.test(row[2]))throw new Error('Invalid Blueprint-Bench row');
  const score=Number(row[2].replace('**',''));if(!finite(score)||score<0||score>1)throw new Error('Invalid Blueprint-Bench score');
  return {systemId:'blueprint-bench:2:'+row[1],modelId:row[1],label:row[1],benchmarkSlug:'blueprint-bench',benchmarkVersion:'2',metric:'Normalized connectivity score',unit:'points',score,higherIsBetter:true,
   conditions:{apartments:50,notepad:'persistent',...(row[2].endsWith('**')?{scoreDisclosure:'at or below random baseline'}:{})},evaluatedAt:null,sourceUrl:'https://andonlabs.com/evals/blueprint-bench-2'};
 });
 return {schemaVersion:1,sourceKey:'blueprint-bench',fetchedAt:timestamp(fetchedAt),observedAt:null,benchmarkVersion:'2',sourceUrl:'https://andonlabs.com/evals/blueprint-bench-2',records:nonempty(records)};
}

export function normalizeApexAgents(html,fetchedAt){
 const scripts=[...html.matchAll(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi)];
 if(scripts.length!==1)throw new Error('APEX published page data changed');
 const payload=JSON.parse(scripts[0][1]),page=payload?.props?.pageProps,benchmark=page?.benchmark;
 if(benchmark?.benchmarkId!=='apex-agents'||benchmark.dataLink!=='https://huggingface.co/datasets/mercor/apex-agents-v1.1'||!Array.isArray(page.leaderboardData))throw new Error('Unsupported APEX-Agents release');
 const records=page.leaderboardData.map(row=>{
  const score=row.score?.['pass-1']?.loop_truncated_tools_agent,error=row.error?.['pass-1']?.loop_truncated_tools_agent;
  if(!text(row.model_id)||!text(row.model_name)||!finite(score)||score<0||score>100||!Number.isSafeInteger(row.n_samples)||row.n_samples<=0)throw new Error('Invalid APEX-Agents result');
  return {systemId:'apex-agents:v1.1:'+row.model_id+':'+(text(row.effort)??'unknown'),modelId:row.model_id,label:row.model_name,provider:text(row.providerName)??undefined,
   benchmarkSlug:'apex-agents',benchmarkVersion:'v1.1',metric:'Pass@1',unit:'percent',score,higherIsBetter:true,
   conditions:{harness:'loop_truncated_tools_agent',reasoningEffort:text(row.effort),samples:row.n_samples,descriptors:Array.isArray(row.descriptors)?row.descriptors.join(' · '):null},
   reportedError:finite(error)?error:null,evaluatedAt:null,sourceUrl:'https://www.mercor.com/apex/apex-agents-leaderboard/?pass=pass-1'};
 });
 return {schemaVersion:1,sourceKey:'apex-agents',fetchedAt:timestamp(fetchedAt),observedAt:null,benchmarkVersion:'v1.1',sourceUrl:'https://www.mercor.com/apex/apex-agents-leaderboard/?pass=pass-1',records:nonempty(records)};
}

function divContents(html,start){
 const tags=/<\/?div\b[^>]*>/gi;tags.lastIndex=start;let depth=0,begin=-1,match;
 while((match=tags.exec(html))){
  if(begin<0){if(match.index!==start)throw new Error('Invalid scoreboard element');begin=tags.lastIndex;}
  depth+=match[0].startsWith('</')?-1:1;
  if(depth===0)return html.slice(begin,match.index);
 }
 throw new Error('Unclosed scoreboard element');
}
export function normalizeGdpPdf(html,fetchedAt){
 if(typeof html!=='string'||!html.includes('GDP.pdf'))throw new Error('Unsupported GDP.pdf page');
 const tableMatches=[...html.matchAll(/<div\b[^>]*\bdata-leaderboard-table=["'][^"']*["'][^>]*>/gi)];
 const overall=tableMatches.filter(match=>/class=["'][^"']*\blead-rank-table-list-body\b[^"']*["']/.test(match[0]));
 if(overall.length!==1)throw new Error('GDP.pdf scoreboard changed');
 const table=divContents(html,overall[0].index),rowTags=[...table.matchAll(/<div\b[^>]*\bdata-leaderboard-row=["'][^"']*["'][^>]*>/gi)];
 const field=(row,className)=>{
  const opening=[...row.matchAll(/<div\b[^>]*\bclass=["']([^"']*)["'][^>]*>/gi)].find(match=>match[1].split(/\s+/).includes(className));
  if(!opening)throw new Error('Missing GDP.pdf model label');
  return htmlText(divContents(row,opening.index));
 };
 const records=rowTags.map(tag=>{
  const row=divContents(table,tag.index),brand=field(row,'head-rank-table-brand'),name=field(row,'head-rank-table-name');
  const scoreTags=[...row.matchAll(/<div\b(?=[^>]*\bfs-list-field=["']foundational-score["'])(?=[^>]*\bdata-score=["']([^"']+)["'])[^>]*>/gi)];
  if(scoreTags.length!==1||!/^\d+(\.\d+)?$/.test(scoreTags[0][1]))throw new Error('Invalid GDP.pdf overall score');
  const score=Number(scoreTags[0][1]),label=brand+' '+name;
  if(!name||!brand||score<0||score>100)throw new Error('Invalid GDP.pdf result');
  const provider=/alt=["']([^"']+) logo["']/i.exec(row)?.[1];
  return {systemId:'gdp-pdf:'+label,modelId:label,label,provider,benchmarkSlug:'gdp-pdf',benchmarkVersion:'unversioned',metric:'GDP.pdf score',unit:'percent',score,higherIsBetter:true,
   conditions:{configuration:name.match(/\(([^)]+)\)/)?.[1]??null},evaluatedAt:null,sourceUrl:'https://surgehq.ai/benchmarks/gdp-pdf'};
 });
 return {schemaVersion:1,sourceKey:'gdp-pdf',fetchedAt:timestamp(fetchedAt),observedAt:null,benchmarkVersion:'unversioned',sourceUrl:'https://surgehq.ai/benchmarks/gdp-pdf',records:nonempty(records)};
}

export function normalizeTerminalBench(payload,fetchedAt){
 if(payload?.name!=='4-0-0'||payload.visibility!=='public'||!Array.isArray(payload.rows)||!payload.rows.length)throw new Error('Unsupported public Terminal-Bench release');
 const records=payload.rows.filter(row=>row.status==='display').map(row=>{
  const meta=row.metadata,metrics=row.metrics;
  if(!text(row.id)||row.leaderboard_id!==payload.id||!text(meta?.agent_display?.label)||!text(meta?.model_display?.label)||!text(meta?.reasoning_effort)||!finite(metrics?.accuracy)||metrics.accuracy<0||metrics.accuracy>100||!Number.isSafeInteger(metrics.n_trials)||metrics.n_trials<=0)throw new Error('Invalid Terminal-Bench result');
  return {systemId:'terminal-bench:4.0.0:'+row.id,modelId:meta.model_display.label,label:meta.model_display.label,provider:text(meta.model_org?.label)??undefined,
   benchmarkSlug:'terminal-bench',benchmarkVersion:'4.0.0',metric:'Accuracy',unit:'percent',score:metrics.accuracy,higherIsBetter:true,
   conditions:{agent:meta.agent_display.label,reasoningEffort:meta.reasoning_effort,trials:metrics.n_trials},
   confidence95HalfWidth:finite(metrics.accuracy_ci95_half_width)?metrics.accuracy_ci95_half_width:null,
   totalTokens:finite(metrics.total_tokens)?metrics.total_tokens:null,totalCostUsd:finite(metrics.total_cost_usd)?metrics.total_cost_usd:null,
   publisherRowId:row.id,evaluatedAt:null,sourceUrl:'https://hub.harborframework.com/datasets/terminal-bench/terminal-bench/latest?leaderboard=4-0-0&tab=leaderboard'};
 });
 const dates=payload.rows.map(row=>row.updated_at).filter(value=>typeof value==='string'&&Number.isFinite(Date.parse(value)));
 return {schemaVersion:1,sourceKey:'terminal-bench',fetchedAt:timestamp(fetchedAt),observedAt:dates.length?new Date(Math.max(...dates.map(Date.parse))).toISOString():null,benchmarkVersion:'4.0.0',refreshMode:'automatic',
  sourceUrl:'https://hub.harborframework.com/datasets/terminal-bench/terminal-bench/latest?leaderboard=4-0-0&tab=leaderboard',records:nonempty(records)};
}
