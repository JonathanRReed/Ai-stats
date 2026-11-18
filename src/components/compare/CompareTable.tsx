import {useMemo,useState} from 'react';
import {formatChartNumber} from '../../lib/compare-geometry';
import type {CompareSeries,SeriesPoint} from '../../lib/compare-series';
import {reasoningLabel} from '../../lib/compare-family-lines';

type SortKey='label'|'reasoning'|'x'|'y'|'released'|'observed';
type Props={series:CompareSeries;points:SeriesPoint[];referenceIds:ReadonlySet<string>;activeId:string|null;onPin:(id:string)=>void};
const text=(value:string|null|undefined)=>value??'';

/** The chart as a table: the same records, sortable, with nothing rounded away. */
export default function CompareTable({series,points,referenceIds,activeId,onPin}:Props){
  const scatter=series.kind==='scatter';
  const [sort,setSort]=useState<{key:SortKey;descending:boolean}>({key:'y',descending:true});
  const rows=useMemo(()=>{
    const read=(point:SeriesPoint):string|number=>sort.key==='label'?point.label:sort.key==='reasoning'?point.reasoning:sort.key==='x'?point.x:sort.key==='y'?point.y:
      sort.key==='released'?text(point.releasedAt):text(point.receipt.observedAt);
    return [...points].sort((a,b)=>{
      const left=read(a),right=read(b);
      // A record with no date stays at the bottom whichever way the column is sorted.
      if(left===''&&right!=='')return 1;if(right===''&&left!=='')return -1;
      const order=typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right),'en',{numeric:true});
      return (sort.descending?-order:order)||a.id.localeCompare(b.id);
    });
  },[points,sort]);
  const header=(key:SortKey,label:string,numeric=false)=><th scope="col" className={numeric?'num':undefined} aria-sort={sort.key===key?(sort.descending?'descending':'ascending'):'none'}>
    <button type="button" onClick={()=>setSort(previous=>({key,descending:previous.key===key?!previous.descending:numeric}))}>{label}<span aria-hidden="true">{sort.key===key?(sort.descending?' ↓':' ↑'):''}</span></button></th>;
  if(!points.length)return <div className="plot-empty"><h2>No comparable measurements selected</h2><p>Choose models with measurements for this view.</p></div>;
  return <div className="compare-table-scroll"><table className="compare-table">
    <caption>{scatter?series.yLabel+' and '+series.xLabel:series.yLabel}, {rows.length} {rows.length===1?'record':'records'}. Select a column heading to sort.</caption>
    <thead><tr>{header('label','Model')}{header('reasoning','Reasoning')}{scatter?header('x',series.xLabel,true):<th scope="col">Series</th>}{header('y',series.yLabel,true)}
      {header('released','Released')}{header('observed','Observed')}<th scope="col">Source</th></tr></thead>
    <tbody>{rows.map(point=><tr key={point.id} data-active={activeId===point.id}>
      <th scope="row"><button type="button" onClick={()=>onPin(point.id)}>{point.label}</button>{referenceIds.has(point.id)?<small>Pareto reference</small>:null}</th>
      <td>{reasoningLabel(point.reasoning)}</td>
      <td className={scatter?'num':undefined}>{scatter?formatChartNumber(point.x):point.series}</td>
      <td className="num">{formatChartNumber(point.y)}</td>
      <td className="num">{point.releasedAt??'Not recorded'}</td>
      <td className="num">{point.receipt.observedAt?.slice(0,10)??'Not recorded'}</td>
      <td>{point.receipt.sourceUrl?<a href={point.receipt.sourceUrl} target="_blank" rel="noreferrer">{point.receipt.source}</a>:point.receipt.source}</td>
    </tr>)}</tbody>
  </table></div>;
}
