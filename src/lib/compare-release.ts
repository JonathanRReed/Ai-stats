import {COMPARE_CHARTS,AA_METRIC_LABELS} from './compare-state';
import {expandCatalog,measurementBucket,validateMeasurementChunk,type CompareDelivery} from './compare-delivery';
import type {ExplorerModel} from './compare-series';
import {validateBrowseRanks} from './compare-browse-rank';
export const RELEASE_SCHEMA='ai-stats-compare-release.v4';
export const LEGACY_RELEASE_SCHEMA='ai-stats-compare-release.v1';
const ACCEPTED_SCHEMAS=[RELEASE_SCHEMA,'ai-stats-compare-release.v3','ai-stats-compare-release.v2',LEGACY_RELEASE_SCHEMA] as const;
const REQUIRED_SUGGESTION_CHARTS=['task-cost','cost-intelligence','speed-intelligence','price','total-cost'] as const;
const FRONTIER_CHARTS=['task-cost','cost-intelligence','speed-intelligence','total-cost'] as const;
export type ReleaseSource={sourceKey:string;fetchedAt:string|null;publishedAt:string|null;observedAt:string|null;contentHash:string|null;snapshotId:string|null;status:string;available:boolean};
export type CompareReleaseManifest={schemaVersion:typeof ACCEPTED_SCHEMAS[number];generatedAt:string;datasetRevision:string;models:ExplorerModel[];defaultModelIds:string[];benchmarks:Array<{slug:string;name:string}>;sources:ReleaseSource[];delivery:CompareDelivery};
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=2048;
const date=(value:unknown)=>value===null||typeof value==='string'&&Number.isFinite(Date.parse(value));
const nullableText=(value:unknown)=>value===null||text(value);
const sources=new Set(['artificial-analysis','epoch-ai','openrouter','huggingface','litellm','polibench','openrouter-usage','livebench','weirdml','posttrainbench','terminal-bench','osworld','proofbench','blueprint-bench','apex-agents','gdp-pdf']);
export function readCompareRelease(value:unknown):CompareReleaseManifest{
 if(!object(value)||!ACCEPTED_SCHEMAS.includes(value.schemaVersion as typeof ACCEPTED_SCHEMAS[number])||typeof value.datasetRevision!=='string'||!/^[a-f0-9]{64}$/.test(value.datasetRevision)||!text(value.generatedAt)||!date(value.generatedAt)||!object(value.delivery))throw new Error('Invalid release manifest');
 const delivery=value.delivery,catalog=delivery.catalog;
 if('assetBase' in delivery||'benchmarkBase' in delivery)throw new Error('Release paths must be derived by the client');
 if(!text(delivery.revision)||!/^[a-f0-9]{64}$/.test(delivery.revision)||!object(catalog)||!Array.isArray(catalog.providers)||!catalog.providers.every(text)||
 !Array.isArray(catalog.rows)||catalog.rows.length<2||catalog.rows.length>30000)throw new Error('Invalid release catalog');
 const ids=new Set<string>();
 for(const row of catalog.rows){
 if(!Array.isArray(row)||row.length!==10||!text(row[0])||ids.has(row[0])||!text(row[1])||
 !Number.isInteger(row[2])||row[2]<0||row[2]>=catalog.providers.length||
 !Number.isInteger(row[3])||row[3]<0||row[3]>(value.schemaVersion===LEGACY_RELEASE_SCHEMA?5:6)||!(row[4]===null||typeof row[4]==='boolean')||
 ![row[5],row[6],row[7],row[8]].every(nullableText)||!Number.isInteger(row[9])||row[9]<0||row[9]>3)throw new Error('Invalid compact model identity');
 ids.add(row[0]);
 }
 const minSeedSize=value.schemaVersion===RELEASE_SCHEMA?1:2;
 if(!Array.isArray(value.models)||value.models.length<minSeedSize||value.models.length>100||!Array.isArray(value.defaultModelIds)||
 value.defaultModelIds.length<minSeedSize||value.defaultModelIds.length!==value.models.length||new Set(value.defaultModelIds).size!==value.defaultModelIds.length||
 !value.defaultModelIds.every(id=>text(id)&&ids.has(id))||!value.models.every(row=>object(row)&&text(row.id)&&(value.defaultModelIds as unknown[]).includes(row.id))||
 new Set(value.models.map(row=>row.id)).size!==value.models.length)throw new Error('Invalid release seed');
 if(delivery.aaBenchmarkSelections!==undefined){
  if(!object(delivery.aaBenchmarkSelections))throw new Error('Invalid AA benchmark selections');
  const catalogRows=catalog.rows as unknown[][];
  for(const [key,groups] of Object.entries(delivery.aaBenchmarkSelections)){
   if(!Object.hasOwn(AA_METRIC_LABELS,key)||!object(groups))throw new Error('Invalid AA benchmark selections');
   for(const mode of ['current','historical']){const list=groups[mode];if(!Array.isArray(list)||list.length>8||new Set(list).size!==list.length||!list.every(id=>typeof id==='string'&&catalogRows.some(row=>row[0]===id&&row[3]===0&&(mode==='historical'||row[4]!==false))))throw new Error('Invalid AA benchmark selection identity');}
  }
 }
 if(delivery.suggestedModelIds!==undefined){
  if(!object(delivery.suggestedModelIds))throw new Error('Invalid suggested model selections');
  const compactRows=catalog.rows as unknown[][];
  for(const [chart,list] of Object.entries(delivery.suggestedModelIds)){
   if(!COMPARE_CHARTS.includes(chart as typeof COMPARE_CHARTS[number])||!Array.isArray(list)||list.length>(value.schemaVersion===RELEASE_SCHEMA?100:8)||new Set(list).size!==list.length||!list.every(id=>typeof id==='string'&&compactRows.some(row=>row[0]===id&&row[4]===true&&(chart==='price'?Boolean(Number(row[9])&1):row[3]===0&&Boolean(Number(row[9])&2)))))throw new Error('Invalid suggested model selection');
  }
 }
 if(value.schemaVersion===RELEASE_SCHEMA){
  if(delivery.frontierPolicy!=='compatible-cohort-frontier.v1')throw new Error('Current releases require a compatible frontier policy');
  const suggestions=delivery.suggestedModelIds;
  if(!object(suggestions)||!REQUIRED_SUGGESTION_CHARTS.every(chart=>Array.isArray(suggestions[chart])))throw new Error('Current releases require complete chart suggestion metadata');
  const coverage=delivery.suggestionFrontierCounts;
  if(!object(coverage)||!FRONTIER_CHARTS.every(chart=>object(coverage[chart])))throw new Error('Current releases require complete frontier coverage metadata');
  for(const chart of FRONTIER_CHARTS){const entry=coverage[chart] as Record<string,unknown>;const total=entry.total;const truncated=entry.truncated;const ids=suggestions[chart];
   if(!Array.isArray(ids)||!Number.isInteger(total)||Number(total)<0||typeof truncated!=='boolean'||truncated!==(Number(total)>100)||ids.length!==Math.min(Number(total),100))throw new Error('Invalid frontier coverage metadata');}
  const seedIds=new Set(value.models.map(model=>model.id));
  if(seedIds.size!==value.defaultModelIds.length||value.defaultModelIds.some(id=>!seedIds.has(id)))throw new Error('Current release seed must match default model identities');
  if(delivery.suggestionFrontierCounts!==undefined){
   if(!object(delivery.suggestionFrontierCounts))throw new Error('Invalid frontier coverage metadata');
   for(const [chart,coverage] of Object.entries(delivery.suggestionFrontierCounts))if(!REQUIRED_SUGGESTION_CHARTS.includes(chart as typeof REQUIRED_SUGGESTION_CHARTS[number])||!object(coverage)||!Number.isInteger(coverage.total)||Number(coverage.total)<0||typeof coverage.truncated!=='boolean'||coverage.truncated!==(Number(coverage.total)>100))throw new Error('Invalid frontier coverage metadata');
  }
 }
 const typed=value as unknown as CompareReleaseManifest,expanded=expandCatalog(typed.delivery.catalog);
 // Rank metadata is optional for older v4 releases, but when present it must be a valid,
 // catalog-consistent contract; a malformed rank list never reaches the family browser.
 if(catalog.browseRanks!==undefined)validateBrowseRanks(catalog.browseRanks,expanded);
 for(const bucket of new Set(typed.models.map(model=>measurementBucket(model.id)))){
 const rows=typed.models.filter(model=>measurementBucket(model.id)===bucket);
 validateMeasurementChunk({schemaVersion:1,revision:delivery.revision,bucket,records:rows},String(delivery.revision),bucket,expanded.filter(model=>typed.defaultModelIds.includes(model.id)));
 }
 if(!Array.isArray(delivery.charts)||!delivery.charts.length||!delivery.charts.every(chart=>object(chart)&&COMPARE_CHARTS.includes(chart.id as typeof COMPARE_CHARTS[number])&&text(chart.label))||
 !Array.isArray(delivery.aaMetrics)||!delivery.aaMetrics.every(metric=>Array.isArray(metric)&&metric.length===2&&typeof metric[0]==='string'&&Object.hasOwn(AA_METRIC_LABELS,metric[0])&&text(metric[1]))||
 !Array.isArray(delivery.presets)||!delivery.presets.every(preset=>object(preset)&&text(preset.id)&&text(preset.label)&&text(preset.description)&&
 COMPARE_CHARTS.includes(preset.chart as typeof COMPARE_CHARTS[number])&&typeof preset.metricId==='string'&&Object.hasOwn(AA_METRIC_LABELS,preset.metricId)&&
 Array.isArray(preset.modelIds)&&preset.modelIds.length>0&&preset.modelIds.length<=100&&preset.modelIds.every(id=>text(id)&&ids.has(id))))throw new Error('Invalid release controls');
 if(!Array.isArray(value.benchmarks)||!value.benchmarks.every(row=>object(row)&&text(row.slug)&&/^[a-z0-9_-]{1,120}$/.test(row.slug)&&text(row.name))||
 new Set(value.benchmarks.map(row=>row.slug)).size!==value.benchmarks.length)throw new Error('Invalid release benchmarks');
 if(!Array.isArray(value.sources)||!value.sources.length||!value.sources.every(row=>object(row)&&typeof row.sourceKey==='string'&&sources.has(row.sourceKey)&&
 typeof row.available==='boolean'&&typeof row.status==='string'&&['healthy','stale','failed','partial','unavailable'].includes(row.status)&&
 date(row.fetchedAt)&&date(row.publishedAt)&&date(row.observedAt)&&nullableText(row.snapshotId)&&
 (row.contentHash===null||typeof row.contentHash==='string'&&/^[a-f0-9]{64}$/.test(row.contentHash))))throw new Error('Invalid source receipts');
 return typed;
}
export const benchmarkAssetKey=(slug:string)=>'b_'+[...new TextEncoder().encode(slug)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
