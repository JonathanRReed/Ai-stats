import type {CompareWorkload} from './compare-series';

/** Display choices layered on a comparison. They travel in the link but never change the selection or the data. */
export type BlendWeights={intelligence:number;coding:number;speed:number};
export type CompareViewOptions={
 view:'chart'|'bars'|'table';
 /** A cost ceiling on the horizontal axis, in that axis's unit. */
 budget:number|null;
 valueLines:boolean;
 sizeBySpeed:boolean;
 /** First day of a month (YYYY-MM-01): show only what had been released by the end of it. */
 asOf:string|null;
 workload:CompareWorkload|null;
 weights:BlendWeights|null;
};
export const DEFAULT_VIEW_OPTIONS:CompareViewOptions={view:'chart',budget:null,valueLines:false,sizeBySpeed:false,asOf:null,workload:null,weights:null};

const positive=(value:string|null):number|null=>{
 if(value===null||value.trim()==='')return null;
 const parsed=Number(value);
 return Number.isFinite(parsed)&&parsed>0?parsed:null;
};
const tokens=(value:string|null):number|null=>{
 if(value===null||value.trim()==='')return null;
 const parsed=Number(value);
 return Number.isFinite(parsed)&&parsed>=0&&parsed<=1e15?parsed:null;
};

export function parseViewOptions(params:URLSearchParams):CompareViewOptions{
 const view=params.get('view');
 const month=params.get('asof');
 const input=tokens(params.get('win')),output=tokens(params.get('wout'));
 const parts=(params.get('weights')??'').split(',').map(Number);
 const weights=parts.length===3&&parts.every(part=>Number.isFinite(part)&&part>=0&&part<=100)&&parts.some(part=>part>0)
  ?{intelligence:parts[0],coding:parts[1],speed:parts[2]}:null;
 return {
  view:view==='bars'||view==='table'?view:'chart',
  budget:positive(params.get('budget')),
  valueLines:params.get('lines')==='1',
  sizeBySpeed:params.get('size')==='speed',
  asOf:month&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?month+'-01':null,
  workload:input!==null&&output!==null&&input+output>0?{inputTokensPerDay:input,outputTokensPerDay:output}:null,
  weights,
 };
}

/** Writes only non-default choices, so an untouched comparison keeps a short link. */
export function writeViewOptions(params:URLSearchParams,options:CompareViewOptions):URLSearchParams{
 for(const key of ['view','budget','lines','size','asof','win','wout','weights'])params.delete(key);
 if(options.view!=='chart')params.set('view',options.view);
 if(options.budget!==null)params.set('budget',String(Number(options.budget.toPrecision(4))));
 if(options.valueLines)params.set('lines','1');
 if(options.sizeBySpeed)params.set('size','speed');
 if(options.asOf)params.set('asof',options.asOf.slice(0,7));
 if(options.workload&&options.workload.inputTokensPerDay+options.workload.outputTokensPerDay>0){params.set('win',String(options.workload.inputTokensPerDay));params.set('wout',String(options.workload.outputTokensPerDay));}
 if(options.weights)params.set('weights',[options.weights.intelligence,options.weights.coding,options.weights.speed].join(','));
 return params;
}
