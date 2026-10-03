import type {CompareChart} from './compare-state';
export const SOURCE_RECORD_TYPES:Record<string,string>={'artificial-analysis':'aa','epoch-ai':'epoch',openrouter:'openrouter',huggingface:'huggingface',litellm:'litellm',catalog:'catalog',publisher:'publisher'};
export function compareRecordHref(id:string,chart?:CompareChart,includeHistory=false):string{
 const params=new URLSearchParams({m:id});if(chart)params.set('chart',chart);if(includeHistory)params.set('history','1');return '/compare?'+params.toString();
}
export function sourceRecordHref(source:string,key:string,inventoryId?:string):string{
 const params=new URLSearchParams({source,record:key});
 if(inventoryId?.startsWith('catalog:'))params.set('inventory',inventoryId);
 if(source==='openrouter'||source==='litellm')params.set('chart','price');
 return '/compare?'+params.toString();
}
