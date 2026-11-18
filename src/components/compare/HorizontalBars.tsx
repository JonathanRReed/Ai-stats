import type {RefObject} from 'react';
import {horizontalBarLayout} from '../../lib/horizontal-bar-layout';
import {formatChartNumber} from '../../lib/compare-geometry';
import {familyColor} from '../../lib/family-color';
import {providerIcon} from '../../lib/provider-icons';
import {EXPLORER_SOURCE_LABELS,type CompareSeries,type SeriesPoint} from '../../lib/compare-series';
type Props={series:CompareSeries;points:SeriesPoint[];width:number;scale:'linear'|'log';activeId:string|null;onPreview:(id:string|null)=>void;onPin:(id:string)=>void;svgRef:RefObject<SVGSVGElement|null>};
export default function HorizontalBars({series,points,width,scale,activeId,onPreview,onPin,svgRef}:Props){
 // Marks sit left of the name on wide plots; narrow plots keep the whole column for the label.
 const marks=width>=520,labelX=marks?32:8;
 const layout=horizontalBarLayout(points,width,scale,marks?50:18);
 const identity=(point:SeriesPoint)=>[point.label,point.provider,EXPLORER_SOURCE_LABELS[point.source]].filter(Boolean).join(' · ');
 const prices=points.some(p=>p.series==='input'||p.series==='output');
 // One standard error either side of the score. On Log the lower end must stay positive to be drawable.
 const whisker=(point:SeriesPoint)=>{
  if(point.stderr===undefined||!(point.stderr>0))return null;
  const low=point.y-point.stderr,high=point.y+point.stderr;
  if(scale==='log'&&low<=0)return null;
  return {low:Math.max(layout.left,layout.position(low)),high:Math.min(width-4,layout.position(high))};
 };
 const errors=points.some(point=>point.stderr!==undefined);
 const inspect=(point:SeriesPoint)=>point.label+(prices?' · '+(point.series==='input'?'Input tokens':'Output tokens'):'')+': '+formatChartNumber(point.y)+' '+point.unit+(point.stderr!==undefined?', standard error '+formatChartNumber(point.stderr):'');
 return <svg ref={svgRef} viewBox={`0 0 ${width} ${layout.height}`} style={{height:layout.height}} role="group" aria-label={series.yLabel+' by model'}>
  <title>{series.yLabel+' by model'}</title>
  <text className="plot-label" x={layout.left} y="16">{series.yLabel}{scale==='log'?' · log scale':''}</text>
  {prices?<text className="plot-legend" x="8" y="33">Input tokens (light) · Output tokens (solid)</text>:null}
  {errors?<text className="plot-legend" x="8" y="33">Whiskers show one standard error either side, where the publisher records it</text>:null}
  {layout.ticks.map(tick=><g key={tick.label}><line className="plot-grid" x1={tick.position} x2={tick.position} y1="42" y2={layout.height-35}/><text className="plot-tick" x={tick.position} y={layout.height-15} textAnchor="middle">{tick.label}</text></g>)}
  <line className="plot-axis" x1={layout.baseline} x2={layout.baseline} y1="42" y2={layout.height-35}/>
  {layout.rows.map(row=>{const member=row.members[0],mark=marks?providerIcon(member.provider,member.family):null,middle=row.top+(row.bottom-row.top)/2;
   return <g key={row.x}>
    {mark?<image className={'lab-mark'+(mark.mono?' is-mono':'')} href={mark.src} x="8" y={middle-11} width="14" height="14"/>:
     marks?<circle cx="15" cy={middle-4} r="3.5" fill={familyColor(member.family)}/>:null}
    <text className="bar-identity" x={labelX} y={middle-(row.lines.length-1)*7.5} aria-label={identity(member)}>
     <title>{identity(member)}</title>{row.lines.map((line,index)=><tspan key={index} x={labelX} dy={index?15:0}>{line}</tspan>)}</text>
   </g>;})}
  {layout.points.map(point=><g key={point.id} role="button" tabIndex={0} aria-label={inspect(point)} className={'chart-point'+(activeId===point.id?' is-active':'')}
   onPointerEnter={()=>onPreview(point.id)} onPointerLeave={()=>onPreview(null)} onFocus={()=>onPreview(point.id)} onBlur={()=>onPreview(null)} onClick={()=>onPin(point.id)}
   onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onPin(point.id);}if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const nodes=[...event.currentTarget.ownerSVGElement!.querySelectorAll<SVGGElement>('.chart-point')];nodes[Math.max(0,Math.min(nodes.length-1,nodes.indexOf(event.currentTarget)+(event.key==='ArrowDown'?1:-1)))]?.focus();}}}>
   <title>{inspect(point)}</title><rect x={layout.left-4} y={point.cy-9} width={width-layout.left-10} height="18" fill="transparent"/>
   <rect className="point-mark" x={Math.min(layout.baseline,point.end)} y={point.cy-6} width={Math.abs(point.end-layout.baseline)} height="12" rx="2" fill={familyColor(point.family)} opacity={point.series==='input'?.5:1}/>
   {whisker(point)?<g className="bar-whisker" aria-hidden="true">
    <line x1={whisker(point)!.low} x2={whisker(point)!.high} y1={point.cy} y2={point.cy}/>
    <line x1={whisker(point)!.low} x2={whisker(point)!.low} y1={point.cy-4} y2={point.cy+4}/><line x1={whisker(point)!.high} x2={whisker(point)!.high} y1={point.cy-4} y2={point.cy+4}/></g>:null}
   <text className="bar-value" x={Math.min(width-8,Math.max(layout.baseline,point.end,whisker(point)?.high??0)+5)} y={point.cy+4}>{formatChartNumber(point.y)}{point.stderr!==undefined?' ± '+formatChartNumber(point.stderr):''}</text>
  </g>)}
 </svg>;
}
