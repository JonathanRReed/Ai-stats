import {COMPARE_CHARTS,AA_METRIC_LABELS} from './compare-state';
import {expandCatalog,measurementBucket,validateMeasurementChunk,type CompareDelivery} from './compare-delivery';
import type {ExplorerModel} from './compare-series';
export const RELEASE_SCHEMA='ai-stats-compare-release.v1';
export type ReleaseSource={sourceKey:string;fetchedAt:string|null;publishedAt:string|null;observedAt:string|null;contentHash:string|null;snapshotId:string|null;status:string;available:boolean};
export type CompareReleaseManifest={schemaVersion:typeof RELEASE_SCHEMA;generatedAt:string;models:ExplorerModel[];defaultModelIds:string[];benchmarks:Array<{slug:string;name:string}>;sources:ReleaseSource[];delivery:CompareDelivery};
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=2048;
const date=(value:unknown)=>value===null||typeof value==='string'&&Number.isFinite(Date.parse(value));
const nullableText=(value:unknown)=>value===null||text(value);
const sources=new Set(['artificial-analysis','epoch-ai','openrouter','huggingface','litellm','polibench','openrouter-usage']);
export function readCompareRelease(value:unknown):CompareReleaseManifest{
 if(!object(value)||value.schemaVersion!==RELEASE_SCHEMA||!text(value.generatedAt)||!date(value.generatedAt)||!object(value.delivery))throw new Error('Invalid release manifest');
 const delivery=value.delivery,catalog=delivery.catalog;
 if(!text(delivery.revision)||!/^[a-f0-9]{64}$/.test(delivery.revision)||!object(catalog)||!Array.isArray(catalog.providers)||!catalog.providers.every(text)||
 !Array.isArray(catalog.rows)||catalog.rows.length<2||catalog.rows.length>30000)throw new Error('Invalid release catalog');
 const ids=new Set<string>();
 for(const row of catalog.rows){
 if(!Array.isArray(row)||row.length!==10||!text(row[0])||ids.has(row[0])||!text(row[1])||
 !Number.isInteger(row[2])||row[2]<0||row[2]>=catalog.providers.length||
 !Number.isInteger(row[3])||row[3]<0||row[3]>5||!(row[4]===null||typeof row[4]==='boolean')||
 ![row[5],row[6],row[7],row[8]].every(nullableText)||!Number.isInteger(row[9])||row[9]<0||row[9]>3)throw new Error('Invalid compact model identity');
 ids.add(row[0]);
 }
 if(!Array.isArray(value.models)||value.models.length<2||value.models.length>100||!Array.isArray(value.defaultModelIds)||
 value.defaultModelIds.length!==value.models.length||new Set(value.defaultModelIds).size!==value.defaultModelIds.length||
 !value.defaultModelIds.every(id=>text(id)&&ids.has(id))||!value.models.every(row=>object(row)&&text(row.id)&&value.defaultModelIds.includes(row.id))||
 new Set(value.models.map(row=>row.id)).size!==value.models.length)throw new Error('Invalid release seed');
 const typed=value as unknown as CompareReleaseManifest,expanded=expandCatalog(typed.delivery.catalog);
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
