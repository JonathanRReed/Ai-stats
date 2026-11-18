import type {SeriesPoint,CompareSeries} from '../../lib/compare-series';
import {formatChartNumber} from '../../lib/compare-geometry';
type Props={point:SeriesPoint|null;series:CompareSeries;pinned:boolean;onPin:()=>void;onClose:()=>void;floating?:boolean;
 /** Records shown that beat this one on both axes. Omit to leave the section out entirely. */
 beatenBy?:SeriesPoint[];onInspect?:(id:string)=>void;
 /** Arms the next point selection as the second half of a side-by-side comparison. */
 onCompare?:()=>void;comparing?:boolean};
const midpoint=(values:number[],log:boolean)=>{
 const finite=values.filter(value=>Number.isFinite(value)&&(!log||value>0));
 if(!finite.length)return 0;
 const min=Math.min(...finite),max=Math.max(...finite);
 return log?10**((Math.log10(min)+Math.log10(max))/2):(min+max)/2;
};
export default function ObservationDetails({point,series,pinned,onPin,onClose,floating=false,beatenBy,onInspect,onCompare,comparing=false}:Props){
  if(!point)return <p className="inspect-hint">Select a point or bar for details.</p>;
  const receipt=point.receipt;
  const horizontalValue=series.kind==='bars'?point.y:point.x;
  const anchorX=horizontalValue>midpoint(series.points.map(row=>series.kind==='bars'?row.y:row.x),series.scale==='log')?'left':'right';
  const anchorY=series.kind==='bars'?(point.x>midpoint(series.points.map(row=>row.x),false)?'top':'bottom'):
    point.y>midpoint(series.points.map(row=>row.y),false)?'bottom':'top';
  return <section className={'observation-details'+(floating?' observation-floating':'')} data-anchor-x={anchorX} data-anchor-y={anchorY} data-passive={!pinned||comparing?'true':undefined} aria-label="Observation details">
    <div className="observation-heading"><strong>{point.label}</strong><div>
      <button type="button" onClick={onPin} aria-pressed={pinned}>{pinned?'Unpin':'Pin'}</button>
      <button type="button" onClick={onClose} aria-label="Close observation">×</button></div></div>
    <dl className="observation-values"><div><dt>{point.series==='input'?'Input token price':point.series==='output'?'Output token price':series.yLabel}</dt><dd>{formatChartNumber(point.y)} {point.unit}</dd></div>
      {point.stderr!==undefined?<div><dt>Standard error</dt><dd>± {formatChartNumber(point.stderr)}</dd></div>:null}
      {series.kind==='scatter'?<div><dt>{series.xLabel}</dt><dd>{formatChartNumber(point.x)}</dd></div>:null}</dl>
    {beatenBy&&point.cohortKey?<div className="observation-beaten">
      {beatenBy.length?<><p>{beatenBy.length} shown {beatenBy.length===1?'record beats':'records beat'} it on both measures:</p>
        <ul>{beatenBy.slice(0,3).map(other=><li key={other.id}>{onInspect?<button type="button" onClick={()=>onInspect(other.id)}>{other.label}</button>:other.label}
          <span>{formatChartNumber(Math.abs(other.y-point.y))} {other.y===point.y?'equal':'higher'}, {formatChartNumber(Math.abs(other.x-point.x))} {other.x===point.x?'equal':series.higherXIsBetter?'faster':'cheaper'}</span></li>)}</ul>
        {beatenBy.length>3?<p>and {beatenBy.length-3} more, outlined on the chart.</p>:null}</>:
        <p>Nothing shown beats it on both measures.</p>}
    </div>:null}
    {pinned&&onCompare?<button type="button" className="observation-compare" aria-pressed={comparing} onClick={onCompare}>{comparing?'Now select a second point':'Compare with another point'}</button>:null}
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
