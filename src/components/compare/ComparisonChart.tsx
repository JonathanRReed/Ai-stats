import HorizontalBars from './HorizontalBars';
import {useEffect,useId,useRef,useState,type PointerEvent as ReactPointerEvent,type RefObject} from 'react';
import {plotGeometry,formatChartNumber,type PlotZoom} from '../../lib/compare-geometry';
import {compatibleVariantLines,frontierSegments,plottableSeriesPoints,EXPLORER_SOURCE_LABELS,type CompareSeries,type SeriesPoint} from '../../lib/compare-series';
import {familyColor} from '../../lib/family-color';
import {endpointLabels} from '../../lib/endpoint-labels';
import {providerIcon} from '../../lib/provider-icons';
import {reasoningRank} from '../../lib/compare-family-lines';
import {compactLegendStartY} from '../../lib/chart-legend-layout';
import {bestUnderBudget,dominators,isoValueLevels,isRecentRelease,sizeScale,stalenessTier} from '../../lib/chart-overlays';
export {familyColor};

/** Optional layers. Each one explains the measurements; none of them moves a point. */
export type ChartOverlays={
  /** A cost ceiling on the horizontal axis, with the best record under it ringed. */
  budget?:number|null;onBudget?:(value:number)=>void;budgetLabel?:(value:number)=>string;
  /** The answer the page states in words. When given, the chart rings exactly this record instead of working it out again. */
  budgetBestId?:string|null;budgetBestLabel?:string;
  /** Lines of equal score points per dollar. */
  valueLines?:boolean;
  sizeBySpeed?:boolean;
  zoom?:PlotZoom|null;onZoom?:(zoom:PlotZoom|null)=>void;
  /** A family kept in focus until released, as opposed to the passing focus of a hover. */
  soloFamily?:string|null;onSolo?:(key:string|null)=>void;
  /** A second pinned record, shown beside the first. */
  compareId?:string|null;
  /** The date the data is read as of: the newest observation shown, or the timeline month. */
  today?:string|null;
  /** A faint reference line, used by the timeline to keep today's Pareto line in view. */
  ghostLine?:Array<{x:number;y:number}>;ghostLabel?:string;
  /** Extra coordinates that hold the axes steady while the plotted set changes. */
  domainPoints?:Array<{id:string;x:number;y:number}>;
  /** With many records on screen, draw lines and labels only for families on the Pareto line. */
  frontierFocus?:boolean;
};
type Props={series:CompareSeries;referenceFrontier?:CompareSeries;scale?:'linear'|'log';labels:boolean;endpointLane?:boolean;showFamilyLegend?:boolean;compact?:boolean;activeId:string|null;onPreview:(id:string|null)=>void;onPin:(id:string,extend?:boolean)=>void;svgRef:RefObject<SVGSVGElement|null>;onShowLinear?:()=>void;overlays?:ChartOverlays};

const PLOT_LEFT=52;
const LANE_MIN_WIDTH=720;
/** Two decimals keeps server and browser markup identical; raw doubles serialize differently. */
const px=(value:number)=>Math.round(value*100)/100;
export const chartFamilyKey=(point:Pick<SeriesPoint,'source'|'provider'|'family'>)=>JSON.stringify([point.source,point.provider??point.family,point.family]);
const familyKey=chartFamilyKey;
const clip=(text:string,limit:number)=>text.length>limit?text.slice(0,limit-1)+'…':text;

