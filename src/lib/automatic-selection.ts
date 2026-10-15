import type {ExplorerModel} from './compare-series';
import {suggestedModelFrontier} from './suggested-models';
export const AUTOMATIC_SELECTION_POLICY='nonfree-defaults.v1';
/** Unknown prices stay unknown; a missing price is never evidence of a free route. */
export function isAutomaticCandidate(model:ExplorerModel):boolean{
 return model.priceBlended!==0&&!(model.priceInput===0&&model.priceOutput===0);
}
export function automaticFrontier(models:ExplorerModel[],coordinate:(model:ExplorerModel)=>number|null|undefined,direction:'min'|'max'='min'){
 const eligible=models.filter(model=>model.source==='aa'&&model.current===true&&isAutomaticCandidate(model)&&
  typeof coordinate(model)==='number'&&Number.isFinite(coordinate(model))&&coordinate(model)!>0&&
  typeof model.intelligence==='number'&&Number.isFinite(model.intelligence)&&Boolean(model.indexVersion&&/^\d+(?:\.\d+)*$/.test(model.indexVersion)));
 return suggestedModelFrontier(eligible.map(model=>({id:model.id,modelId:model.id,x:coordinate(model)!,y:model.intelligence!,provider:model.provider,
  family:model.family,indexVersion:model.indexVersion!,cohortKey:model.indexVersion+':'+(model.performancePrompt??'unknown')})),direction,100);
}
