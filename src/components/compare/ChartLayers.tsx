import {useId} from 'react';
import type {CompareViewOptions,BlendWeights} from '../../lib/compare-view-options';
import {BLEND_MEASURES} from '../../lib/compare-custom-axis';

export type ScoreFileState={fileName:string;matched:number;unmatched:string[];problems:string[]};
type Props={
  options:CompareViewOptions;onOptions:(patch:Partial<CompareViewOptions>)=>void;
  scatter:boolean;costAxis:boolean;canCostWorkload:boolean;
  frontier:boolean;labels:boolean;onFrontier:()=>void;onLabels:()=>void;
  /** A sensible starting budget for the records shown, or null when there is nothing to budget against. */
  budgetStart:number|null;
  months:string[];
  /** True while release dates are still being fetched; playing before then would skip to the end. */
  timelineLoading:boolean;
  /** The month the chart is actually showing, which differs from the requested one when that month has no data. */
  asOfMonth:string|null;fallbackMonth:string;playing:boolean;onPlay:()=>void;timelineNote:string;
  zoomed:boolean;onResetZoom:()=>void;
  scores:ScoreFileState|null;onScoreFile:(file:File|null)=>void;blendMissing:number;
  /** Measures at least one shown record carries; the rest cannot be weighted. */
  blendAvailable:ReadonlySet<keyof BlendWeights>;
};
const PREFERRED_WEIGHTS:BlendWeights={intelligence:60,coding:30,speed:10};
/** Start from the preferred split, dropping measures these records do not have. */
const startingWeights=(available:ReadonlySet<keyof BlendWeights>):BlendWeights=>({
  intelligence:available.has('intelligence')?PREFERRED_WEIGHTS.intelligence:0,coding:available.has('coding')?PREFERRED_WEIGHTS.coding:0,speed:available.has('speed')?PREFERRED_WEIGHTS.speed:0});
const monthLabel=(month:string)=>new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month));

