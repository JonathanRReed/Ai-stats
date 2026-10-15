import {plottableSeriesPoints,type CompareSeries} from './compare-series';

/** Every reference marker shares its record with inspection, counts, tables and exports. */
export function displayedComparisonPoints(series:CompareSeries,reference:CompareSeries|null){
  const selectedIds=new Set(series.points.map(point=>point.id));
  const referenceIds=new Set(Object.values(reference?.frontierGroups??{}).flat());
  const referencePoints=reference?plottableSeriesPoints(reference).filter(point=>referenceIds.has(point.id)&&!selectedIds.has(point.id)):[];
  return {points:[...series.points,...referencePoints],referencePoints,referenceIds:new Set(referencePoints.map(point=>point.id))};
}
