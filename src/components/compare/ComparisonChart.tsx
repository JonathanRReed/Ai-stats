import {useEffect,useRef,useState,type RefObject} from 'react';
import {plotGeometry,formatChartNumber} from '../../lib/compare-geometry';
import type {CompareSeries,SeriesPoint} from '../../lib/compare-series';
const FAMILY_HUES:Array<[RegExp,number]>=[
  [/^Claude/i,1],[/^(GPT|o[1-9])/i,8],[/^(Gemini|Gemma)/i,0],[/^(Muse|Llama)/i,2],
  [/^Grok/i,3],[/^MiMo/i,4],[/^Qwen/i,5],[/^Kimi/i,6],[/^GLM/i,7],[/^DeepSeek/i,5],
];
export function familyColor(family:string){
  const known=FAMILY_HUES.find(([pattern])=>pattern.test(family));
  let hash=0;for(const letter of family)hash=(hash*31+letter.charCodeAt(0))>>>0;
  return 'var(--compare-family-'+(known?.[1]??hash%9)+')';
}
type Props={series:CompareSeries;labels:boolean;activeId:string|null;onPreview:(id:string|null)=>void;onPin:(id:string)=>void;svgRef:RefObject<SVGSVGElement|null>};
export default function ComparisonChart({series,labels,activeId,onPreview,onPin,svgRef}:Props){
  const frame=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(1000);
  useEffect(()=>{if(!frame.current)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.max(300,entry.contentRect.width)));
    observer.observe(frame.current);return()=>observer.disconnect();},[]);
  const height=width<600?420:520;
  const families=[...new Set(series.points.map(point=>point.family))];
  const tokenPrices=series.points.some(point=>point.series==='input'||point.series==='output');
  let legendX=70,legendY=tokenPrices?34:13;
  const legend=families.slice(0,width<600?6:12).map(family=>{
    const space=Math.min(width-94,family.length*6.3+28);
    if(legendX+space>width-24&&legendX>70){legendX=70;legendY+=17;}
    const maxChars=Math.max(10,Math.floor((space-28)/6.3));
    const label=family.length>maxChars?family.slice(0,maxChars-1)+'…':family;
    const item={family,label,x:legendX,y:legendY};legendX+=space;return item;
  });
  const plot=plotGeometry(series.points,series.kind,series.scale,width,height,Math.min(height*.35,legendY+24));
  const byId=new Map(plot.points.map(point=>[point.id,point]));
  const linked=new Map<string,typeof plot.points>();
  for(const point of plot.points){if(!point.cohortKey||point.reasoning==='unknown')continue;
    const key=point.family+':'+point.cohortKey;const group=linked.get(key)??[];group.push(point);linked.set(key,group);}
  const inspect=(point:SeriesPoint)=>point.label+(point.series==='input'?' · Input tokens':point.series==='output'?' · Output tokens':'')+': '+formatChartNumber(point.y)+' '+point.unit;
  return <div className="comparison-plot" ref={frame}>
    {!series.available?<div className="plot-empty"><h2>Awaiting data access</h2><p>{series.unavailableReason}</p></div>:
    !series.points.length?<div className="plot-empty"><h2>No comparable measurements selected</h2><p>Choose models with measurements for this view.</p></div>:
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={series.yLabel+' versus '+series.xLabel}>
      <title>{series.yLabel+' versus '+series.xLabel}</title>
      {tokenPrices?<g aria-label="Token price series"><rect x="70" y="4" width="9" height="9" fill="var(--ink-0)" opacity=".55"/><text className="plot-legend" x="84" y="13">Input tokens</text><rect x="177" y="4" width="9" height="9" fill="var(--ink-0)"/><text className="plot-legend" x="191" y="13">Output tokens</text></g>:null}
      <g aria-label="Model family legend">{legend.map(item=><g key={item.family}>
        <circle cx={item.x+3} cy={item.y-3} r="3" fill={familyColor(item.family)}/>
        <text className="plot-legend" x={item.x+12} y={item.y}><title>{item.family}</title>{item.label}</text></g>)}</g>
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
          r={activeId===point.id?6:4.5} fill={familyColor(point.family)}/></>:<rect className="point-mark" x={point.cx-point.visibleBarWidth/2}
          y={Math.min(point.cy,plot.baseline)} width={point.visibleBarWidth} height={Math.max(1,Math.abs(plot.baseline-point.cy))}
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
