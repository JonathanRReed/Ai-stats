import {useEffect,useRef,useState,type RefObject} from 'react';
import {plotGeometry,formatChartNumber} from '../../lib/compare-geometry';
import type {CompareSeries,SeriesPoint} from '../../lib/compare-series';
const COLORS=['#8ccab8','#e39775','#82aee0','#b79bdf','#dfbf73','#80c1d0','#d88fb6','#c4cb91'];
export function familyColor(family:string){let hash=0;for(const letter of family)hash=(hash*31+letter.charCodeAt(0))>>>0;return COLORS[hash%COLORS.length];}
type Props={series:CompareSeries;labels:boolean;activeId:string|null;onPreview:(id:string|null)=>void;onPin:(id:string)=>void;svgRef:RefObject<SVGSVGElement|null>};
export default function ComparisonChart({series,labels,activeId,onPreview,onPin,svgRef}:Props){
  const frame=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(1000);
  useEffect(()=>{if(!frame.current)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.max(300,entry.contentRect.width)));
    observer.observe(frame.current);return()=>observer.disconnect();},[]);
  const height=width<600?420:520;const plot=plotGeometry(series.points,series.kind,series.scale,width,height);
  const byId=new Map(plot.points.map(point=>[point.id,point]));
  const linked=new Map<string,typeof plot.points>();
  for(const point of plot.points){if(!point.cohortKey||point.reasoning==='unknown')continue;
    const key=point.family+':'+point.cohortKey;const group=linked.get(key)??[];group.push(point);linked.set(key,group);}
  const inspect=(point:SeriesPoint)=>point.label+': '+formatChartNumber(point.y)+' '+point.unit;
  return <div className="comparison-plot" ref={frame}>
    {!series.available?<div className="plot-empty"><h2>Awaiting data access</h2><p>{series.unavailableReason}</p></div>:
    !series.points.length?<div className="plot-empty"><h2>No comparable measurements selected</h2><p>Choose models with measurements for this view.</p></div>:
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={series.yLabel+' versus '+series.xLabel}>
      <title>{series.yLabel+' versus '+series.xLabel}</title>
      {plot.yTicks.map(tick=><g key={tick.value}><line className="plot-grid" x1={plot.left} x2={plot.right} y1={tick.position} y2={tick.position}/>
        <text className="plot-tick" x={plot.left-12} y={tick.position+4} textAnchor="end">{tick.label}</text></g>)}
      {series.kind==='scatter'?plot.xTicks.map(tick=><g key={tick.value}><line className="plot-grid" x1={tick.position} x2={tick.position} y1={plot.top} y2={plot.bottom}/>
        <text className="plot-tick" x={tick.position} y={plot.bottom+24} textAnchor="middle">{tick.label}</text></g>):null}
      <line className="plot-axis" x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom}/>
      <line className="plot-axis" x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom}/>
      {series.kind==='scatter'?[...linked].map(([key,points])=>points.length>1?<polyline key={key} className="variant-link" stroke={familyColor(points[0].family)}
        points={[...points].sort((a,b)=>a.x-b.x).map(point=>point.cx+','+point.cy).join(' ')}/>:null):null}
      {Object.entries(series.frontierGroups).map(([key,ids])=><polyline key={key} className="frontier-line"
        points={ids.map(id=>byId.get(id)).filter(Boolean).map(point=>point!.cx+','+point!.cy).join(' ')}/>)}
      {plot.points.map(point=><g key={point.id} role="button" tabIndex={0} aria-label={inspect(point)}
        className={'chart-point'+(activeId===point.id?' is-active':'')}
        onPointerEnter={()=>onPreview(point.id)} onPointerLeave={()=>onPreview(null)} onFocus={()=>onPreview(point.id)}
        onBlur={()=>onPreview(null)} onClick={()=>onPin(point.id)}
        onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onPin(point.id);}}}>
        <title>{inspect(point)}</title>
        {series.kind==='scatter'?<><circle cx={point.cx} cy={point.cy} r="11" fill="transparent"/><circle className="point-mark" cx={point.cx} cy={point.cy}
          r={activeId===point.id?6:4.5} fill={familyColor(point.family)}/></>:<rect className="point-mark" x={point.cx-point.barWidth/2}
          y={Math.min(point.cy,plot.baseline)} width={point.barWidth-2} height={Math.max(1,Math.abs(plot.baseline-point.cy))}
          fill={familyColor(point.family)} opacity={point.series==='input'?.55:1}/>}
        {labels?<text className="point-label" x={point.cx+8} y={point.cy-10}>{point.label}</text>:null}
      </g>)}
      {series.kind==='bars'&&new Set(plot.points.map(point=>point.x)).size<=12?
        [...new Map(plot.points.map(point=>[point.x,point])).values()].map(point=><text key={'category:'+point.x}
          className="plot-tick category-label" x={point.cx} y={plot.bottom+20} textAnchor="middle">
          <title>{point.label}</title>{point.family.length>16?point.family.slice(0,14)+'…':point.family}</text>):null}
      <text className="plot-label" x={(plot.left+plot.right)/2} y={height-12} textAnchor="middle">{series.xLabel}</text>
      <text className="plot-label" transform={`translate(17 ${(plot.top+plot.bottom)/2}) rotate(-90)`} textAnchor="middle">{series.yLabel}</text>
    </svg>}
  </div>;
}
