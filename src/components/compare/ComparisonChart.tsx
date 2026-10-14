import {useEffect,useRef,useState,type RefObject} from 'react';
import {plotGeometry,formatChartNumber} from '../../lib/compare-geometry';
import {barCategoryLabels,compatibleVariantLines,type CompareSeries,type SeriesPoint} from '../../lib/compare-series';
import {familyColor} from '../../lib/family-color';
import {EXPLORER_SOURCE_LABELS} from '../../lib/compare-series';
import {endpointLabels} from '../../lib/endpoint-labels';
export {familyColor};
type Props={series:CompareSeries;referenceFrontier?:CompareSeries;scale?:'linear'|'log';labels:boolean;endpointLane?:boolean;showFamilyLegend?:boolean;activeId:string|null;onPreview:(id:string|null)=>void;onPin:(id:string)=>void;svgRef:RefObject<SVGSVGElement|null>};
export default function ComparisonChart({series,referenceFrontier,scale,labels,endpointLane=false,showFamilyLegend=false,activeId,onPreview,onPin,svgRef}:Props){
  const frame=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(1000);
  useEffect(()=>{if(!frame.current)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.max(300,entry.contentRect.width)));
    observer.observe(frame.current);return()=>observer.disconnect();},[]);
  const height=width<600?420:520;
  const tokenPrices=series.points.some(point=>point.series==='input'||point.series==='output');
  const geometryInput=[...new Map([...series.points,...(referenceFrontier?.points??[])].map(point=>[point.id,point])).values()];
  const displayReference=series.kind==='scatter'?referenceFrontier:null;
  const showLane=endpointLane&&series.kind==='scatter'&&width>=600;
  const groups=[...new Map(series.points.map(point=>[JSON.stringify([point.source,point.provider??point.family,point.family]),point])).values()];
  const compactLegend=showFamilyLegend||endpointLane&&width<600?groups.slice(0,6):[];
  const mobileLegendRows=Math.ceil(compactLegend.length/3);
  const legendOverflow=compactLegend.length?Math.max(0,groups.length-compactLegend.length):0;
  const topPadding=(tokenPrices?34:22)+(displayReference?16:0)+(endpointLane&&width<600?mobileLegendRows*14+4:0);
  const laneWidth=showLane?184:24;
  const plot=plotGeometry(geometryInput,series.kind,scale??series.scale,width,height,topPadding,laneWidth);
  const byId=new Map(plot.points.map(point=>[point.id,point]));
  const barPointByX=new Map(plot.points.map(point=>[point.x,point]));
  const selectedIds=new Set(series.points.map(point=>point.id));
  const selectedPlotPoints=plot.points.filter(point=>selectedIds.has(point.id));
  const linked=compatibleVariantLines(series.points);
  const barLabels=series.kind==='bars'?barCategoryLabels(selectedPlotPoints):[];
  const endpointCandidates=selectedPlotPoints.map(point=>({id:point.id,group:JSON.stringify([point.source,point.provider??point.family,point.family,point.cohortKey??point.id]),label:point.family,cx:point.cx,cy:point.cy}));
  const familyLabels=showLane&&labels?endpointLabels(endpointCandidates,{top:plot.top+8,bottom:plot.bottom-5,gap:19,activeId}):[];
  const hiddenEndpointLabels=showLane&&labels?Math.max(0,new Set(endpointCandidates.map(point=>point.group)).size-familyLabels.length):0;
  const inspect=(point:SeriesPoint)=>point.label+(point.series==='input'?' · Input tokens':point.series==='output'?' · Output tokens':'')+': '+(series.kind==='scatter'?formatChartNumber(point.x)+' '+series.xLabel+' · ':'')+formatChartNumber(point.y)+' '+point.unit;
  const currentFrontierIds=new Set(Object.values(displayReference?.frontierGroups??{}).flat());
  return <div className="comparison-plot" ref={frame}>
    {!series.available?<div className="plot-empty"><h2>Awaiting data access</h2><p>{series.unavailableReason}</p></div>:
    !series.points.length&&!currentFrontierIds.size?<div className="plot-empty"><h2>No comparable measurements selected</h2><p>Choose models with measurements for this view.</p></div>:
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={series.yLabel+' versus '+series.xLabel}>
      <title>{series.yLabel+' versus '+series.xLabel}</title>
      {tokenPrices?<g aria-label="Token price series"><rect x="70" y="4" width="9" height="9" fill="var(--ink-0)" opacity=".55"/><text className="plot-legend" x="84" y="13">Input tokens</text><rect x="177" y="4" width="9" height="9" fill="var(--ink-0)"/><text className="plot-legend" x="191" y="13">Output tokens</text></g>:null}
      {displayReference&&currentFrontierIds.size?<g aria-label="Current frontier reference"><line className="current-frontier-line" x1="70" x2="94" y1="18" y2="18"/><text className="plot-legend" x="100" y="22">Current frontier</text></g>:null}
      {compactLegend.map((point,index)=>{const x=70+(index%3)*Math.max(90,(width-94)/3),y=(tokenPrices?30:15)+Math.floor(index/3)*14;
        const label=point.family.length>15?point.family.slice(0,14)+'…':point.family;
        return <g key={JSON.stringify([point.source,point.provider,point.family])}>
         <circle cx={x+3} cy={y-3} r="3" fill={familyColor(point.family)}/><text className="plot-legend" x={x+10} y={y}><title>{`${point.source} · ${point.provider} · ${point.family}`}</title>{label}</text>
        </g>;})}
      {legendOverflow?<text className="plot-legend" x={width-24} y={tokenPrices?30:15} textAnchor="end">+{legendOverflow} in family rail</text>:null}
      {plot.yTicks.map(tick=><g key={tick.value}><line className="plot-grid" x1={plot.left} x2={plot.right} y1={tick.position} y2={tick.position}/>
        <text className="plot-tick" x={plot.left-12} y={tick.position+4} textAnchor="end">{tick.label}</text></g>)}
      {series.kind==='scatter'?plot.xTicks.map(tick=><g key={tick.value}><line className="plot-grid" x1={tick.position} x2={tick.position} y1={plot.top} y2={plot.bottom}/>
        <text className="plot-tick" x={tick.position} y={plot.bottom+24} textAnchor="middle">{tick.label}</text></g>):null}
      <line className="plot-axis" x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom}/>
      <line className="plot-axis" x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom}/>
      {series.kind==='scatter'?linked.map((points,index)=><polyline key={JSON.stringify([points[0].source,points[0].provider,points[0].family,points[0].cohortKey,index])} className="variant-link" stroke={familyColor(points[0].family)}
        points={[...points].sort((a,b)=>a.x-b.x).map(point=>byId.get(point.id)).filter(Boolean).map(point=>point!.cx+','+point!.cy).join(' ')}/>):null}
      {Object.entries(series.frontierGroups).map(([key,ids])=><polyline key={key} className="frontier-line"
        points={ids.map(id=>byId.get(id)).filter(Boolean).map(point=>point!.cx+','+point!.cy).join(' ')}/>)}
      {displayReference&&Object.entries(displayReference.frontierGroups).map(([key,ids])=><g key={'reference:'+key}>
        <polyline className="current-frontier-line" points={ids.map(id=>byId.get(id)).filter(Boolean).map(point=>point!.cx+','+point!.cy).join(' ')}/>
        {ids.map(id=>{const point=byId.get(id);return point?<circle key={id} className="current-frontier-mark" cx={point.cx} cy={point.cy} r="7"><title>{`${point.label} · current frontier`}</title></circle>:null;})}
      </g>)}
      {familyLabels.map(item=>{const point=byId.get(item.id);const familyConflicts=endpointCandidates.filter(row=>byId.get(row.id)?.family===point?.family);
        const conflict=new Set(familyConflicts.map(row=>{const model=byId.get(row.id);return JSON.stringify([model?.source,model?.provider,model?.receipt.indexVersion,row.group]);})).size>1;
        const fullLabel=conflict?`${point?EXPLORER_SOURCE_LABELS[point.source]:''} · ${point?.provider??''} · ${item.label} · ${point?.receipt.indexVersion??'unversioned'}`:item.label;
        const text=fullLabel.length>25?fullLabel.slice(0,24)+'…':fullLabel;
        return <g key={item.group} aria-label={fullLabel+' endpoint'}>
        <polyline className="family-endpoint-leader" stroke={familyColor(point?.family??item.label)} points={`${item.cx},${item.cy} ${plot.right+7},${item.labelY}`}/>
        <circle cx={item.cx} cy={item.cy} r="2.4" fill={familyColor(point?.family??item.label)}/>
        <text className="family-endpoint-label" x={plot.right+11} y={item.labelY+3} fill={familyColor(point?.family??item.label)}>
         <title>{fullLabel}</title>{text}</text>
       </g>;})}
      {hiddenEndpointLabels?<text className="plot-legend" x={plot.right+10} y={plot.bottom+18}>+{hiddenEndpointLabels} more families</text>:null}
      {selectedPlotPoints.map(point=><g key={point.id} role="button" tabIndex={0} aria-label={inspect(point)}
        className={'chart-point'+(activeId===point.id?' is-active':'')}
        onPointerEnter={()=>onPreview(point.id)} onPointerLeave={()=>onPreview(null)} onFocus={()=>onPreview(point.id)}
        onBlur={()=>onPreview(null)} onClick={()=>onPin(point.id)}
        onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onPin(point.id);}
          if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const nodes=[...event.currentTarget.ownerSVGElement!.querySelectorAll<SVGGElement>('.chart-point')];
            nodes[Math.max(0,Math.min(nodes.length-1,nodes.indexOf(event.currentTarget)+(event.key==='ArrowRight'?1:-1)))]?.focus();}}}>
        <title>{inspect(point)}</title>
        {series.kind==='scatter'?<><circle cx={point.cx} cy={point.cy} r="11" fill="transparent"/><circle className="point-mark" cx={point.cx} cy={point.cy}
          r={activeId===point.id?6:4.5} fill={familyColor(point.family)}/></>:<rect className="point-mark" x={point.cx-point.visibleBarWidth/2}
          y={Math.min(point.cy,plot.baseline)} width={point.visibleBarWidth} height={Math.max(1,Math.abs(plot.baseline-point.cy))}
          fill={familyColor(point.family)} opacity={point.series==='input'?.55:1}/>}
        {labels&&activeId===point.id&&!showLane?<text className="point-label" textAnchor="start"
          x={point.cx+8} y={point.cy-10}>{point.label}</text>:null}
      </g>)}
      {series.kind==='bars'&&barLabels.length<=12?
        barLabels.map(category=>{const point=barPointByX.get(category.x);if(!point)return null;return <text key={'category:'+category.x}
          className="plot-tick category-label" x={point.cx} y={plot.bottom+20} textAnchor="middle" aria-label={category.ariaLabel}>
          <title>{category.title}</title>{category.label}</text>}):null}
      <text className="plot-label" x={(plot.left+plot.right)/2} y={height-12} textAnchor="middle">{series.xLabel}</text>
      <text className="plot-label" transform={`translate(17 ${(plot.top+plot.bottom)/2}) rotate(-90)`} textAnchor="middle">{series.yLabel}</text>
    </svg>}
  </div>;
}
