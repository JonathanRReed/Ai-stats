import {useEffect,useMemo,useRef,useState} from 'react';
import {parseCompareState,serializeCompareState,selectFamily,type CompareState,type CompareChart} from '../../lib/compare-state';
import {buildCompareSeries,type ExplorerModel} from '../../lib/compare-series';
import {epochConditionKey,type EpochObservation} from '../../lib/epoch-observations';
import {formatChartNumber} from '../../lib/compare-geometry';
import {seriesCsv,downloadText,downloadChartPng} from '../../lib/compare-export';
import ComparisonChart from './ComparisonChart';
import ModelSelector from './ModelSelector';
import ObservationDetails from './ObservationDetails';
export type ExplorerBenchmark={slug:string;name:string};
type Props={models:ExplorerModel[];benchmarks:ExplorerBenchmark[];defaultModelIds:string[]};
const CHARTS:Array<{id:CompareChart;label:string;unavailable?:boolean}>=[
  {id:'cost-intelligence',label:'Price vs intelligence'},{id:'speed-intelligence',label:'Speed vs intelligence'},
  {id:'price',label:'Token prices'},{id:'benchmark',label:'Benchmarks'},
  {id:'task-cost',label:'Task cost',unavailable:true},{id:'total-cost',label:'Total cost',unavailable:true},
  {id:'tokens-task',label:'Tokens / task',unavailable:true},{id:'tokens-total',label:'Total tokens',unavailable:true},
];
const EMPTY_OBSERVATIONS:EpochObservation[]=[];
export default function CompareExplorer({models,benchmarks,defaultModelIds}:Props){
  const [state,setState]=useState(()=>parseCompareState(new URLSearchParams(),models,defaultModelIds));
  const [benchmarkCache,setBenchmarkCache]=useState<Record<string,EpochObservation[]>>({});
  const [loadState,setLoadState]=useState('');const [notice,setNotice]=useState('');
  const [hovered,setHovered]=useState<string|null>(null);const [pinned,setPinned]=useState<string|null>(null);
  const [filtersOpen,setFiltersOpen]=useState(false);const dialog=useRef<HTMLDialogElement>(null);
  const filterButton=useRef<HTMLButtonElement>(null);const svg=useRef<SVGSVGElement>(null);
  useEffect(()=>{const read=()=>setState(parseCompareState(new URLSearchParams(window.location.search),models,defaultModelIds));
    read();window.addEventListener('popstate',read);return()=>window.removeEventListener('popstate',read);},[models,defaultModelIds]);
  const epochSlug=state.chart==='benchmark'&&state.metricId.startsWith('epoch_')?state.metricId.slice(6):null;
  const observations=epochSlug?benchmarkCache[epochSlug]??EMPTY_OBSERVATIONS:EMPTY_OBSERVATIONS;
  useEffect(()=>{
    if(!epochSlug||benchmarkCache[epochSlug]){setLoadState('');return;}
    if(!benchmarks.some(benchmark=>benchmark.slug===epochSlug)){setLoadState('Unknown benchmark in this link.');return;}
    const controller=new AbortController();setLoadState('Loading benchmark observations…');
    fetch('/api/compare-benchmarks/'+encodeURIComponent(epochSlug)+'.json',{signal:controller.signal})
      .then(response=>{if(!response.ok)throw new Error('unavailable');return response.json();})
      .then(payload=>{if(payload.schemaVersion!==1||payload.slug!==epochSlug||!Array.isArray(payload.observations))throw new Error('invalid');
        setBenchmarkCache(previous=>({...previous,[epochSlug]:payload.observations}));setLoadState('');})
      .catch(error=>{if(error.name!=='AbortError')setLoadState('Benchmark data could not load. The other views still work.');});
    return()=>controller.abort();
  },[epochSlug,benchmarkCache,benchmarks]);
  useEffect(()=>{if(filtersOpen&&!dialog.current?.open)dialog.current?.showModal();
    if(!filtersOpen&&dialog.current?.open){dialog.current.close();filterButton.current?.focus();}},[filtersOpen]);
  const series=useMemo(()=>buildCompareSeries({models,observations},state),[models,observations,state]);
  const active=series.points.find(point=>point.id===(pinned??hovered))??null;
  const visibleModels=useMemo(()=>models.filter(model=>epochSlug?model.source==='epoch':model.source==='aa'),[models,epochSlug]);
  const conditions=useMemo(()=>[...new Set(observations.map(row=>epochConditionKey(row.conditions)))].sort(),[observations]);
  const update=(patch:Partial<CompareState>)=>{const next={...state,...patch};setState(next);setPinned(null);setHovered(null);
    const url=new URL(window.location.href);url.search=serializeCompareState(next).toString();window.history.pushState(null,'',url);};
  const toggle=(id:string)=>update({modelIds:state.modelIds.includes(id)?state.modelIds.filter(value=>value!==id):[...state.modelIds,id].slice(0,100)});
  const reset=()=>update(parseCompareState(new URLSearchParams(),models,defaultModelIds));
  const selectorProps={models:visibleModels,selected:state.modelIds,includeHistory:state.includeHistory,onToggle:toggle,
    onFamily:(family:string,checked:boolean)=>update({modelIds:selectFamily(state.modelIds,visibleModels,family,checked,state.includeHistory)}),
    onHistory:(includeHistory:boolean)=>update({includeHistory}),reasoningEfforts:state.reasoningEfforts,
    onReasoning:(value:string)=>update({reasoningEfforts:value==='all'?[]:state.reasoningEfforts.includes(value)
      ?state.reasoningEfforts.filter(reason=>reason!==value):[...state.reasoningEfforts,value]}),onClear:()=>update({modelIds:[]}),onReset:reset};
  const chooseMeasured=()=>{const versions=new Set(observations.map(row=>row.modelVersion));
    update({modelIds:visibleModels.filter(model=>versions.has(model.sourceModelId)).slice(0,8).map(model=>model.id)});};
  const share=async()=>{try{const url=new URL(window.location.href);url.search=serializeCompareState(state).toString();
    await navigator.clipboard.writeText(url.href);setNotice('Comparison link copied.');}catch{setNotice('Copy the address bar to share this comparison.');}};
  const exportPng=async()=>{if(!svg.current)return;try{await downloadChartPng(svg.current,
    'AI Stats · '+series.xLabel+' / '+series.yLabel+' · '+[...new Set(series.points.map(point=>point.receipt.source+' '+(point.receipt.observedAt?.slice(0,10)??'date unknown')))].join(' · '));}
    catch{setNotice('Image export is unavailable in this browser. CSV export is still available.');}};
  return <section className="compare-explorer" aria-label="Model comparison explorer">
    <div className="explorer-title"><h1>Compare models</h1><button type="button" className="mobile-filter-button" ref={filterButton} onClick={()=>setFiltersOpen(true)}>Models and filters</button></div>
    <nav className="chart-tabs" aria-label="Chart type">{CHARTS.map(chart=><button type="button" key={chart.id} disabled={chart.unavailable}
      title={chart.unavailable?'Awaiting permission to publish additional benchmark data':undefined}
      aria-pressed={state.chart===chart.id} onClick={()=>update({chart:chart.id})}>{chart.label}{chart.unavailable?<span aria-hidden="true"> ·</span>:null}</button>)}</nav>
    <div className="explorer-workspace"><div className="chart-panel">
      <div className="chart-toolbar">
        {state.chart==='benchmark'?<label>Benchmark<select value={state.metricId} onChange={event=>update({metricId:event.target.value,conditionKey:null})}>
          <optgroup label="Artificial Analysis"><option value="aa_intelligence_index">Intelligence Index</option><option value="aa_coding_index">Coding Index</option><option value="aa_math_index">Math Index</option></optgroup>
          <optgroup label="Epoch AI">{benchmarks.map(benchmark=><option key={benchmark.slug} value={'epoch_'+benchmark.slug}>{benchmark.name}</option>)}</optgroup></select></label>:null}
        {epochSlug&&conditions.length?<label>Conditions<select value={state.conditionKey??''} onChange={event=>update({conditionKey:event.target.value||null})}>
          <option value="">All recorded runs</option>{conditions.map(key=><option value={key} key={key}>{key==='unknown'?'Not recorded':JSON.parse(key).map(([name,value]:[string,unknown])=>name+': '+value).join(' · ')}</option>)}</select></label>:null}
        <div className="scale-buttons" aria-label="Axis scale"><button type="button" aria-pressed={state.scale==='linear'} onClick={()=>update({scale:'linear'})}>Linear</button>
          <button type="button" aria-pressed={state.scale==='log'} onClick={()=>update({scale:'log'})}>Log</button></div>
        <label className="toolbar-check"><input type="checkbox" checked={state.labels} onChange={event=>update({labels:event.target.checked})}/>Labels</label>
        {series.kind==='scatter'?<label className="toolbar-check"><input type="checkbox" checked={state.frontier} onChange={event=>update({frontier:event.target.checked})}/>Frontier</label>:null}
        <button type="button" onClick={share}>Share</button>
        <details className="export-menu"><summary>Export</summary><div><button type="button" disabled={!series.points.length} onClick={()=>downloadText(seriesCsv(series.points),'ai-stats-comparison.csv')}>CSV with sources</button>
          <button type="button" disabled={!series.points.length} onClick={exportPng}>PNG chart</button></div></details>
      </div>
      {state.missingModelIds.length?<p className="explorer-warning">Unavailable models in this link: {state.missingModelIds.join(', ')}</p>:null}
      {loadState?<p className="explorer-warning" role="status">{loadState}</p>:null}
      {series.scaleNotice?<p className="explorer-warning">{series.scaleNotice}</p>:null}
      {series.mixedConditions?<p className="explorer-warning">These runs used different test settings. Choose conditions for a like-for-like view.</p>:null}
      {epochSlug&&!series.points.length&&observations.length?<button className="choose-measured" type="button" onClick={chooseMeasured}>Select measured models</button>:null}
      <ComparisonChart series={series} labels={state.labels} activeId={active?.id??null} onPreview={setHovered}
        onPin={id=>setPinned(pinned===id?null:id)} svgRef={svg}/>
      <ObservationDetails point={active} pinned={Boolean(pinned)} onPin={()=>setPinned(pinned?null:active?.id??null)} onClose={()=>{setPinned(null);setHovered(null);}}/>
    </div><aside className="desktop-model-selector" aria-label="Model selection"><ModelSelector {...selectorProps}/></aside></div>
    <div className="source-strip"><span>{state.modelIds.length} selected · {series.points.length} plotted observations</span>
      <span>{epochSlug?'Epoch AI':'Artificial Analysis'} · source-native measurements</span>
      {series.excluded.length?<details><summary>{series.excluded.length} excluded</summary><ul>{series.excluded.map((item,index)=><li key={item.modelId+index}>
        {models.find(model=>model.id===item.modelId)?.name??item.modelId}: {item.reason}</li>)}</ul></details>:null}</div>
    <p className="share-notice" role="status">{notice}</p>
    <details className="explorer-methodology"><summary>Methodology and data access</summary>
      <p>Each point is a source record, not a recommendation. Price uses USD per million tokens with a 3:1 input/output blend; it is not benchmark task cost. Speed is output tokens per second.</p>
      <p>Frontiers stay within the same AA index version and timing conditions. Lines connect recorded reasoning variants within a family. Reasoning labels come from the source model name; they do not establish matching Epoch test conditions.</p>
      <p>Epoch observations keep their exact model IDs, units and conditions. Repeated runs are shown separately. Missing values are not zero. Historical AA records are opt-in.</p>
      <p>Task-cost and token-total views await additional publication permission. We do not infer token counts or benchmark duration from prices or speed.</p>
    </details>
    <section className="explorer-data" aria-label="Exact chart data"><h2>Exact data</h2><div className="exact-table-scroll"><table>
      <caption>{series.yLabel} · {series.xLabel}</caption><thead><tr><th>Model</th><th>Reasoning</th><th>{series.kind==='scatter'?series.xLabel:'Series'}</th><th>{series.yLabel}</th><th>Source</th><th>Observed</th></tr></thead>
      <tbody>{series.points.map(point=><tr key={point.id} data-active={active?.id===point.id}><th scope="row"><button type="button" onClick={()=>setPinned(point.id)}>{point.label}</button></th>
        <td>{point.reasoning}</td><td>{series.kind==='scatter'?formatChartNumber(point.x):point.series}</td><td>{formatChartNumber(point.y)} {point.unit}</td>
        <td>{point.receipt.sourceUrl?<a href={point.receipt.sourceUrl} target="_blank" rel="noreferrer">{point.receipt.source}</a>:point.receipt.source}</td>
        <td>{point.receipt.observedAt?.slice(0,10)??'Not recorded'}</td></tr>)}</tbody></table></div>
      {!series.points.length?<p>No measured rows for this selection.</p>:null}
      <noscript><p>This is the default measured selection. Interactive filters need JavaScript; the exact data and source links remain available.</p></noscript>
    </section>
    <dialog className="model-filter-dialog" ref={dialog} onCancel={()=>setFiltersOpen(false)} onClose={()=>setFiltersOpen(false)} aria-label="Models and filters">
      <button type="button" className="close-filter-dialog" onClick={()=>setFiltersOpen(false)}>Done</button><ModelSelector {...selectorProps}/></dialog>
  </section>;
}
