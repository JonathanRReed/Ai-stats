import type {SeriesPoint,CompareSeries} from '../../lib/compare-series';
import {formatChartNumber} from '../../lib/compare-geometry';
type Props={point:SeriesPoint|null;series:CompareSeries;pinned:boolean;onPin:()=>void;onClose:()=>void};
export default function ObservationDetails({point,series,pinned,onPin,onClose}:Props){
  if(!point)return <p className="inspect-hint">Select a point or bar for details.</p>;
  const receipt=point.receipt;
  return <section className="observation-details" aria-label="Observation details">
    <div className="observation-heading"><strong>{point.label}</strong><div>
      <button type="button" onClick={onPin} aria-pressed={pinned}>{pinned?'Unpin':'Pin'}</button>
      <button type="button" onClick={onClose} aria-label="Close observation">×</button></div></div>
    <dl><div><dt>Record</dt><dd>{point.id}</dd></div><div><dt>{point.series==='input'?'Input token price':point.series==='output'?'Output token price':'Value'}</dt><dd>{formatChartNumber(point.y)} {point.unit}</dd></div>
      {series.kind==='scatter'?<div><dt>{series.xLabel}</dt><dd>{formatChartNumber(point.x)}</dd></div>:null}
      <div><dt>Reasoning label</dt><dd>{point.reasoning}</dd></div>
      {receipt.indexVersion?<div><dt>Index version</dt><dd>{receipt.indexVersion}</dd></div>:null}
      <div><dt>Source</dt><dd>{receipt.sourceUrl?<a href={receipt.sourceUrl} target="_blank" rel="noreferrer">{receipt.source}</a>:receipt.source}</dd></div>
      <div><dt>Observed</dt><dd>{receipt.observedAt?.slice(0,10)??'Not recorded'}</dd></div>
      {receipt.fetchedAt?<div><dt>Retrieved</dt><dd>{receipt.fetchedAt.slice(0,10)}</dd></div>:null}
      <div><dt>Conditions</dt><dd>{receipt.conditions?Object.entries(receipt.conditions).map(([key,value])=>key+': '+value).join(' · '):'Not recorded'}</dd></div>
      {receipt.snapshotId?<div><dt>Snapshot</dt><dd>{receipt.snapshotId}</dd></div>:null}</dl>
  </section>;
}
