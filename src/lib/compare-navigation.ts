import {serializeCompareState,type CompareState} from './compare-state';
/** Keep automatic selection intent intact across updates, sharing and refreshes. */
export function comparisonParams(state:CompareState,automatic:boolean):URLSearchParams{
 const params=serializeCompareState(state);
 if(automatic)params.set('auto','1');
 return params;
}
