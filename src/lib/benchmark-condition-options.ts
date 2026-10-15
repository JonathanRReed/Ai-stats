import {epochScoreKey} from './compare-series';
import {epochConditionKey,type EpochObservation} from './epoch-observations';
/** Offer only conditions backed by a measurement for the selected score and version. */
export function benchmarkConditionOptions(rows:EpochObservation[],scoreMetricKey:string|null):string[]{
 return [...new Set(rows.filter(row=>typeof row.value==='number'&&Number.isFinite(row.value)&&(!scoreMetricKey||epochScoreKey(row)===scoreMetricKey)).map(row=>epochConditionKey(row.conditions)))].sort();
}
