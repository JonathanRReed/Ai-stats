import {formatChartNumber} from '../../lib/compare-geometry';
import type {CompareSeries,SeriesPoint} from '../../lib/compare-series';
import {reasoningLabel} from '../../lib/compare-family-lines';

type Props={series:CompareSeries;first:SeriesPoint;second:SeriesPoint;onClose:()=>void;onSwap:()=>void};
/** "12% of" reads wrong for a difference, so state the gap in the axis's own unit and as a share of the first record. */
const difference=(from:number,to:number)=>{
  const gap=to-from;
  if(gap===0)return 'the same';
  const share=from!==0?` (${formatChartNumber(Math.abs(gap/from)*100)}%)`:'';
  return formatChartNumber(Math.abs(gap))+(gap>0?' higher':' lower')+share;
};

/** Two pinned records side by side, with the gap on each axis. It states differences and leaves the judgement to the reader. */
export default function PinnedPair({series,first,second,onClose,onSwap}:Props){
  const scatter=series.kind==='scatter';
  const comparable=first.cohortKey!==null&&first.cohortKey===second.cohortKey;
  return <section className="observation-details pinned-pair" aria-label="Two pinned records compared">
    <div className="observation-heading"><strong>Side by side</strong><div>
      <button type="button" onClick={onSwap}>Swap</button>
      <button type="button" onClick={onClose} aria-label="Close comparison">×</button></div></div>
    <table>
      <thead><tr><td/><th scope="col">{first.label}</th><th scope="col">{second.label}</th><th scope="col">Second against first</th></tr></thead>
      <tbody>
        <tr><th scope="row">{series.yLabel}</th><td>{formatChartNumber(first.y)}</td><td>{formatChartNumber(second.y)}</td><td>{difference(first.y,second.y)}</td></tr>
        {scatter?<tr><th scope="row">{series.xLabel}</th><td>{formatChartNumber(first.x)}</td><td>{formatChartNumber(second.x)}</td><td>{difference(first.x,second.x)}</td></tr>:null}
        <tr><th scope="row">Reasoning</th><td>{reasoningLabel(first.reasoning)}</td><td>{reasoningLabel(second.reasoning)}</td><td/></tr>
        <tr><th scope="row">Released</th><td>{first.releasedAt??'Not recorded'}</td><td>{second.releasedAt??'Not recorded'}</td><td/></tr>
        <tr><th scope="row">Observed</th><td>{first.receipt.observedAt?.slice(0,10)??'Not recorded'}</td><td>{second.receipt.observedAt?.slice(0,10)??'Not recorded'}</td><td/></tr>
        <tr><th scope="row">Source</th><td>{first.receipt.source}</td><td>{second.receipt.source}</td><td/></tr>
      </tbody>
    </table>
    {!comparable?<p className="pinned-pair-note">These two records were not measured under the same index version and settings, so their scores are not directly comparable.</p>:null}
  </section>;
}
