import {validateBenchmarkAsset} from '../../lib/compare-benchmark-asset';
import {useEffect,useMemo,useRef,useState} from 'react';
import {parseCompareState,serializeCompareState,benchmarkStartingSelection,selectVisibleRecords,selectFamily,readBenchmarkCache,AA_METRIC_LABELS,scoreMetricOptions,changeScoreMetric,type CompareState,type CompareChart} from '../../lib/compare-state';
import {buildCompareSeries,epochScoreKey,type ExplorerModel} from '../../lib/compare-series';
import {epochConditionKey,type EpochObservation} from '../../lib/epoch-observations';
import {formatChartNumber} from '../../lib/compare-geometry';
import {seriesCsv,downloadText,downloadChartPng,chartExportCaption} from '../../lib/compare-export';
import {availableCompareCharts,availableAaMetrics,buildComparePresets,COMPARE_VIEW_LABELS} from '../../lib/compare-presets';
import {expandCatalog,createMeasurementLoader,type CompareDelivery} from '../../lib/compare-delivery';
import ComparisonChart from './ComparisonChart';
import ModelSelector from './ModelSelector';
import ObservationDetails from './ObservationDetails';
export type ExplorerBenchmark={slug:string;name:string};
type Props={models:ExplorerModel[];benchmarks:ExplorerBenchmark[];defaultModelIds:string[];delivery?:CompareDelivery};
const EMPTY_OBSERVATIONS:EpochObservation[]=[];
export default function CompareExplorer({models:initialModels,benchmarks,defaultModelIds,delivery}:Props){
  const models=useMemo(()=>delivery?expandCatalog(delivery.catalog):initialModels,[delivery,initialModels]);
  const [loaded,setLoaded]=useState(()=>new Map(initialModels.map(model=>[model.id,model])));
  const loader=useMemo(()=>delivery?createMeasurementLoader(delivery.revision,models,fetch,delivery.assetBase):null,[delivery,models]);
  const [failedMeasurementIds,setFailedMeasurementIds]=useState<string[]>([]);
  const charts=useMemo(()=>delivery?.charts??availableCompareCharts(models),[delivery,models]);
  const aaMetrics=useMemo(()=>delivery?.aaMetrics??availableAaMetrics(models),[delivery,models]);
  const presets=useMemo(()=>delivery?.presets??buildComparePresets(models),[delivery,models]);
  const [presetDescription,setPresetDescription]=useState('');
  const [state,setState]=useState(()=>parseCompareState(new URLSearchParams(),models,defaultModelIds));
  const pendingBenchmarkChoice=useRef<string|null>(null);
  const [benchmarkCache,setBenchmarkCache]=useState<Record<string,EpochObservation[]>>({});
  const [loadState,setLoadState]=useState('');const [loadFailed,setLoadFailed]=useState(false);const [retryAttempt,setRetryAttempt]=useState(0);const [notice,setNotice]=useState('');
  const [hovered,setHovered]=useState<string|null>(null);const [pinned,setPinned]=useState<string|null>(null);
  const [filtersOpen,setFiltersOpen]=useState(false);const dialog=useRef<HTMLDialogElement>(null);
  const filterButton=useRef<HTMLButtonElement>(null);const svg=useRef<SVGSVGElement>(null);
  useEffect(()=>{const read=()=>{setPresetDescription('');setState(parseCompareState(new URLSearchParams(window.location.search),models,defaultModelIds));};
    read();window.addEventListener('popstate',read);return()=>window.removeEventListener('popstate',read);},[models,defaultModelIds]);
  const epochSlug=state.chart==='benchmark'&&state.metricId.startsWith('epoch_')?state.metricId.slice(6):null;
  const observations=epochSlug?readBenchmarkCache(benchmarkCache,epochSlug)??EMPTY_OBSERVATIONS:EMPTY_OBSERVATIONS;
  useEffect(()=>{
    setLoadFailed(false);
    if(!epochSlug||readBenchmarkCache(benchmarkCache,epochSlug)){setLoadState('');return;}
    if(!benchmarks.some(benchmark=>benchmark.slug===epochSlug)){setLoadState('Unknown benchmark in this link.');return;}
    const controller=new AbortController();setLoadState('Loading benchmark observations…');
    fetch((delivery?.benchmarkBase??'/api/compare-benchmarks')+'/'+encodeURIComponent(epochSlug)+'.json',{signal:controller.signal})
      .then(response=>{if(!response.ok)throw new Error('unavailable');return response.json();})
      .then(payload=>{const verified=validateBenchmarkAsset(payload,epochSlug);
        setBenchmarkCache(previous=>({...previous,[epochSlug]:verified}));setLoadState('');
        if(pendingBenchmarkChoice.current===epochSlug){pendingBenchmarkChoice.current=null;setState(previous=>{if(previous.metricId!=='epoch_'+epochSlug)return previous;const next={...previous,...benchmarkStartingSelection(models,verified),missingModelIds:[]};const url=new URL(window.location.href);url.search=serializeCompareState(next).toString();window.history.replaceState(null,'',url);return next;});}})
      .catch(error=>{if(error.name!=='AbortError'){setLoadFailed(true);setLoadState('Benchmark data could not load. The other views still work.');}});
    return()=>controller.abort();
  },[epochSlug,benchmarkCache,benchmarks,retryAttempt,delivery?.benchmarkBase]);
  useEffect(()=>{if(filtersOpen&&!dialog.current?.open)dialog.current?.showModal();
    if(!filtersOpen&&dialog.current?.open){dialog.current.close();filterButton.current?.focus();}},[filtersOpen]);
  const unresolvedIds=state.modelIds.filter(id=>!loaded.has(id)&&models.find(model=>model.id===id)?.detailAvailable);
  const pendingIds=unresolvedIds.filter(id=>!failedMeasurementIds.includes(id));
  const failedSelectedIds=unresolvedIds.filter(id=>failedMeasurementIds.includes(id));
  const pendingKey=pendingIds.slice().sort().join('\n');
  const measurementStatus=pendingIds.length?'Loading selected measurements…':failedSelectedIds.length?'Some measurements could not load. Retry, or reload for the latest data.':'';
  useEffect(()=>{
    if(!loader||!pendingKey)return;
    let cancelled=false;const ids=pendingKey.split('\n');
    loader.loadPartial(ids).then(({records,failedIds})=>{if(cancelled)return;
      setLoaded(previous=>new Map([...previous,...records.map(model=>[model.id,model] as const)]));
      const recovered=new Set(records.map(model=>model.id));
      setFailedMeasurementIds(previous=>[...new Set([...previous.filter(id=>!recovered.has(id)),...failedIds])]);
    }).catch(()=>{if(!cancelled)setFailedMeasurementIds(previous=>[...new Set([...previous,...ids])]);});
    return()=>{cancelled=true;};
  },[loader,pendingKey]);
  const measuredModels=useMemo(()=>models.filter(model=>!delivery||!model.detailAvailable||loaded.has(model.id)).map(model=>loaded.get(model.id)??model),[models,loaded,delivery]);
  const series=useMemo(()=>buildCompareSeries({models:measuredModels,observations},state),[measuredModels,observations,state]);
  const active=series.points.find(point=>point.id===(pinned??hovered))??null;
  const visibleModels=models;
  const conditions=useMemo(()=>[...new Set(observations.map(row=>epochConditionKey(row.conditions)))].sort(),[observations]);
  const scoreMetrics=useMemo(()=>[...new Set(observations.map(epochScoreKey))].sort(),[observations]);
  const scoreOptions=scoreMetricOptions(scoreMetrics,state.scoreMetricKey);
  const unverifiedMembership=visibleModels.some(model=>model.source==='aa'&&model.current===null);
  const update=(patch:Partial<CompareState>)=>{setPresetDescription('');const next={...state,...patch};setState(next);setPinned(null);setHovered(null);
    const url=new URL(window.location.href);url.search=serializeCompareState(next).toString();window.history.pushState(null,'',url);};
  const toggle=(id:string)=>update({modelIds:state.modelIds.includes(id)?state.modelIds.filter(value=>value!==id):[...state.modelIds,id].slice(0,100)});
  const reset=()=>update(parseCompareState(new URLSearchParams(),models,defaultModelIds));
  const selectorProps={models:visibleModels,selected:state.modelIds,includeHistory:state.includeHistory,onToggle:toggle,
    onFamily:(family:string,checked:boolean)=>update({modelIds:selectFamily(state.modelIds,visibleModels,family,checked,state.includeHistory)}),
    onGroup:(ids:string[],checked:boolean)=>update({modelIds:selectVisibleRecords(state.modelIds,ids,checked)}),
    onHistory:(includeHistory:boolean)=>update({includeHistory}),reasoningEfforts:state.reasoningEfforts,
    onReasoning:(value:string)=>update({reasoningEfforts:value==='all'?[]:state.reasoningEfforts.includes(value)
      ?state.reasoningEfforts.filter(reason=>reason!==value):[...state.reasoningEfforts,value]}),onClear:()=>update({modelIds:[]}),onReset:reset};
  const chooseMeasured=()=>update(benchmarkStartingSelection(visibleModels,observations.filter(row=>!state.conditionKey||epochConditionKey(row.conditions)===state.conditionKey),state.scoreMetricKey));
  const chooseBenchmark=(metricId:string)=>{const slug=metricId.startsWith('epoch_')?metricId.slice(6):null;const rows=slug?readBenchmarkCache(benchmarkCache,slug):null;pendingBenchmarkChoice.current=rows?null:slug;update({metricId,conditionKey:null,scoreMetricKey:null,...(rows?{...benchmarkStartingSelection(models,rows),missingModelIds:[]}: {})});};
  const share=async()=>{try{const url=new URL(window.location.href);url.search=serializeCompareState(state).toString();
    await navigator.clipboard.writeText(url.href);setNotice('Comparison link copied.');}catch{setNotice('Copy the address bar to share this comparison.');}};
  const metricName=state.chart==='benchmark'?(epochSlug?benchmarks.find(item=>item.slug===epochSlug)?.name??state.metricId:
    AA_METRIC_LABELS[state.metricId]??state.metricId)+(state.scoreMetricKey?' · '+JSON.parse(state.scoreMetricKey).join(' · '):''):COMPARE_VIEW_LABELS.find(item=>item.id===state.chart)?.label??state.chart;
  const exportPng=async()=>{if(!svg.current)return;try{await downloadChartPng(svg.current,chartExportCaption(series.points,metricName));}
    catch{setNotice('Image export is unavailable in this browser. CSV export is still available.');}};
  return <section className="compare-explorer" aria-label="Model comparison explorer">
    <div className="explorer-title"><h1>Compare models</h1><button type="button" className="mobile-filter-button" ref={filterButton} onClick={()=>setFiltersOpen(true)}>Choose models ({state.modelIds.length})</button></div>
    <label className="mobile-chart-choice">Compare by<select value={charts.some(chart=>chart.id===state.chart)?state.chart:''} onChange={event=>update({chart:event.target.value as CompareChart})}>{!charts.some(chart=>chart.id===state.chart)?<option value="">Choose a chart</option>:null}{charts.map(chart=><option key={chart.id} value={chart.id}>{chart.label}</option>)}</select></label>
    <nav className="chart-tabs" aria-label="Chart type">{charts.map(chart=><button type="button" key={chart.id}
      aria-pressed={state.chart===chart.id} onClick={()=>update({chart:chart.id})}>{chart.label}</button>)}</nav>
    <div className="compare-presets" aria-label="Starting selections"><span>Start with</span>{presets.map(preset=><button type="button" key={preset.id} onClick={()=>{
      update({modelIds:preset.modelIds,missingModelIds:[],chart:preset.chart,metricId:preset.metricId,includeHistory:false,reasoningEfforts:[],conditionKey:null,scoreMetricKey:null});
      setPresetDescription(preset.description);
    }}>{preset.label}</button>)}</div>
    {presetDescription?<p className="preset-criteria" role="status">{presetDescription}</p>:null}
    {!charts.some(chart=>chart.id===state.chart)?<p className="explorer-warning">This saved view has no recorded data. Choose another chart.</p>:null}
    <div className="explorer-workspace"><div className="chart-panel">
      <div className="chart-toolbar">
        {state.chart==='benchmark'?<label>Benchmark<select value={epochSlug||aaMetrics.some(([key])=>key===state.metricId)?state.metricId:''} onChange={event=>chooseBenchmark(event.target.value)}>
          {!epochSlug&&!aaMetrics.some(([key])=>key===state.metricId)?<option value="">Choose a benchmark</option>:null}<optgroup label="Artificial Analysis">{aaMetrics.map(([key,label])=><option key={key} value={key}>{label}</option>)}</optgroup>
          <optgroup label="Benchmark publishers">{benchmarks.map(benchmark=><option key={benchmark.slug} value={'epoch_'+benchmark.slug}>{benchmark.name}</option>)}</optgroup></select></label>:null}
        {epochSlug&&scoreOptions.visible?<label>Score metric<select value={state.scoreMetricKey??''} onChange={event=>update({...changeScoreMetric(event.target.value),...benchmarkStartingSelection(models,observations,event.target.value||null)})}>
          <option value="">Choose a score metric</option>{scoreOptions.missing?<option value={state.scoreMetricKey!}>Unavailable saved metric</option>:null}{scoreMetrics.map(key=><option key={key} value={key}>{JSON.parse(key).join(' · ')}</option>)}</select></label>:null}
        {epochSlug&&conditions.length?<label>Conditions<select value={state.conditionKey??''} onChange={event=>update({conditionKey:event.target.value||null})}>
          <option value="">All recorded runs</option>{conditions.map(key=><option value={key} key={key}>{key==='unknown'?'Not recorded':JSON.parse(key).map(([name,value]:[string,unknown])=>name+': '+value).join(' · ')}</option>)}</select></label>:null}
        <details className="chart-options"><summary>Chart options</summary><div className="chart-options-content"><div className="scale-buttons" aria-label="Axis scale"><button type="button" aria-pressed={state.scale==='linear'} onClick={()=>update({scale:'linear'})}>Linear</button>
          <button type="button" aria-pressed={state.scale==='log'} onClick={()=>update({scale:'log'})}>Log</button></div>
        <label className="toolbar-check"><input type="checkbox" checked={state.labels} onChange={event=>update({labels:event.target.checked})}/>Labels</label>
        {series.kind==='scatter'?<label className="toolbar-check"><input type="checkbox" checked={state.frontier} onChange={event=>update({frontier:event.target.checked})}/>Frontier</label>:null}
        </div></details>
        <button type="button" onClick={share}>Share</button>
        <details className="export-menu"><summary>Export</summary><div><button type="button" disabled={!series.points.length||unresolvedIds.length>0} onClick={()=>downloadText(seriesCsv(series.points,{includeX:series.kind==='scatter',xLabel:series.xLabel,yLabel:series.yLabel,metricId:state.chart==='benchmark'?state.metricId:state.chart,metricName}),'ai-stats-comparison.csv')}>CSV with sources</button>
          <button type="button" disabled={!series.points.length||unresolvedIds.length>0} onClick={exportPng}>PNG chart</button></div></details>
      </div>
      {state.missingModelIds.length?<p className="explorer-warning">Unavailable models in this link: {state.missingModelIds.join(', ')}</p>:null}
      {measurementStatus?<p className="explorer-warning" role="status">{measurementStatus}</p>:null}
      {failedSelectedIds.length?<button type="button" onClick={()=>setFailedMeasurementIds(previous=>previous.filter(id=>!state.modelIds.includes(id)))}>Retry measurements</button>:null}
      {loadState?<p className="explorer-warning" role="status">{loadState}</p>:null}
      {epochSlug&&scoreOptions.missing&&observations.length?<p className="explorer-warning">The saved score metric is no longer available. Choose a recorded score metric above.</p>:null}
      {loadFailed?<button type="button" onClick={()=>setRetryAttempt(value=>value+1)}>Retry benchmark</button>:null}
      {unverifiedMembership?<p className="explorer-warning">Current AA membership could not be verified. Records labelled Membership unverified may include retired models.</p>:null}
      {series.scaleNotice?<p className="explorer-warning">{series.scaleNotice}</p>:null}
      {series.mixedConditions?<p className="explorer-warning">These runs used different test settings. Choose conditions for a like-for-like view.</p>:null}
      {epochSlug&&!series.points.length&&observations.length?<button className="choose-measured" type="button" onClick={chooseMeasured}>Select measured models</button>:null}
      <ComparisonChart series={series} labels={state.labels} activeId={active?.id??null} onPreview={setHovered}
        onPin={id=>setPinned(pinned===id?null:id)} svgRef={svg}/>
      <ObservationDetails series={series} point={active} pinned={Boolean(pinned)} onPin={()=>setPinned(pinned?null:active?.id??null)} onClose={()=>{setPinned(null);setHovered(null);}}/>
    </div><aside className="desktop-model-selector" aria-label="Model selection"><ModelSelector {...selectorProps}/></aside></div>
    <div className="source-strip"><span>{visibleModels.filter(model=>state.modelIds.includes(model.id)).length} selected · {series.points.length} plotted observations</span>
      <span>{[...new Set(series.points.map(point=>point.receipt.source))].join(' · ')||'No measurements selected'}</span>
      {series.excluded.length?<details><summary>{series.excluded.length} excluded</summary><ul>{series.excluded.map((item,index)=><li key={item.modelId+index}>
        {models.find(model=>model.id===item.modelId)?.name??item.modelId}: {item.reason}</li>)}</ul></details>:null}</div>
    <p className="share-notice" role="status">{notice}</p>
    <details className="explorer-methodology"><summary>Sources and calculations</summary>
      <p>Blended prices use three input tokens for each output token. Evaluation costs are Artificial Analysis’s reported spending on each evaluation.</p>
      <p>Frontiers compare models using the same AA index version and timing settings. Epoch results retain their benchmark and test settings.</p>
      <p>Historical AA results are off by default. Select a point to see its source and date.</p>
    </details>
    <details className="explorer-data"><summary>Exact chart data ({series.points.length} observations)</summary><div className="exact-table-scroll"><table>
      <caption>{series.yLabel} · {series.xLabel}</caption><thead><tr><th>Model</th><th>Reasoning</th><th>{series.kind==='scatter'?series.xLabel:'Series'}</th><th>{series.yLabel}</th>{epochSlug?<th>Conditions</th>:null}<th>Source</th><th>Observed</th></tr></thead>
      <tbody>{series.points.map(point=><tr key={point.id} data-active={active?.id===point.id}><th scope="row"><button type="button" onClick={()=>setPinned(point.id)}>{point.label}</button></th>
        <td>{point.reasoning}</td><td>{series.kind==='scatter'?formatChartNumber(point.x):point.series}</td><td>{formatChartNumber(point.y)} {point.unit}</td>
        {epochSlug?<td>{point.receipt.conditions?Object.entries(point.receipt.conditions).map(([key,value])=>key+': '+value).join(' · '):'Not recorded'}</td>:null}
        <td>{point.receipt.sourceUrl?<a href={point.receipt.sourceUrl} target="_blank" rel="noreferrer">{point.receipt.source}</a>:point.receipt.source}</td>
        <td>{point.receipt.observedAt?.slice(0,10)??'Not recorded'}</td></tr>)}</tbody></table></div>
      {!series.points.length?<p>No measured rows for this selection.</p>:null}
      <noscript><p>This is the default measured selection. Interactive filters need JavaScript; the exact data and source links remain available.</p></noscript>
    </details>
    <dialog className="model-filter-dialog" ref={dialog} onCancel={()=>setFiltersOpen(false)} onClose={()=>setFiltersOpen(false)} aria-label="Models and filters">
      <button type="button" className="close-filter-dialog" onClick={()=>setFiltersOpen(false)}>Done</button><ModelSelector {...selectorProps}/></dialog>
  </section>;
}