/** Optional layers and the visitor's own numbers. Every control here changes what is drawn, never what was measured. */
export default function ChartLayers({options,onOptions,scatter,costAxis,canCostWorkload,frontier,labels,onFrontier,onLabels,budgetStart,months,timelineLoading,asOfMonth,fallbackMonth,playing,onPlay,timelineNote,zoomed,onResetZoom,scores,onScoreFile,blendMissing,blendAvailable}:Props){
  const DEFAULT_WEIGHTS=startingWeights(blendAvailable);
  const id=useId();
  const shownMonth=asOfMonth?months.indexOf(asOfMonth):-1;
  const monthIndex=shownMonth>=0?shownMonth:months.length-1;
  const weights=options.weights;
  const million=(value:number)=>Number((value/1e6).toFixed(3));
  // A workload of no tokens costs nothing everywhere, which is not a chart; keep the last real figures until one is non-zero.
  const setWorkload=(input:number,output:number)=>{const tokens={inputTokensPerDay:Math.max(0,input||0)*1e6,outputTokensPerDay:Math.max(0,output||0)*1e6};if(tokens.inputTokensPerDay+tokens.outputTokensPerDay>0)onOptions({workload:tokens});};
  const extras=[options.valueLines&&costAxis,options.sizeBySpeed,options.workload,weights,scores].filter(Boolean).length;
  if(!scatter)return null;
  return <>
    <div className="chart-layers" role="group" aria-label="Chart layers">
      <button type="button" className="toggle-check pareto-toggle" aria-pressed={frontier} onClick={onFrontier}>Pareto line</button>
      <button type="button" className="toggle-check" aria-pressed={labels} onClick={onLabels}>Labels</button>
      {costAxis?<button type="button" className="toggle-check" aria-pressed={options.budget!==null} disabled={options.budget===null&&budgetStart===null}
        onClick={()=>onOptions({budget:options.budget===null?budgetStart:null})}>Budget</button>:null}
      <button type="button" className="toggle-check" aria-pressed={options.asOf!==null}
        onClick={()=>onOptions({asOf:options.asOf?null:months[months.length-1]??fallbackMonth})}>Timeline</button>
      <details className="axis-menu">
        <summary>More{extras?` · ${extras}`:''}</summary>
        <div className="axis-menu-panel">
          <fieldset>
            <legend>Layers</legend>
            {costAxis?<label className="toolbar-check axis-menu-option"><input type="checkbox" checked={options.valueLines} onChange={event=>onOptions({valueLines:event.target.checked})}/>Value lines: equal score per dollar</label>:null}
            <label className="toolbar-check axis-menu-option"><input type="checkbox" checked={options.sizeBySpeed} onChange={event=>onOptions({sizeBySpeed:event.target.checked})}/>Size points by output speed</label>
          </fieldset>
          {canCostWorkload?<fieldset>
            <legend><label className="toolbar-check"><input type="checkbox" checked={Boolean(options.workload)}
              onChange={event=>onOptions({workload:event.target.checked?{inputTokensPerDay:1e6,outputTokensPerDay:25e4}:null})}/>Cost my workload</label></legend>
              <p>Turns list prices into a monthly bill: tokens per day, times each record’s input and output price, times 30 days.</p>
              <div className="axis-menu-pair">
                <label htmlFor={id+'-win'}>Input, million tokens a day<input id={id+'-win'} type="number" min="0" step="0.1" inputMode="decimal" disabled={!options.workload}
                  value={options.workload?million(options.workload.inputTokensPerDay):1} onChange={event=>setWorkload(Number(event.target.value),million(options.workload?.outputTokensPerDay??25e4))}/></label>
                <label htmlFor={id+'-wout'}>Output, million tokens a day<input id={id+'-wout'} type="number" min="0" step="0.05" inputMode="decimal" disabled={!options.workload}
                  value={options.workload?million(options.workload.outputTokensPerDay):.25} onChange={event=>setWorkload(million(options.workload?.inputTokensPerDay??1e6),Number(event.target.value))}/></label>
              </div>
          </fieldset>:null}
          <fieldset>
            <legend><label className="toolbar-check"><input type="checkbox" checked={Boolean(weights)} disabled={!weights&&blendAvailable.size<2}
              onChange={event=>{onOptions({weights:event.target.checked?DEFAULT_WEIGHTS:null});if(event.target.checked)onScoreFile(null);}}/>Weight the vertical axis</label></legend>
            <p>Each measure is rescaled 0 to 100 across the records shown, then averaged by your weights. Records missing a weighted measure are left out. This is your weighting, not an AI Stats score.</p>
            {BLEND_MEASURES.filter(measure=>blendAvailable.has(measure.key)||Boolean(weights?.[measure.key])).map(measure=><label key={measure.key} className="axis-menu-slider" htmlFor={id+'-'+measure.key}>
              <span>{measure.label}{blendAvailable.has(measure.key)?'':' (not measured here)'}</span>
              <input id={id+'-'+measure.key} type="range" min="0" max="100" step="5" disabled={!weights||!blendAvailable.has(measure.key)} value={weights?.[measure.key]??DEFAULT_WEIGHTS[measure.key]}
                onChange={event=>{const next={...(weights??DEFAULT_WEIGHTS),[measure.key]:Number(event.target.value)};if(next.intelligence+next.coding+next.speed>0)onOptions({weights:next});}}/>
              <output htmlFor={id+'-'+measure.key}>{weights?.[measure.key]??DEFAULT_WEIGHTS[measure.key]}</output>
            </label>)}
            {weights&&blendMissing?<p role="status">{blendMissing} selected {blendMissing===1?'record is':'records are'} not plotted: {blendMissing===1?'it is':'they are'} missing a weighted measure or scored under an older index version.</p>:null}
          </fieldset>
          <fieldset>
            <legend>Plot your own scores</legend>
            <p>A CSV with two columns: model name, then your score. It is read in this browser and never uploaded. Names must match a record exactly.</p>
            <label className="axis-menu-file" htmlFor={id+'-file'}>{scores?'Replace file':'Choose a CSV file'}
              <input id={id+'-file'} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={event=>{onScoreFile(event.target.files?.[0]??null);event.target.value='';}}/></label>
            {scores?<div role="status" className="axis-menu-result">
              <p><strong>{scores.fileName}</strong>: {scores.matched} matched{scores.unmatched.length?`, ${scores.unmatched.length} not matched`:''}.</p>
              {scores.unmatched.length?<p>Not matched: {scores.unmatched.slice(0,8).join(', ')}{scores.unmatched.length>8?`, and ${scores.unmatched.length-8} more`:''}.</p>:null}
              {scores.problems.length?<p>{scores.problems.slice(0,3).join(' ')}{scores.problems.length>3?` ${scores.problems.length-3} more lines could not be read.`:''}</p>:null}
              <button type="button" onClick={()=>onScoreFile(null)}>Remove my scores</button>
            </div>:null}
          </fieldset>
        </div>
      </details>
      {zoomed?<button type="button" onClick={onResetZoom}>Reset zoom</button>:null}
    </div>
    {options.asOf?<div className="timeline-bar">
      {months.length>1?<>
      <button type="button" className="timeline-play" aria-pressed={playing} disabled={timelineLoading} onClick={onPlay}>{playing?'Pause':monthIndex>=months.length-1?'Replay':'Play'}</button>
      <label htmlFor={id+'-month'}><span className="sr-only">Show models released by</span>
        <input id={id+'-month'} type="range" min="0" max={months.length-1} step="1" value={monthIndex} aria-valuetext={monthLabel(months[monthIndex])}
          onChange={event=>onOptions({asOf:months[Number(event.target.value)]})}/></label>
      <output htmlFor={id+'-month'}>{monthLabel(months[monthIndex])}</output></>:null}
      <p role="status">{timelineNote}</p>
    </div>:null}
  </>;
}
