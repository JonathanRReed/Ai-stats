import type {SeriesPoint,CompareSeries} from '../../lib/compare-series';
import {formatChartNumber} from '../../lib/compare-geometry';
type Props={point:SeriesPoint|null;series:CompareSeries;pinned:boolean;onPin:()=>void;onClose:()=>void;floating?:boolean};
const midpoint=(values:number[],log:boolean)=>{
 const finite=values.filter(value=>Number.isFinite(value)&&(!log||value>0));
 if(!finite.length)return 0;
 const min=Math.min(...finite),max=Math.max(...finite);
 return log?10**((Math.log10(min)+Math.log10(max))/2):(min+max)/2;
};
export default function ObservationDetails({point,series,pinned,onPin,onClose,floating=false}:Props){
  if(!point)return <p className="inspect-hint">Select a point or bar for details.</p>;
  const receipt=point.receipt;
  const anchorX=point.x>midpoint(series.points.map(row=>row.x),series.kind==='scatter'&&series.scale==='log')?'left':'right';
  const anchorY=point.y>midpoint(series.points.map(row=>row.y),series.kind==='bars'&&series.scale==='log')?'bottom':'top';
  return <section className={'observation-details'+(floating?' observation-floating':'')} data-anchor-x={anchorX} data-anchor-y={anchorY} aria-label="Observation details">
    <div className="observation-heading"><strong>{point.label}</strong><div>
      <button type="button" onClick={onPin} aria-pressed={pinned}>{pinned?'Unpin':'Pin'}</button>
      <button type="button" onClick={onClose} aria-label="Close observation">×</button></div></div>
    <dl className="observation-values"><div><dt>{point.series==='input'?'Input token price':point.series==='output'?'Output token price':series.yLabel}</dt><dd>{formatChartNumber(point.y)} {point.unit}</dd></div>
      {series.kind==='scatter'?<div><dt>{series.xLabel}</dt><dd>{formatChartNumber(point.x)}</dd></div>:null}</dl>
    <div className="observation-source-link">{receipt.sourceUrl?<a href={receipt.sourceUrl} target="_blank" rel="noreferrer">{receipt.source} ↗</a>:receipt.source}</div>
    <details className="observation-receipt"><summary>Measurement details</summary><dl>
      <div><dt>Reasoning label</dt><dd>{point.reasoning}</dd></div>
      {receipt.indexVersion?<div><dt>Index version</dt><dd>{receipt.indexVersion}</dd></div>:null}
      <div><dt>Observed</dt><dd>{receipt.observedAt?.slice(0,10)??'Not recorded'}</dd></div>
      {receipt.fetchedAt?<div><dt>Retrieved</dt><dd>{receipt.fetchedAt.slice(0,10)}</dd></div>:null}
      <div><dt>Conditions</dt><dd>{receipt.conditions?Object.entries(receipt.conditions).map(([key,value])=>key+': '+value).join(' · '):'Not recorded'}</dd></div>
      {receipt.snapshotId?<div><dt>Snapshot</dt><dd>{receipt.snapshotId}</dd></div>:null}
      <div><dt>Record ID</dt><dd>{point.id}</dd></div>
    </dl></details>
  </section>;
}
