import type {CompareFamily} from './compare-families';

export type CompareFamilyPage={page:number;pageCount:number;items:CompareFamily[]};

/** Return a bounded result window while keeping page state valid after filters change. */
export function compareFamilyPage(groups:CompareFamily[],page:number,pageSize=12):CompareFamilyPage{
 const size=Math.max(1,Math.floor(pageSize));
 const pageCount=Math.max(1,Math.ceil(groups.length/size));
 const current=Math.min(Math.max(0,Math.floor(page)),pageCount-1);
 return {page:current,pageCount,items:groups.slice(current*size,(current+1)*size)};
}