export default function ComparisonChart({series,referenceFrontier,scale,labels,endpointLane=false,showFamilyLegend=false,compact=false,activeId,onPreview,onPin,svgRef,onShowLinear,overlays={}}:Props){
  const frame=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(1000);
  const clipId=useId();
  const [brush,setBrush]=useState<{x0:number;y0:number;x1:number;y1:number}|null>(null);
  const draggingBudget=useRef(false);
  useEffect(()=>{if(!frame.current)return;const observer=new ResizeObserver(([entry])=>setWidth(Math.max(300,Math.round(entry.contentRect.width))));
    observer.observe(frame.current);return()=>observer.disconnect();},[]);
  const height=width<600?420:Math.round(Math.min(compact?500:640,Math.max(compact?440:500,width*.5)));
  const chartScale=scale??series.scale;
  const selectedPlottable=plottableSeriesPoints({...series,scale:chartScale});
  if(series.kind==='bars'&&series.available&&selectedPlottable.length)return <div className="comparison-plot horizontal-bars" ref={frame}>
    {selectedPlottable.every(point=>point.y===0)?<p className="zero-price-note">Every selected value is 0. Zero values are shown without a bar.</p>:null}
    <HorizontalBars series={series} points={selectedPlottable} width={width} scale={chartScale} activeId={activeId} onPreview={onPreview} onPin={onPin} svgRef={svgRef}/>
  </div>;

  const {budget=null,onBudget,budgetLabel,budgetBestId,budgetBestLabel,valueLines=false,sizeBySpeed=false,zoom=null,onZoom,soloFamily=null,onSolo,compareId=null,today=null,ghostLine,ghostLabel,domainPoints,frontierFocus=false}=overlays;
  const referencePlottable=referenceFrontier?plottableSeriesPoints({...referenceFrontier,scale:chartScale}):[];
  const geometryInput=[...new Map([...selectedPlottable,...referencePlottable].map(point=>[point.id,point])).values()];
  const displayReference=series.kind==='scatter'?referenceFrontier:null;
  // Only frontier members that can actually be drawn on this axis count as visible reference geometry.
  const referencePlottableIds=new Set(referencePlottable.map(point=>point.id));
  const currentFrontierIds=new Set(Object.values(displayReference?.frontierGroups??{}).flat().filter(id=>referencePlottableIds.has(id)));
  const ownFrontierIds=new Set(displayReference?[]:Object.values(series.frontierGroups).flat());
  const frontierIds=new Set([...currentFrontierIds,...ownFrontierIds]);
  const hasFrontier=frontierIds.size>0;

  const families=[...new Map(series.points.map(point=>[familyKey(point),point])).values()];
  const narrow=width<LANE_MIN_WIDTH;
  const showLane=endpointLane&&labels&&series.kind==='scatter'&&!narrow;
  // Embedded charts list every family beside the plot, so they skip the capped in-plot key.
  const compactLegend=showFamilyLegend||endpointLane&&narrow&&!compact?families.slice(0,6):[];
  const legendOverflow=compactLegend.length?Math.max(0,families.length-compactLegend.length):0;
  const legendColumns=width<420?2:3;
  const legendRows=Math.ceil(compactLegend.length/legendColumns)+(legendOverflow?1:0);
  const legendStartY=compactLegendStartY(false,true)+8;
  const topPadding=40+(compactLegend.length?legendRows*15+6:0);

  // Names that collide across labs or sources carry the lab so two lines never share one label.
  const nameCounts=new Map<string,number>();
  families.forEach(point=>nameCounts.set(point.family,(nameCounts.get(point.family)??0)+1));
  const laneName=(point:SeriesPoint)=>nameCounts.get(point.family)!>1?`${point.family} · ${point.provider??EXPLORER_SOURCE_LABELS[point.source]}`:point.family;
  const laneWidth=showLane?Math.min(236,Math.max(132,Math.max(0,...families.map(point=>Math.min(26,laneName(point).length)))*6.7+40)):24;

  const extraDomain=(domainPoints??[]).filter(point=>chartScale!=='log'||point.x>0);
  const plot=plotGeometry([...geometryInput,...extraDomain.map(point=>({...point,id:'domain:'+point.id}))],series.kind,chartScale,width,height,topPadding,laneWidth,PLOT_LEFT,zoom);
  const inPlot=(point:{cx:number;cy:number})=>point.cx>=plot.left-.5&&point.cx<=plot.right+.5&&point.cy>=plot.top-.5&&point.cy<=plot.bottom+.5;
  const drawn=plot.points.filter(point=>!point.id.startsWith('domain:')) as Array<typeof plot.points[number]&SeriesPoint>;
  const byId=new Map(drawn.map(point=>[point.id,point]));
  const selectedIds=new Set(selectedPlottable.map(point=>point.id));
  const inspectablePoints=drawn.filter(point=>(selectedIds.has(point.id)||currentFrontierIds.has(point.id))&&inPlot(point));
  const activePoint=activeId?byId.get(activeId)??null:null;
  const activeFamily=activePoint?familyKey(activePoint):null;
  const focusFamily=activeFamily??soloFamily;
  const frontierFamilies=new Set(inspectablePoints.filter(point=>frontierIds.has(point.id)).map(familyKey));
  // One emphasis rule for lines, points and labels: inspection wins, then a held family, then the Pareto line.
  const emphasis=(key:string)=>focusFamily?(key===focusFamily?'focus':'dim'):hasFrontier?(frontierFamilies.has(key)?'lead':'rest'):'plain';

  const lines=compatibleVariantLines(selectedPlottable).map(points=>[...points]
    .sort((a,b)=>reasoningRank(a.reasoning)-reasoningRank(b.reasoning)||a.x-b.x||a.id.localeCompare(b.id))
    .map(point=>byId.get(point.id)).filter((point):point is NonNullable<typeof point>=>Boolean(point))).filter(points=>points.length>1&&(!frontierFocus||frontierFamilies.has(familyKey(points[0]))));

  const endpointCandidates=inspectablePoints.filter(point=>!frontierFocus||frontierFamilies.has(familyKey(point))).map(point=>({id:point.id,group:familyKey(point),label:laneName(point),cx:point.cx,cy:point.cy}));
  const laneLabels=showLane?endpointLabels(endpointCandidates,{top:plot.top+6,bottom:plot.bottom-4,gap:19,activeId}):[];
  const hiddenLaneLabels=showLane?Math.max(0,new Set(endpointCandidates.map(point=>point.group)).size-laneLabels.length):0;
  const laneX=plot.right+16;
  // A family present only as Pareto reference is named too, but quieter, so it does not read as part of the selection.
  const selectedFamilies=new Set(inspectablePoints.filter(point=>selectedIds.has(point.id)).map(familyKey));

  // Overlays ---------------------------------------------------------
  const costAxis=!series.higherXIsBetter;
  const radiusFor=sizeBySpeed?sizeScale(inspectablePoints.map(point=>point.outputSpeed??NaN)):null;
  const speeds=sizeBySpeed?inspectablePoints.map(point=>point.outputSpeed).filter((value):value is number=>typeof value==='number'):[];
  const radius=(point:SeriesPoint)=>radiusFor?.(point.outputSpeed)??(activeId===point.id?6.5:frontierIds.has(point.id)?5.5:4.25);
  const beaten=activePoint?new Set(dominators(activePoint,inspectablePoints,series.higherXIsBetter).map(point=>point.id)):new Set<string>();
  const showBudget=budget!==null&&costAxis;
  const budgetX=showBudget?Math.min(plot.right,Math.max(plot.left,plot.xPixel(budget!))):null;
  const budgetBest=!showBudget?null:budgetBestId!==undefined?(budgetBestId?{id:budgetBestId,label:budgetBestLabel??byId.get(budgetBestId)?.label??''}:null):bestUnderBudget(inspectablePoints,budget!);
  const valueLevels=valueLines&&costAxis?isoValueLevels(inspectablePoints):[];
  const valuePaths=valueLevels.map(level=>{
    const samples:Array<[number,number]>=[];
    for(let step=0;step<=48;step++){
      const cx=plot.left+(plot.right-plot.left)*step/48,value=plot.xValueAt(cx)*level;
      if(value>=plot.yRange[0]&&value<=plot.yRange[1])samples.push([cx,plot.yPixel(value)]);
    }
    return {level,samples};
  }).filter(path=>path.samples.length>1);

  const svgPoint=(event:{clientX:number;clientY:number})=>{
    const box=svgRef.current?.getBoundingClientRect();
    if(!box||!box.width)return {x:0,y:0};
    return {x:(event.clientX-box.left)*width/box.width,y:(event.clientY-box.top)*height/box.height};
  };
  const clampX=(value:number)=>Math.min(plot.right,Math.max(plot.left,value));
  const clampY=(value:number)=>Math.min(plot.bottom,Math.max(plot.top,value));
  const startBrush=(event:ReactPointerEvent<SVGRectElement>)=>{
    // Touch keeps its normal job of scrolling the page; a mouse or pen draws the zoom window.
    if(!onZoom||event.pointerType==='touch'||event.button!==0)return;
    const at=svgPoint(event);event.currentTarget.setPointerCapture(event.pointerId);
    setBrush({x0:at.x,y0:at.y,x1:at.x,y1:at.y});
  };
  const moveBrush=(event:ReactPointerEvent<SVGRectElement>)=>{if(!brush)return;const at=svgPoint(event);setBrush({...brush,x1:clampX(at.x),y1:clampY(at.y)});};
  const endBrush=()=>{
    if(!brush)return;
    const wide=Math.abs(brush.x1-brush.x0),tall=Math.abs(brush.y1-brush.y0);
    if(wide>12&&tall>12&&onZoom)onZoom({x:[plot.xValueAt(Math.min(brush.x0,brush.x1)),plot.xValueAt(Math.max(brush.x0,brush.x1))],
      y:[plot.yValueAt(Math.max(brush.y0,brush.y1)),plot.yValueAt(Math.min(brush.y0,brush.y1))]});
    setBrush(null);
  };
  const dragBudget=(event:ReactPointerEvent<SVGGElement>)=>{if(draggingBudget.current&&onBudget)onBudget(plot.xValueAt(clampX(svgPoint(event).x)));};
  const nudgeBudget=(direction:number)=>{if(onBudget&&budgetX!==null)onBudget(plot.xValueAt(clampX(budgetX+direction*(plot.right-plot.left)*.03)));};

  const recentIds=new Set(inspectablePoints.filter(point=>isRecentRelease(point.releasedAt,today)).map(point=>point.id));
  // A compact readout beside the inspected point, flipped to stay inside the plot. The full record sits below the chart.
  const tip=activePoint?(()=>{
    const name=clip(activePoint.label,38),values=formatChartNumber(activePoint.y)+' '+activePoint.unit+' · '+formatChartNumber(activePoint.x)+' '+clip(series.xLabel,26);
    const boxWidth=Math.min(width-16,Math.max(name.length*6.9,values.length*6.3)+22),boxHeight=42;
    const right=activePoint.cx+14+boxWidth<=width-8;
    const x=right?activePoint.cx+14:Math.max(8,activePoint.cx-14-boxWidth);
    const y=activePoint.cy-boxHeight-10>=4?activePoint.cy-boxHeight-10:activePoint.cy+14;
    return {name,values,x,y,boxWidth,boxHeight};
  })():null;
  const inspect=(point:SeriesPoint)=>point.label+': '+formatChartNumber(point.x)+' '+series.xLabel+' · '+formatChartNumber(point.y)+' '+point.unit;
  const xTitle=series.xLabel+(chartScale==='log'?' · log scale':'');
  const budgetText=budget!==null?(budgetLabel?.(budget)??formatChartNumber(budget)):'';

  return <div className="comparison-plot" ref={frame} style={{minHeight:height}}>
    {!series.available?<div className="plot-empty"><h2>Awaiting data access</h2><p>{series.unavailableReason}</p></div>:
    !selectedPlottable.length&&!currentFrontierIds.size?<div className="plot-empty">{series.points.length&&chartScale==='log'?<>
      <h2>Nothing to plot on Log</h2><p>Every selected measurement ({series.points.length}) is zero or negative on this axis, so none can sit on a log scale.</p>
      {onShowLinear?<button type="button" className="scale-notice-action" onClick={onShowLinear}>Show all on Linear</button>:null}</>:
      <><h2>No comparable measurements selected</h2><p>Choose models with measurements for this view.</p></>}</div>:
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} style={{height}} role="group" aria-label={series.yLabel+' versus '+series.xLabel}
      data-inspecting={focusFamily?'true':undefined}>
      <title>{series.yLabel+' versus '+series.xLabel}</title>
      <defs><clipPath id={clipId}><rect x={plot.left} y={plot.top-8} width={plot.right-plot.left} height={plot.bottom-plot.top+16}/></clipPath></defs>
      <text className="plot-label plot-label-y" x="12" y="17">{series.yLabel}</text>
      {hasFrontier?<g aria-label={displayReference?'Current Pareto line':'Pareto line'}>
        <line className="frontier-key" x1={plot.right-96} x2={plot.right-70} y1="13" y2="13"/>
        <text className="plot-legend" x={plot.right} y="17" textAnchor="end">Pareto line</text></g>:null}
      {recentIds.size&&!narrow?<g aria-label="A dotted ring marks a release in the last 30 days">
        <circle className="release-ring" cx={plot.right-(speeds.length?486:300)} cy="13" r="6"/>
        <text className="plot-legend" x={plot.right-(speeds.length?474:288)} y="17">Released in the last 30 days</text></g>:null}
      {speeds.length&&!narrow?<g aria-label="Point size shows output speed">
        <circle className="size-key" cx={plot.right-306} cy="13" r="3.5"/><circle className="size-key" cx={plot.right-288} cy="13" r="8"/>
        <text className="plot-legend" x={plot.right-274} y="17">{formatChartNumber(Math.min(...speeds))} to {formatChartNumber(Math.max(...speeds))} tokens/s</text></g>:null}
      {compactLegend.map((point,index)=>{const x=12+(index%legendColumns)*Math.max(96,(width-24)/legendColumns),y=legendStartY+Math.floor(index/legendColumns)*15;
        return <g key={familyKey(point)}>
         <circle cx={x+4} cy={y-4} r="3.5" fill={familyColor(point.family)}/><text className="plot-legend" x={x+12} y={y}><title>{`${EXPLORER_SOURCE_LABELS[point.source]} · ${point.provider} · ${point.family}`}</title>{clip(point.family,width<420?18:16)}</text>
        </g>;})}
      {legendOverflow?<text className="plot-legend" x={width-12} y={legendStartY+Math.ceil(compactLegend.length/legendColumns)*15} textAnchor="end">+{legendOverflow} in Models</text>:null}

      {plot.yTicks.map(tick=><g key={tick.label+':'+tick.position}><line className="plot-grid" x1={plot.left} x2={plot.right} y1={px(tick.position)} y2={px(tick.position)}/>
        <text className="plot-tick" x={plot.left-10} y={px(tick.position+4)} textAnchor="end">{tick.label}</text></g>)}
      {plot.xTicks.map(tick=><g key={tick.label+':'+tick.position}><line className="plot-tick-mark" x1={px(tick.position)} x2={px(tick.position)} y1={plot.bottom} y2={plot.bottom+5}/>
        <text className="plot-tick" x={px(tick.position)} y={plot.bottom+22} textAnchor="middle">{tick.label}</text></g>)}
      <line className="plot-axis" x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom}/>

      {valuePaths.map(path=>{const [endX,endY]=path.samples[path.samples.length-1];const top=endY<=plot.top+2;
        return <g key={'value:'+path.level} className="value-line" aria-hidden="true">
          <polyline points={path.samples.map(([cx,cy])=>px(cx)+','+px(cy)).join(' ')}/>
          <text x={px(top?endX+4:endX-4)} y={px(top?plot.top+11:endY-5)} textAnchor={top?'start':'end'}>{formatChartNumber(path.level)} pts per $</text>
        </g>;})}
      {activePoint&&activePoint.cohortKey?<rect className="dominance-region" aria-hidden="true" x={px(series.higherXIsBetter?activePoint.cx:plot.left)} y={plot.top}
        width={px(Math.max(0,series.higherXIsBetter?plot.right-activePoint.cx:activePoint.cx-plot.left))} height={px(Math.max(0,activePoint.cy-plot.top))}/>:null}
      <rect className="plot-surface" x={plot.left} y={plot.top} width={plot.right-plot.left} height={plot.bottom-plot.top} fill="transparent"
        onPointerDown={startBrush} onPointerMove={moveBrush} onPointerUp={endBrush} onPointerCancel={()=>setBrush(null)} onDoubleClick={()=>onZoom?.(null)}/>

      {laneLabels.map(item=>{const point=byId.get(item.id);if(!point)return null;
        return <line key={'leader:'+item.group} className="family-endpoint-leader" data-emphasis={emphasis(item.group)} stroke={familyColor(point.family)}
          x1={px(item.cx+7)} y1={px(item.cy)} x2={laneX-7} y2={px(item.labelY)}/>;})}
      <g clipPath={`url(#${clipId})`}>
        {ghostLine&&ghostLine.length>1?<polyline className="ghost-frontier" aria-label={ghostLabel}
          points={ghostLine.filter(point=>chartScale!=='log'||point.x>0).map(point=>px(plot.xPixel(point.x))+','+px(plot.yPixel(point.y))).join(' ')}/>:null}
        {lines.map(points=><polyline key={'line:'+familyKey(points[0])+':'+points[0].cohortKey} className="variant-link" data-emphasis={emphasis(familyKey(points[0]))}
          stroke={familyColor(points[0].family)} points={points.map(point=>px(point.cx)+','+px(point.cy)).join(' ')}/>)}
        {(!displayReference?Object.entries(series.frontierGroups):[]).flatMap(([key,ids])=>frontierSegments(ids,byId).map((run,index)=><polyline key={key+':'+index} className="frontier-line"
          points={run.map(point=>px(point.cx)+','+px(point.cy)).join(' ')}/>))}
        {displayReference&&Object.entries(displayReference.frontierGroups).map(([key,ids])=><g key={'reference:'+key}>
          {frontierSegments(ids,byId).map((run,index)=><polyline key={index} className="current-frontier-line" points={run.map(point=>px(point.cx)+','+px(point.cy)).join(' ')}/>)}
          {ids.map(id=>{const point=byId.get(id);return point?<circle key={id} className="current-frontier-mark" cx={px(point.cx)} cy={px(point.cy)} r="7.5"><title>{`${point.label} · Pareto line`}</title></circle>:null;})}
        </g>)}
      </g>
      {ghostLine&&ghostLine.length>1&&ghostLabel?<text className="plot-legend ghost-frontier-label" x={plot.right-110} y="17" textAnchor="end">{ghostLabel}</text>:null}

      {activePoint?<g className="point-guide" aria-hidden="true">
        <line x1={px(activePoint.cx)} x2={px(activePoint.cx)} y1={px(activePoint.cy+8)} y2={plot.bottom}/>
        <line x1={plot.left} x2={px(activePoint.cx-8)} y1={px(activePoint.cy)} y2={px(activePoint.cy)}/>
      </g>:null}

      {inspectablePoints.map(point=>{const key=familyKey(point),size=radius(point),stale=stalenessTier(point.receipt.observedAt,today);
        return <g key={point.id} role="button" tabIndex={0} aria-label={inspect(point)+(selectedIds.has(point.id)?'':' · Pareto reference model')}
        className={'chart-point'+(activeId===point.id?' is-active':'')+(frontierIds.has(point.id)?' is-frontier':'')+(compareId===point.id?' is-compared':'')+(budgetBest?.id===point.id?' is-budget-best':'')}
        data-emphasis={emphasis(key)} data-beats={beaten.has(point.id)?'true':undefined} data-stale={stale||undefined}
        onPointerEnter={()=>onPreview(point.id)} onPointerLeave={()=>onPreview(null)} onFocus={()=>onPreview(point.id)}
        onBlur={()=>onPreview(null)} onClick={event=>onPin(point.id,event.shiftKey)}
        onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onPin(point.id,event.shiftKey);}
          if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const nodes=[...event.currentTarget.ownerSVGElement!.querySelectorAll<SVGGElement>('.chart-point')];
            nodes[Math.max(0,Math.min(nodes.length-1,nodes.indexOf(event.currentTarget)+(event.key==='ArrowRight'?1:-1)))]?.focus();}}}>
        <circle cx={px(point.cx)} cy={px(point.cy)} r={Math.max(12,size+4)} fill="transparent"/>
        {recentIds.has(point.id)?<circle className="release-ring" cx={px(point.cx)} cy={px(point.cy)} r={px(size+4.5)}/>:null}
        {budgetBest?.id===point.id||compareId===point.id?<circle className="callout-ring" cx={px(point.cx)} cy={px(point.cy)} r={px(size+4.5)}/>:null}
        <circle className="point-mark" cx={px(point.cx)} cy={px(point.cy)} r={px(size)} fill={familyColor(point.family)}/>
      </g>;})}

      {budgetX!==null?<rect className="budget-shade" aria-hidden="true" x={px(budgetX)} y={plot.top-8} width={px(Math.max(0,plot.right-budgetX))} height={plot.bottom-plot.top+8}/>:null}
      {budgetX!==null?<g className="budget-cursor" role="slider" tabIndex={onBudget?0:undefined} aria-label={'Budget on '+series.xLabel} aria-orientation="horizontal"
        aria-valuemin={plot.xRange[0]} aria-valuemax={plot.xRange[1]} aria-valuenow={budget!} aria-valuetext={budgetText+(budgetBest?', best under it: '+budgetBest.label:'')}
        onPointerDown={event=>{if(!onBudget)return;draggingBudget.current=true;event.currentTarget.setPointerCapture(event.pointerId);}}
        onPointerMove={dragBudget} onPointerUp={()=>{draggingBudget.current=false;}} onPointerCancel={()=>{draggingBudget.current=false;}}
        onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowDown'){event.preventDefault();nudgeBudget(-1);}if(event.key==='ArrowRight'||event.key==='ArrowUp'){event.preventDefault();nudgeBudget(1);}}}>
        <rect x={px(budgetX-11)} y={plot.top-22} width="22" height={plot.bottom-plot.top+22} fill="transparent"/>
        <line className="budget-line" x1={px(budgetX)} x2={px(budgetX)} y1={plot.top-6} y2={plot.bottom}/>
        <rect className="budget-grip" x={px(budgetX-5)} y={plot.top-20} width="10" height="16" rx="2"/>
        <text className="budget-label" x={px(budgetX<plot.left+90?budgetX+10:budgetX-10)} y={plot.top-8} textAnchor={budgetX<plot.left+90?'start':'end'}>{budgetText}</text>
      </g>:null}
      {brush?<rect className="zoom-brush" aria-hidden="true" x={px(Math.min(brush.x0,brush.x1))} y={px(Math.min(brush.y0,brush.y1))}
        width={px(Math.abs(brush.x1-brush.x0))} height={px(Math.abs(brush.y1-brush.y0))}/>:null}

      {laneLabels.map(item=>{const point=byId.get(item.id);if(!point)return null;
        const mark=providerIcon(point.provider,point.family),color=familyColor(point.family),name=laneName(point);
        return <g key={'label:'+item.group} className="family-endpoint" data-emphasis={emphasis(item.group)} data-reference={selectedFamilies.has(item.group)?undefined:'true'} aria-label={name+' endpoint'}
          role={onSolo?'button':undefined} tabIndex={onSolo?0:undefined} aria-pressed={onSolo?soloFamily===item.group:undefined}
          onPointerEnter={()=>onPreview(item.id)} onPointerLeave={()=>onPreview(null)}
          onClick={()=>onSolo?onSolo(soloFamily===item.group?null:item.group):onPin(item.id)}
          onKeyDown={event=>{if(onSolo&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onSolo(soloFamily===item.group?null:item.group);}}}>
          <rect x={laneX-4} y={px(item.labelY-9)} width={laneWidth-14} height="18" fill="transparent"/>
          {mark?<image className={'lab-mark'+(mark.mono?' is-mono':'')} href={mark.src} x={laneX} y={px(item.labelY-7)} width="14" height="14"/>:
            <circle cx={laneX+7} cy={px(item.labelY)} r="3.5" fill={color}/>}
          <text className="family-endpoint-label" x={laneX+21} y={px(item.labelY+4)} fill={color}><title>{`${name} · ${point.provider??''} · ${EXPLORER_SOURCE_LABELS[point.source]}`}</title>{clip(name,26)}</text>
        </g>;})}
      {tip?<g className="point-tip" aria-hidden="true">
        <rect x={px(tip.x)} y={px(tip.y)} width={px(tip.boxWidth)} height={tip.boxHeight} rx="6"/>
        <text className="point-tip-name" x={px(tip.x+11)} y={px(tip.y+17)}>{tip.name}</text>
        <text className="point-tip-values" x={px(tip.x+11)} y={px(tip.y+33)}>{tip.values}</text>
      </g>:null}
      {hiddenLaneLabels?<text className="plot-legend" x={plot.right} y={height-10} textAnchor="end">{hiddenLaneLabels} more: hover or select points</text>:null}

      <text className="plot-label" x={px((plot.left+plot.right)/2)} y={height-10} textAnchor="middle">{xTitle}</text>
    </svg>}
  </div>;
}
