/** How many frontier records the warning should report for automatic vs manual views. */
export function frontierReferenceDisplayCount(input:{
 scatterView:boolean;
 customSelection:boolean;
 suggestedIds:readonly string[];
 frontierReferenceIds:readonly string[];
}):number{
 if(!input.scatterView)return 0;
 return input.customSelection?input.frontierReferenceIds.length:input.suggestedIds.length;
}

/** Manual selections only keep the current-frontier reference while Frontier is enabled. */
export function shouldShowFrontierReference(frontierEnabled:boolean,frontierReferenceIds:readonly string[]):boolean{
 return frontierEnabled&&frontierReferenceIds.length>0;
}
