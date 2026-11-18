import {benchmarkConditionOptions} from '../../lib/benchmark-condition-options';
import {comparisonParams} from '../../lib/compare-navigation';
import {displayedComparisonPoints} from '../../lib/compare-displayed-points';
import {validateBenchmarkAsset} from '../../lib/compare-benchmark-asset';
import {useEffect,useMemo,useRef,useState} from 'react';
import {parseCompareState,hasExplicitCompareSelection,usesSuggestedCompareSelection,benchmarkStartingSelection,readBenchmarkCache,AA_METRIC_LABELS,scoreMetricOptions,changeScoreMetric,type CompareState,type CompareChart} from '../../lib/compare-state';
import {buildCompareSeries,epochScoreKey,combinedLogOmissions,logOmissionHeading,plottableSeriesPoints,type ExplorerModel} from '../../lib/compare-series';
import {epochConditionKey,type EpochObservation} from '../../lib/epoch-observations';
import {formatChartNumber} from '../../lib/compare-geometry';
import {seriesCsv,downloadText,downloadChartPng,downloadChartSvg,copyChartSvg,chartOnlyUrl,chartExportCaption} from '../../lib/compare-export';
import {availableCompareCharts,availableAaMetrics,selectAaBenchmarkModels,buildComparePresets,canonicalChartMenu,COMPARE_VIEW_LABELS} from '../../lib/compare-presets';
import {expandCatalog,createMeasurementLoader,type CompareDelivery} from '../../lib/compare-delivery';
import {toggleCompareFamilySelection,type FamilyBrowseSort} from '../../lib/compare-families';
import {browseRankingFor} from '../../lib/compare-browse-rank';
import {frontierReferenceDisplayCount,shouldShowFrontierReference} from '../../lib/compare-frontier-reference';
import {expandSelectionToFamilies} from '../../lib/compare-family-lines';
import {parseViewOptions,writeViewOptions,DEFAULT_VIEW_OPTIONS,type CompareViewOptions} from '../../lib/compare-view-options';
import {blendAxis,matchScores,parseScoreCsv,BLEND_MEASURES} from '../../lib/compare-custom-axis';
import {bestUnderBudget,dominators,newestDate,releasedBy,releaseMonths,stalenessTier} from '../../lib/chart-overlays';
import {isAutomaticCandidate} from '../../lib/automatic-selection';
import type {PlotZoom} from '../../lib/compare-geometry';
import type {CompareCustomAxis} from '../../lib/compare-series';
import {benchmarkPath} from '../../lib/site-routes';
import ChartLayers,{type ScoreFileState} from './ChartLayers';
import CompareTable from './CompareTable';
import PinnedPair from './PinnedPair';
import ComparisonChart from './ComparisonChart';
import ModelSelector from './ModelSelector';
import ObservationDetails from './ObservationDetails';
export type ExplorerBenchmark={slug:string;name:string};
type Props={models:ExplorerModel[];benchmarks:ExplorerBenchmark[];defaultModelIds:string[];delivery?:CompareDelivery};
const EMPTY_OBSERVATIONS:EpochObservation[]=[];
const EMPTY_SUGGESTED_IDS:string[]=[];
const SCATTER_CHARTS:CompareChart[]=['task-cost','cost-intelligence','speed-intelligence','total-cost'];
const VIEW_NOTES:Partial<Record<CompareChart,string>>={
  'task-cost':'Intelligence Index against the measured cost of one index task. A line joins the reasoning levels of one model.',
  'cost-intelligence':'Intelligence Index against blended token price, three input tokens to one output token.',
  'speed-intelligence':'Intelligence Index against median output speed. Further right is faster.',
  'total-cost':'Intelligence Index against the cost of running the complete evaluation.',
  price:'Input and output prices per million tokens, as each source lists them.',
  benchmark:'One benchmark at a time, on its publisher’s own scale.',
};
export default function CompareExplorer({models:initialModels,benchmarks,defaultModelIds,delivery}:Props){
  const models=useMemo(()=>delivery?expandCatalog(delivery.catalog):initialModels,[delivery,initialModels]);
  const [loaded,setLoaded]=useState(()=>new Map(initialModels.map(model=>[model.id,model])));
  const loader=useMemo(()=>delivery?createMeasurementLoader(delivery.revision,models,fetch,delivery.assetBase):null,[delivery,models]);
  const [failedMeasurementIds,setFailedMeasurementIds]=useState<string[]>([]);
  const charts=useMemo(()=>canonicalChartMenu((delivery?.charts??availableCompareCharts(models)).map(chart=>chart.id)),[delivery,models]);
  const presets=useMemo(()=>delivery?.presets??buildComparePresets(models),[delivery,models]);
  const [presetDescription,setPresetDescription]=useState('');
  const defaultChart=charts.some(chart=>chart.id==='task-cost')?'task-cost':'cost-intelligence';
  // Scatter views open on the Pareto line plus every reasoning level of the families on it.
  const suggestedFor=(chart:CompareChart)=>{const ids=delivery?.suggestedModelIds?.[chart];return ids&&SCATTER_CHARTS.includes(chart)?expandSelectionToFamilies(models,ids):ids;};
  const defaultIdsFor=(chart:CompareChart,metric:string,history:boolean)=>chart==='benchmark'?delivery?.aaBenchmarkSelections?.[metric]?.[history?'historical':'current']??defaultModelIds:suggestedFor(chart)??defaultModelIds;
  // Keep server render and hydration byte-for-byte aligned; saved URL state is
  // applied by the mount effect below after React hydrates this default tree.
  const [state,setState]=useState(()=>parseCompareState(new URLSearchParams(),models,defaultModelIds,defaultChart));
  const pendingBenchmarkChoice=useRef<string|null>(null);
  const aaMetrics=useMemo(()=>delivery?.aaBenchmarkSelections?Object.entries(delivery.aaBenchmarkSelections).filter(([,groups])=>(state.includeHistory?groups.historical:groups.current).length).map(([key])=>[key,AA_METRIC_LABELS[key]] as [string,string]):delivery?.aaMetrics??availableAaMetrics(models,state.includeHistory),[delivery,models,state.includeHistory]);
  const [benchmarkCache,setBenchmarkCache]=useState<Record<string,EpochObservation[]>>({});
  const [loadState,setLoadState]=useState('');const [loadFailed,setLoadFailed]=useState(false);const [retryAttempt,setRetryAttempt]=useState(0);const [notice,setNotice]=useState('');
  const [hovered,setHovered]=useState<string|null>(null);const [pinned,setPinned]=useState<string|null>(null);
  // Display layers: shareable through the link, but never part of the selection or the data.
  const [options,setOptions]=useState<CompareViewOptions>(DEFAULT_VIEW_OPTIONS);
  const optionsRef=useRef(options);optionsRef.current=options;
  const [embed,setEmbed]=useState(false);const embedRef=useRef(false);
  const [zoom,setZoom]=useState<PlotZoom|null>(null);const [solo,setSolo]=useState<string|null>(null);
  const [compareId,setCompareId]=useState<string|null>(null);const [armed,setArmed]=useState(false);
  const [scores,setScores]=useState<{axis:CompareCustomAxis;file:ScoreFileState}|null>(null);
  const [playing,setPlaying]=useState(false);const monthsRef=useRef<string[]>([]);
  const root=useRef<HTMLElement>(null);const detailsRef=useRef<HTMLDivElement>(null);
  const [filtersOpen,setFiltersOpen]=useState(false);const dialog=useRef<HTMLDialogElement>(null);
  const filterButton=useRef<HTMLButtonElement>(null);const svg=useRef<SVGSVGElement>(null);
  const customSelection=useRef(false);
  useEffect(()=>{const read=()=>{pendingBenchmarkChoice.current=null;setPresetDescription('');const params=new URLSearchParams(window.location.search),auto=usesSuggestedCompareSelection(params);if(params.get('auto')==='1'){params.delete('m');params.delete('models');}const defaults=auto?defaultIdsFor((params.get('chart') as CompareChart|null)??defaultChart,params.get('metric')??'aa_intelligence_index',params.get('history')==='1'):defaultModelIds;customSelection.current=hasExplicitCompareSelection(new URLSearchParams(window.location.search))&&!auto;if(auto&&params.get('chart')==='benchmark'&&params.get('metric')?.startsWith('epoch_'))pendingBenchmarkChoice.current=params.get('metric')!.slice(6);setState(parseCompareState(params,models,defaults,defaultChart));
      const viewOptions=parseViewOptions(params);optionsRef.current=viewOptions;setOptions(viewOptions);embedRef.current=params.get('embed')==='1';setEmbed(embedRef.current);setZoom(null);setSolo(null);setCompareId(null);setArmed(false);setPlaying(false);};
    read();window.addEventListener('popstate',read);return()=>window.removeEventListener('popstate',read);},[models,defaultModelIds,defaultChart]);
  const epochSlug=state.chart==='benchmark'&&state.metricId.startsWith('epoch_')?state.metricId.slice(6):null;
  const observations=epochSlug?readBenchmarkCache(benchmarkCache,epochSlug)??EMPTY_OBSERVATIONS:EMPTY_OBSERVATIONS;
  useEffect(()=>{
    setLoadFailed(false);
    if(!epochSlug){setLoadState('');return;}
    const selectPending=(verified:typeof observations)=>{if(pendingBenchmarkChoice.current===epochSlug){pendingBenchmarkChoice.current=null;customSelection.current=false;setState(previous=>{if(previous.metricId!=='epoch_'+epochSlug)return previous;const next={...previous,...benchmarkStartingSelection(models,verified.filter(row=>!previous.conditionKey||epochConditionKey(row.conditions)===previous.conditionKey),previous.scoreMetricKey),missingModelIds:[]};const url=new URL(window.location.href);url.search=comparisonParams(next,true).toString();window.history.replaceState(null,'',url);return next;});}};
    const cached=readBenchmarkCache(benchmarkCache,epochSlug);
    if(cached){setLoadState('');selectPending(cached);return;}
    if(!benchmarks.some(benchmark=>benchmark.slug===epochSlug)){setLoadState('Unknown benchmark in this link.');return;}
    const controller=new AbortController();setLoadState('Loading benchmark observations…');
    fetch((delivery?.benchmarkBase??'/api/compare-benchmarks')+'/'+encodeURIComponent(epochSlug)+'.json',{signal:controller.signal})
      .then(response=>{if(!response.ok)throw new Error('unavailable');return response.json();})
      .then(payload=>{const verified=validateBenchmarkAsset(payload,epochSlug);
        setBenchmarkCache(previous=>({...previous,[epochSlug]:verified}));setLoadState('');
        selectPending(verified);})
      .catch(error=>{if(error.name!=='AbortError'){setLoadFailed(true);setLoadState('Benchmark data could not load. The other views still work.');}});
    return()=>controller.abort();
  },[epochSlug,benchmarkCache,benchmarks,retryAttempt,delivery?.benchmarkBase]);
  useEffect(()=>{if(filtersOpen&&!dialog.current?.open)dialog.current?.showModal();
    if(filtersOpen)dialog.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    if(!filtersOpen&&dialog.current?.open){dialog.current.close();filterButton.current?.focus();}},[filtersOpen]);
  const scatterView=SCATTER_CHARTS.includes(state.chart);
  const frontierReferenceIds=customSelection.current&&scatterView?delivery?.suggestedModelIds?.[state.chart]??EMPTY_SUGGESTED_IDS:EMPTY_SUGGESTED_IDS;
  const frontierCoverage=delivery?.suggestionFrontierCounts?.[state.chart];
  const unresolvedIds=state.modelIds.filter(id=>!loaded.has(id)&&models.find(model=>model.id===id)?.detailAvailable);
  const frontierUnresolvedIds=frontierReferenceIds.filter(id=>!state.modelIds.includes(id)&&!loaded.has(id)&&models.find(model=>model.id===id)?.detailAvailable);
  // The timeline replays every current AA record, so it needs measurements beyond the selection.
  const timelineRequested=scatterView&&options.asOf!==null;
  const timelinePoolIds=useMemo(()=>timelineRequested?models.filter(model=>model.source==='aa'&&model.current===true&&model.detailAvailable!==false).map(model=>model.id):EMPTY_SUGGESTED_IDS,[models,timelineRequested]);
  const timelineUnresolvedIds=timelinePoolIds.filter(id=>!loaded.has(id));
  const pendingIds=[...new Set([...unresolvedIds,...frontierUnresolvedIds,...timelineUnresolvedIds])].filter(id=>!failedMeasurementIds.includes(id));
  const failedSelectedIds=unresolvedIds.filter(id=>failedMeasurementIds.includes(id));
  const pendingKey=pendingIds.slice().sort().join('\n');
  const failedReferenceIds=frontierUnresolvedIds.filter(id=>failedMeasurementIds.includes(id));
  const measurementStatus=pendingIds.length?'Loading comparison measurements…':failedSelectedIds.length?'Some selected measurements could not load. Retry, or reload for the latest data.':failedReferenceIds.length?'The current Pareto line reference could not be fully loaded.':'';
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
  const timelinePool=useMemo(()=>{
    if(!timelineRequested)return {models:[] as ExplorerModel[],undated:0,version:null as string|null};
    const pool=new Set(timelinePoolIds);
    const eligible=measuredModels.filter(model=>pool.has(model.id)&&isAutomaticCandidate(model)&&typeof model.intelligence==='number'&&model.indexVersion);
    // One index version only, so the replay follows a single comparable Pareto line.
    const version=eligible.map(model=>model.indexVersion!).sort((a,b)=>a.localeCompare(b,'en',{numeric:true})).at(-1)??null;
    const cohort=eligible.filter(model=>model.indexVersion===version);
    return {models:cohort.filter(model=>model.releaseDate),undated:cohort.filter(model=>!model.releaseDate).length,version};
  },[timelineRequested,timelinePoolIds,measuredModels]);
  const months=useMemo(()=>releaseMonths(timelinePool.models.map(model=>model.releaseDate)),[timelinePool]);
  monthsRef.current=months;
  const timelineOn=timelineRequested&&months.length>1;
  const asOfMonth=timelineOn?(months.includes(options.asOf!)?options.asOf!:months[months.length-1]):null;
  const effectiveState=useMemo(()=>timelineOn?{...state,includeHistory:false,frontier:true,modelIds:timelinePool.models.filter(model=>releasedBy(model.releaseDate,asOfMonth!)).map(model=>model.id)}:state,
    [state,timelineOn,timelinePool,asOfMonth]);
  const shownIds=useMemo(()=>new Set(effectiveState.modelIds),[effectiveState]);
  // A visitor's own vertical axis: their weighting, or their scores. Weights win when both are set.
  const blend=useMemo(()=>{
    if(!scatterView||!options.weights)return null;
    // The timeline rescales across every record it will ever show, so points hold still from month to month.
    const scope=timelineOn?timelinePool.models:measuredModels.filter(model=>shownIds.has(model.id)&&model.source==='aa'&&(effectiveState.includeHistory||model.current!==false));
    // Scores from different index versions are not on one scale, so only the newest version shown is blended.
    const version=scope.map(model=>model.indexVersion).filter((value):value is string=>Boolean(value)).sort((a,b)=>a.localeCompare(b,'en',{numeric:true})).at(-1);
    const comparable=scope.filter(model=>model.indexVersion===version);
    const axis=blendAxis(comparable,options.weights);
    return {...axis,missing:axis.missing+(scope.length-comparable.length)};
  },[scatterView,options.weights,measuredModels,shownIds,effectiveState.includeHistory,timelineOn,timelinePool]);
  const blendAvailable=useMemo(()=>new Set(BLEND_MEASURES.filter(measure=>measuredModels.some(model=>shownIds.has(model.id)&&typeof measure.read(model)==='number')).map(measure=>measure.key)),[measuredModels,shownIds]);
  const customY=scatterView?blend??scores?.axis??null:null;
  const seriesOptions=useMemo(()=>({workload:options.workload,customY}),[options.workload,customY]);
  const series=useMemo(()=>buildCompareSeries({models:measuredModels,observations},effectiveState,seriesOptions),[measuredModels,observations,effectiveState,seriesOptions]);
  // Everything the replay will ever show, so the axes hold still and today's Pareto line stays in view.
  const timelineToday=useMemo(()=>timelineOn?buildCompareSeries({models:measuredModels,observations},{...effectiveState,modelIds:timelinePool.models.map(model=>model.id)},seriesOptions):null,
    [timelineOn,measuredModels,observations,effectiveState,timelinePool,seriesOptions]);
  const ghostLine=useMemo(()=>{if(!timelineToday)return undefined;const ids=new Set(Object.values(timelineToday.frontierGroups).flat());
    return timelineToday.points.filter(point=>ids.has(point.id)).sort((a,b)=>a.x-b.x).map(point=>({x:point.x,y:point.y}));},[timelineToday]);
  // Menus are native <details>. Escape and a press outside close them; with none open, Escape releases a pinned point.
  useEffect(()=>{
    const menus=()=>[...(root.current?.querySelectorAll<HTMLDetailsElement>('details.export-menu[open],details.axis-menu[open],details.family-filter-options[open],details.rail-presets[open]')??[])];
    const onKey=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      const open=menus();
      if(open.length){open.forEach(menu=>{menu.open=false;menu.querySelector('summary')?.focus();});return;}
      if(dialog.current?.open)return;
      setPinned(null);setCompareId(null);setArmed(false);setSolo(null);
    };
    const onPress=(event:PointerEvent)=>{for(const menu of menus())if(!(event.target instanceof Node)||!menu.contains(event.target))menu.open=false;};
    document.addEventListener('keydown',onKey);document.addEventListener('pointerdown',onPress);
    return()=>{document.removeEventListener('keydown',onKey);document.removeEventListener('pointerdown',onPress);};
  },[]);
  // On a phone the record opens below the fold, so bring it into view when a point is pinned.
  useEffect(()=>{
    if(!pinned||window.innerWidth>900)return;
    detailsRef.current?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  },[pinned,compareId]);
  useEffect(()=>{
    if(!playing)return;
    const timer=window.setInterval(()=>{
      const all=monthsRef.current,index=all.indexOf(optionsRef.current.asOf??'');
      if(index<0||index>=all.length-1){setPlaying(false);return;}
      const next={...optionsRef.current,asOf:all[index+1]};optionsRef.current=next;setOptions(next);setPinned(null);setHovered(null);
      const url=new URL(window.location.href);url.search=writeViewOptions(new URLSearchParams(url.search),next).toString();window.history.replaceState(null,'',url);
    },750);
    return()=>window.clearInterval(timer);
  },[playing]);
  const suggestedIdsForChart=delivery?.suggestedModelIds?.[state.chart]??EMPTY_SUGGESTED_IDS;
  const frontierDisplayCount=frontierReferenceDisplayCount({scatterView,customSelection:customSelection.current,suggestedIds:suggestedIdsForChart,frontierReferenceIds});
  const referenceFrontier=useMemo(()=>!timelineOn&&shouldShowFrontierReference(state.frontier,frontierReferenceIds)?buildCompareSeries({models:measuredModels,observations},{...state,modelIds:frontierReferenceIds,reasoningEfforts:[],frontier:true},seriesOptions):null,[measuredModels,observations,state,frontierReferenceIds,timelineOn,seriesOptions]);
  const displayedScale=series.scale;
  // One de-duplicated, named list of what Log cannot draw: selected records first, then
  // reference-frontier records that are not already part of the selection.
  const logNotice=useMemo(()=>combinedLogOmissions(series,referenceFrontier),[series,referenceFrontier]);
  const displayed=useMemo(()=>displayedComparisonPoints(series,referenceFrontier),[series,referenceFrontier]);
  const active=displayed.points.find(point=>point.id===(pinned??hovered))??null;
  const visibleModels=models;
  const conditions=useMemo(()=>benchmarkConditionOptions(observations,state.scoreMetricKey),[observations,state.scoreMetricKey]);
  const scoreMetrics=useMemo(()=>[...new Set(observations.map(epochScoreKey))].sort(),[observations]);
  const scoreOptions=scoreMetricOptions(scoreMetrics,state.scoreMetricKey);
  const unverifiedMembership=visibleModels.some(model=>model.source==='aa'&&model.current===null);
  const linkParams=(next:CompareState,automatic:boolean)=>{const params=writeViewOptions(comparisonParams(next,automatic),optionsRef.current);if(embedRef.current)params.set('embed','1');return params;};
  const updateOptions=(patch:Partial<CompareViewOptions>)=>{
    const next={...optionsRef.current,...patch};
    // Costing a workload changes the horizontal axis from dollars per million tokens to dollars per month.
    if(Object.hasOwn(patch,'workload')&&Boolean(patch.workload)!==Boolean(optionsRef.current.workload))next.budget=null;
    optionsRef.current=next;setOptions(next);
    if(['asOf','workload','weights','view'].some(key=>Object.hasOwn(patch,key)))setZoom(null);
    if(Object.hasOwn(patch,'asOf')){setPinned(null);setHovered(null);setCompareId(null);if(patch.asOf===null)setPlaying(false);}
    // Replace rather than push: dragging the budget or playing the timeline must not flood the history.
    const url=new URL(window.location.href);url.search=writeViewOptions(new URLSearchParams(url.search),next).toString();window.history.replaceState(null,'',url);
  };
  const update=(patch:Partial<CompareState>,automatic=false)=>{
    // A budget is a number in the horizontal axis's unit. A different view means a different unit, so it cannot carry over.
    if(patch.chart&&patch.chart!==state.chart&&optionsRef.current.budget!==null){const cleared={...optionsRef.current,budget:null};optionsRef.current=cleared;setOptions(cleared);}if(Object.hasOwn(patch,'modelIds'))customSelection.current=!automatic;if(['modelIds','metricId','scoreMetricKey','conditionKey','chart','includeHistory'].some(key=>Object.hasOwn(patch,key)))pendingBenchmarkChoice.current=null;setPresetDescription('');const next={...state,...patch,...(patch.chart&&patch.chart!==state.chart&&['price','benchmark'].includes(patch.chart)&&patch.scale===undefined?{scale:'linear' as const}:{})};setState(next);setPinned(null);setHovered(null);
    const keepAutomatic=automatic||(!Object.hasOwn(patch,'modelIds')&&!customSelection.current);const url=new URL(window.location.href);url.search=linkParams(next,keepAutomatic).toString();window.history.pushState(null,'',url);setZoom(null);setCompareId(null);setArmed(false);if(Object.hasOwn(patch,'chart')||Object.hasOwn(patch,'modelIds'))setSolo(null);};
  const toggle=(id:string)=>update({modelIds:state.modelIds.includes(id)?state.modelIds.filter(value=>value!==id):[...state.modelIds,id].slice(0,100)});
  const chooseSuggested=(chart:CompareChart)=>{
    const ids=chart==='benchmark'?(epochSlug?benchmarkStartingSelection(models,observations,state.scoreMetricKey).modelIds:
      delivery?.aaBenchmarkSelections?.[state.metricId]?.[state.includeHistory?'historical':'current']??selectAaBenchmarkModels(measuredModels,state.metricId,8,state.includeHistory)):
      suggestedFor(chart);
    if(ids){update({chart,modelIds:ids,missingModelIds:[]},true);setPresetDescription(SCATTER_CHARTS.includes(chart)?'Automatic selection: every reasoning level of the models on the Pareto line. Known free models are excluded.':'Automatic selection for this view. Known free models are excluded.');}
  };
  const changeChart=(chart:CompareChart)=>{if(customSelection.current){update({chart});return;}if(chart==='benchmark'){const metric='aa_intelligence_index';const ids=delivery?.aaBenchmarkSelections?.[metric]?.[state.includeHistory?'historical':'current']??selectAaBenchmarkModels(measuredModels,metric,8,state.includeHistory);update({chart,metricId:metric,modelIds:ids,missingModelIds:[]},true);return;}if(delivery?.suggestedModelIds?.[chart])chooseSuggested(chart);else update({chart});};
  // Phones swap the tab row for a menu; arrows and a sideways swipe on the heading move one view at a time.
  const swipe=useRef<{x:number;y:number}|null>(null);
  const stepChart=(direction:number)=>{const next=charts[charts.findIndex(chart=>chart.id===state.chart)+direction];if(next)changeChart(next.id);};
  const [familyQuery,setFamilyQuery]=useState('');
  // One sort choice shared by the desktop rail and the mobile dialog.
  const [browseSort,setBrowseSort]=useState<FamilyBrowseSort>('recommend');
  const epochBenchmarkName=epochSlug?benchmarks.find(benchmark=>benchmark.slug===epochSlug)?.name:undefined;
  const loadedEpochRows=epochSlug?readBenchmarkCache(benchmarkCache,epochSlug)??null:null;
  // Ranks come from release metadata (AA) or the complete benchmark asset (Epoch), never from
  // whichever measurement chunks happen to be loaded for the current selection.
  const browseRanking=useMemo(()=>browseRankingFor({models,ranks:delivery?.catalog?.browseRanks??null,chart:state.chart,metricId:state.metricId,
    observations:loadedEpochRows,scoreMetricKey:state.scoreMetricKey,conditionKey:state.conditionKey,benchmarkName:epochBenchmarkName}),
    [models,delivery,state.chart,state.metricId,loadedEpochRows,state.scoreMetricKey,state.conditionKey,epochBenchmarkName]);
  const selectorProps={models:visibleModels,selected:state.modelIds,suggestedIds:delivery?.suggestedModelIds?.[state.chart]??EMPTY_SUGGESTED_IDS,
    browseOrder:browseRanking.keys,browseBasis:browseRanking.basis,browseSort,onBrowseSort:setBrowseSort,includeHistory:state.includeHistory,chart:state.chart,metricId:state.metricId,
    onHistory:(includeHistory:boolean)=>update({includeHistory,...(!customSelection.current&&state.chart==='benchmark'&&!epochSlug?{modelIds:defaultIdsFor(state.chart,state.metricId,includeHistory)}:{})},!customSelection.current),reasoningEfforts:state.reasoningEfforts,query:familyQuery,onQuery:setFamilyQuery,
    presets,onReset:()=>update({modelIds:[],missingModelIds:[]}),onSuggested:()=>chooseSuggested(state.chart),selectionNotice:presetDescription,
    onPreset:(preset:typeof presets[number])=>{update({modelIds:preset.modelIds,missingModelIds:[],chart:preset.chart,metricId:preset.metricId,includeHistory:false,reasoningEfforts:[],conditionKey:null,scoreMetricKey:null});setPresetDescription(preset.description);},
    onToggleFamily:(ids:string[],checked:boolean)=>update({modelIds:toggleCompareFamilySelection(state.modelIds,ids,checked)}),onToggle:toggle,
    onReasoning:(value:string)=>update({reasoningEfforts:value==='all'?[]:state.reasoningEfforts.includes(value)
      ?state.reasoningEfforts.filter(reason=>reason!==value):[...state.reasoningEfforts,value]})};
  const chooseMeasured=()=>update(benchmarkStartingSelection(visibleModels,observations.filter(row=>!state.conditionKey||epochConditionKey(row.conditions)===state.conditionKey),state.scoreMetricKey),true);
  const chooseBenchmark=(metricId:string)=>{const slug=metricId.startsWith('epoch_')?metricId.slice(6):null;const rows=slug?readBenchmarkCache(benchmarkCache,slug):null;if(!slug){update({metricId,conditionKey:null,scoreMetricKey:null,modelIds:delivery?.aaBenchmarkSelections?.[metricId]?.[state.includeHistory?'historical':'current']??selectAaBenchmarkModels(measuredModels,metricId,8,state.includeHistory),missingModelIds:[]},true);return;}update({metricId,conditionKey:null,scoreMetricKey:null,...(rows?{...benchmarkStartingSelection(models,rows),missingModelIds:[]}: {})},true);pendingBenchmarkChoice.current=rows?null:slug;};
  const share=async()=>{try{const url=new URL(window.location.href);url.search=writeViewOptions(comparisonParams(state,!customSelection.current),optionsRef.current).toString();
    await navigator.clipboard.writeText(url.href);setNotice('Comparison link copied.');}catch{setNotice('Copy the address bar to share this comparison.');}};
  const metricName=state.chart==='benchmark'?(epochSlug?benchmarks.find(item=>item.slug===epochSlug)?.name??state.metricId:
    AA_METRIC_LABELS[state.metricId]??state.metricId)+(state.scoreMetricKey?' · '+JSON.parse(state.scoreMetricKey).join(' · '):''):COMPARE_VIEW_LABELS.find(item=>item.id===state.chart)?.label??state.chart;
  const chartCaption=()=>chartExportCaption(displayed.points,metricName,{scale:series.scale,axisLabel:series.kind==='scatter'?series.xLabel:series.yLabel,omitted:logNotice?[...logNotice.selected,...logNotice.reference]:[]})+
    (asOfMonth?' · models released by '+asOfMonth.slice(0,7):'')+(customY?' · vertical axis: '+customY.label+' (the visitor’s own numbers)':'')+(options.workload?' · monthly cost for a stated workload':'');
  const exportSvg=async(copy:boolean)=>{if(!svg.current){setNotice('No chart can be exported in this state. Switch to the chart view or choose measured models.');return;}
    try{if(copy){await copyChartSvg(svg.current,chartCaption());setNotice('Chart copied as SVG.');}else await downloadChartSvg(svg.current,chartCaption());}
    catch{setNotice(copy?'This browser blocked the clipboard. Use “SVG chart” to download it instead.':'SVG export is unavailable in this browser. CSV export is still available.');}};
  const copyEmbed=async()=>{try{const url=new URL(window.location.href);url.search=writeViewOptions(comparisonParams(state,!customSelection.current),optionsRef.current).toString();
    await navigator.clipboard.writeText(chartOnlyUrl(url.href));setNotice('Chart-only link copied. It opens this chart without the site navigation.');}catch{setNotice('This browser blocked the clipboard. Add embed=1 to the address to get the chart-only view.');}};
  const plotted=plottableSeriesPoints(series);
  const costAxis=series.kind==='scatter'&&!series.higherXIsBetter;
  const positiveX=plotted.map(point=>point.x).filter(value=>value>0);
  // Start the budget in the middle of the plotted costs (geometric middle, since costs span orders of magnitude).
  const budgetStart=costAxis&&positiveX.length?Number(Math.sqrt(Math.min(...positiveX)*Math.max(...positiveX)).toPrecision(2)):null;
  const budgetText=(value:number)=>'$'+(value>=100?Math.round(value).toLocaleString('en-US'):value>=.1?value.toFixed(2):String(Number(value.toPrecision(2))));
  // One answer for the note, the ring on the chart and the slider's spoken text: every record drawn, whatever the zoom.
  const budgetBest=costAxis&&options.budget!==null?bestUnderBudget([...plotted,...displayed.referencePoints],options.budget):null;
  const monthName=(month:string)=>new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month));
  const monthEnd=(month:string)=>{const start=new Date(month);return new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0,23,59,59)).toISOString();};
  // "Today" for a static page is the newest observation on the chart, or the month the timeline is showing.
  const today=asOfMonth?monthEnd(asOfMonth):newestDate(displayed.points.map(point=>point.receipt.observedAt));
  const staleCount=displayed.points.filter(point=>stalenessTier(point.receipt.observedAt,today)>0).length;
  const view=series.kind==='scatter'?options.view:options.view==='table'?'table':'chart';
  // Bars rank the horizontal measure (cost or speed), best first; the scatter already shows the score.
  const barsSeries=series.kind!=='scatter'?series:{...series,kind:'bars' as const,yLabel:series.xLabel,frontierGroups:{},
    points:[...series.points].sort((a,b)=>(series.higherXIsBetter?b.x-a.x:a.x-b.x)||a.id.localeCompare(b.id)).map((point,index)=>({...point,x:index,y:point.x,unit:series.xLabel}))};
  const beatenBy=series.kind==='scatter'&&view==='chart'&&active?dominators(active,displayed.points,series.higherXIsBetter):undefined;
  const pairFirst=pinned&&compareId?displayed.points.find(point=>point.id===pinned)??null:null;
  const pairSecond=pairFirst?displayed.points.find(point=>point.id===compareId)??null:null;
  // Shift-click, or the card's "Compare with another point", pins a second record beside the first.
  const pin=(id:string,extend?:boolean)=>{
    if((extend||armed)&&pinned&&pinned!==id){setCompareId(id);setArmed(false);return;}
    setCompareId(null);setArmed(false);setPinned(pinned===id?null:id);
  };
  const loadScores=async(file:File|null)=>{
    if(!file){setScores(null);return;}
    if(file.size>2_000_000){setNotice('That file is larger than 2 MB. Use a CSV with one row per model.');return;}
    try{
      const parsed=parseScoreCsv(await file.text());
      const axis=matchScores(parsed.rows,models.filter(model=>model.source==='aa'&&model.current!==false),'Your score ('+file.name+')');
      setScores({axis,file:{fileName:file.name,matched:axis.matched,unmatched:axis.unmatched,problems:parsed.problems}});
      if(optionsRef.current.weights)updateOptions({weights:null});
      setNotice(axis.matched?'Your scores are on the vertical axis for the selected models. They stay in this browser.':'No row matched a model record exactly. Check the names against the Models list.');
    }catch{setNotice('That file could not be read as text.');}
  };
  const timelineNote=!timelineRequested?'':pendingIds.length?'Loading release dates…':!timelineOn?'Release dates are not recorded for enough of these records to replay.':
    `${effectiveState.modelIds.length} of ${timelinePool.models.length} models measured under index version ${timelinePool.version} had been released by the end of ${monthName(asOfMonth!)}.`+
    (timelinePool.undated?` ${timelinePool.undated} with no recorded release date are left out.`:'')+' The faint line is today’s Pareto line.';
  const togglePlay=()=>{if(playing){setPlaying(false);return;}
    if(months.indexOf(asOfMonth??'')>=months.length-1)updateOptions({asOf:months[0]});setPlaying(true);};
  const chartNotes=[
    budgetBest?`Under ${budgetText(options.budget!)} (${series.xLabel}), the highest ${series.yLabel} shown is ${budgetBest.label} at ${formatChartNumber(budgetBest.y)}.`:
      costAxis&&options.budget!==null?`Nothing shown costs ${budgetText(options.budget)} or less. Drag the budget line right.`:null,
    costAxis&&options.valueLines&&view==='chart'?'Value lines join places with the same score per dollar. Further up and left is more score for the money.':null,
    options.sizeBySpeed&&series.kind==='scatter'&&view==='chart'?'Point size shows median output speed. Records with no speed measurement keep the standard size.':null,
    customY?`Vertical axis: ${customY.label}. These are your numbers, not an AI Stats score.`:null,
    options.workload&&state.chart==='cost-intelligence'?`Horizontal axis: 30 days at ${formatChartNumber(options.workload.inputTokensPerDay/1e6)}M input and ${formatChartNumber(options.workload.outputTokensPerDay/1e6)}M output tokens a day, at each record’s list price.`:null,
    staleCount&&series.kind==='scatter'&&view==='chart'?`${staleCount} faded ${staleCount===1?'point was':'points were'} last observed more than two weeks before the newest record shown.`:null,
  ].filter((note):note is string=>Boolean(note));
  // Every publisher benchmark with runs, and every AA measure with a current value, has its own page.
  const benchmarkPage=state.chart!=='benchmark'?null:epochSlug?(benchmarks.some(item=>item.slug===epochSlug)?benchmarkPath(epochSlug):null):!state.includeHistory&&aaMetrics.some(([key])=>key===state.metricId)?benchmarkPath(state.metricId):null;
  const exportPng=async()=>{if(!svg.current){setNotice('No chart can be exported in this state. Switch to Linear or choose measured models.');return;}try{await downloadChartPng(svg.current,chartCaption());}
    catch{setNotice('Image export is unavailable in this browser. CSV export is still available.');}};
  return <section ref={root} className="compare-explorer" aria-label="Model comparison explorer" data-embed={embed?'true':undefined} data-view={view}>
    <div className="explorer-title"><h1>Compare models</h1><button type="button" className="add-models-button" ref={filterButton} onClick={()=>setFiltersOpen(true)}>Models · {state.modelIds.length}</button></div>
    <div className="mobile-chart-row">
    <label className="mobile-chart-choice">Compare by<select value={charts.some(chart=>chart.id===state.chart)?state.chart:''} onChange={event=>changeChart(event.target.value as CompareChart)}>{!charts.some(chart=>chart.id===state.chart)?<option value="">Choose a chart</option>:null}{charts.map(chart=><option key={chart.id} value={chart.id}>{chart.label}</option>)}</select></label>
      <button type="button" className="chart-step" aria-label="Previous view" disabled={charts.findIndex(chart=>chart.id===state.chart)<=0} onClick={()=>stepChart(-1)}>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
      <button type="button" className="chart-step" aria-label="Next view" disabled={charts.findIndex(chart=>chart.id===state.chart)>=charts.length-1} onClick={()=>stepChart(1)}>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
    </div>
    <nav className="chart-tabs" aria-label="Chart type">{charts.map(chart=><button type="button" key={chart.id}
      aria-pressed={state.chart===chart.id} onClick={()=>changeChart(chart.id)}>{chart.label}</button>)}</nav>
    {!charts.some(chart=>chart.id===state.chart)?<p className="explorer-warning">This saved view has no recorded data. Choose another chart.</p>:null}
    <div className="explorer-workspace"><div className="chart-panel">
      <div className="chart-toolbar">
        <div className="chart-heading" onTouchStart={event=>{const touch=event.touches[0];swipe.current={x:touch.clientX,y:touch.clientY};}}
          onTouchEnd={event=>{const start=swipe.current,touch=event.changedTouches[0];swipe.current=null;if(!start)return;const dx=touch.clientX-start.x,dy=touch.clientY-start.y;
            if(Math.abs(dx)>56&&Math.abs(dx)>Math.abs(dy)*2)stepChart(dx<0?1:-1);}}><h2>{metricName}</h2>{VIEW_NOTES[state.chart]?<p>{VIEW_NOTES[state.chart]}{benchmarkPage?<> <a href={benchmarkPage}>About this benchmark</a></>:null}</p>:null}</div>
        <div className="chart-controls">
        {state.chart==='benchmark'?<label htmlFor="benchmark-selector">Benchmark<select id="benchmark-selector" value={epochSlug||aaMetrics.some(([key])=>key===state.metricId)?state.metricId:''} onChange={event=>chooseBenchmark(event.target.value)}>
          {!epochSlug&&!aaMetrics.some(([key])=>key===state.metricId)?<option value="">Choose a benchmark</option>:null}<optgroup label="Artificial Analysis">{aaMetrics.map(([key,label])=><option key={key} value={key}>{label}</option>)}</optgroup>
          <optgroup label="Benchmark publishers">{benchmarks.map(benchmark=><option key={benchmark.slug} value={'epoch_'+benchmark.slug}>{benchmark.name}</option>)}</optgroup></select></label>:null}
        {epochSlug&&scoreOptions.visible?<label htmlFor="score-metric-selector">Score metric<select id="score-metric-selector" value={state.scoreMetricKey??''} onChange={event=>update(event.target.value?{...changeScoreMetric(event.target.value),...benchmarkStartingSelection(models,observations,event.target.value)}:changeScoreMetric(''),true)}>
          <option value="">Choose a score metric</option>{scoreOptions.missing?<option value={state.scoreMetricKey!}>Unavailable saved metric</option>:null}{scoreMetrics.map(key=><option key={key} value={key}>{JSON.parse(key).join(' · ')}</option>)}</select></label>:null}
        {epochSlug&&(conditions.length||state.conditionKey)?<label htmlFor="condition-selector">Conditions<select id="condition-selector" value={state.conditionKey??''} onChange={event=>{const conditionKey=event.target.value||null;const automatic=!customSelection.current;update({...(automatic?benchmarkStartingSelection(models,observations.filter(row=>!conditionKey||epochConditionKey(row.conditions)===conditionKey),state.scoreMetricKey):{}),conditionKey},automatic);}}>
          <option value="">All recorded runs</option>{state.conditionKey&&!conditions.includes(state.conditionKey)?<option value={state.conditionKey}>Unavailable saved conditions</option>:null}{conditions.map(key=><option value={key} key={key}>{key==='unknown'?'Not recorded':JSON.parse(key).map(([name,value]:[string,unknown])=>name+': '+value).join(' · ')}</option>)}</select></label>:null}
        <div className="scale-buttons view-switch" role="group" aria-label="Show as">
          <button type="button" aria-pressed={view==='chart'} onClick={()=>updateOptions({view:'chart'})}>{series.kind==='scatter'?'Scatter':'Bars'}</button>
          {series.kind==='scatter'?<button type="button" aria-pressed={view==='bars'} onClick={()=>updateOptions({view:'bars'})}>Bars</button>:null}
          <button type="button" aria-pressed={view==='table'} onClick={()=>updateOptions({view:'table'})}>Table</button></div>
        <div className="scale-buttons" role="group" aria-label="Horizontal axis scale"><button type="button" aria-pressed={displayedScale==='linear'} onClick={()=>update({scale:'linear'})}>Linear</button>
          <button type="button" aria-pressed={displayedScale==='log'} onClick={()=>update({scale:'log'})}>Log</button></div>
        <span className="chart-controls-rule" aria-hidden="true"/>
        <button type="button" onClick={share}>Share</button>
        <details className="export-menu"><summary>Export</summary><div><button type="button" disabled={!displayed.points.length||pendingIds.length>0} onClick={()=>downloadText(seriesCsv(displayed.points,{includeX:series.kind==='scatter',xLabel:series.xLabel,yLabel:series.yLabel,metricId:state.chart==='benchmark'?state.metricId:state.chart,metricName,scale:series.scale,omittedIds:series.omittedFromLog.map(point=>point.id),referenceIds:[...displayed.referenceIds]}),'ai-stats-comparison.csv')}>CSV with sources</button>
          <button type="button" disabled={!displayed.points.length||pendingIds.length>0||view==='table'} onClick={exportPng}>PNG chart</button>
          <button type="button" disabled={!displayed.points.length||pendingIds.length>0||view==='table'} onClick={()=>void exportSvg(false)}>SVG chart</button>
          <button type="button" disabled={!displayed.points.length||pendingIds.length>0||view==='table'} onClick={()=>void exportSvg(true)}>Copy SVG</button>
          <button type="button" onClick={()=>void copyEmbed()}>Copy chart-only link</button></div></details>
      </div></div>
      {view==='chart'?<ChartLayers options={options} onOptions={updateOptions} scatter={series.kind==='scatter'} costAxis={costAxis} canCostWorkload={state.chart==='cost-intelligence'}
        frontier={state.frontier} labels={state.labels} onFrontier={()=>update({frontier:!state.frontier})} onLabels={()=>update({labels:!state.labels})}
        budgetStart={budgetStart} months={months} timelineLoading={timelineRequested&&pendingIds.length>0} asOfMonth={asOfMonth} fallbackMonth={(today??new Date().toISOString()).slice(0,7)+'-01'} playing={playing} onPlay={togglePlay} timelineNote={timelineNote}
        zoomed={zoom!==null} onResetZoom={()=>setZoom(null)} scores={scores?.file??null} onScoreFile={file=>void loadScores(file)} blendMissing={blend?.missing??0} blendAvailable={blendAvailable}/>:null}
      {armed&&active?<p className="compare-armed" role="status">Select a second point to set beside {active.label}. <button type="button" onClick={()=>setArmed(false)}>Cancel</button></p>:null}
      {chartNotes.length?<ul className="chart-notes" aria-live="polite">{chartNotes.map(note=><li key={note}>{note}</li>)}</ul>:null}
      {state.missingModelIds.length?<p className="explorer-warning">Unavailable models in this link: {state.missingModelIds.join(', ')}</p>:null}
      {measurementStatus?<p className="explorer-warning" role="status">{measurementStatus}</p>:null}
      {failedSelectedIds.length||failedReferenceIds.length?<button type="button" onClick={()=>setFailedMeasurementIds(previous=>previous.filter(id=>!state.modelIds.includes(id)&&!frontierReferenceIds.includes(id)))}>Retry measurements</button>:null}
      {loadState?<p className="explorer-warning" role="status">{loadState}</p>:null}
      {epochSlug&&scoreOptions.missing&&observations.length?<p className="explorer-warning">The saved score metric is no longer available. Choose a recorded score metric above.</p>:null}
      {loadFailed?<button type="button" onClick={()=>setRetryAttempt(value=>value+1)}>Retry benchmark</button>:null}
      {unverifiedMembership?<p className="explorer-warning">Current AA membership could not be verified. Records labelled Membership unverified may include retired models.</p>:null}
      {logNotice?<div className="explorer-warning" role="status">
        {logNotice.selected.length?<p>{logOmissionHeading(logNotice.selected,logNotice.axis,'selected')}:</p>:null}
        {logNotice.selected.length?<ul className="omitted-log-list" aria-label="Selected records not plotted on Log">{logNotice.selected.map(item=><li key={item.id}>{item.label}: {item.valueLabel}</li>)}</ul>:null}
        {logNotice.reference.length?<p>{logOmissionHeading(logNotice.reference,logNotice.axis,'reference')}; positive Pareto points stay logarithmic:</p>:null}
        {logNotice.reference.length?<ul className="omitted-log-list" aria-label="Pareto reference records not plotted on Log">{logNotice.reference.map(item=><li key={item.id}>{item.label}: {item.valueLabel}</li>)}</ul>:null}
        <button type="button" className="scale-notice-action" onClick={()=>update({scale:'linear'})}>Show all on Linear</button>
      </div>:null}
      {series.mixedConditions?<p className="explorer-warning">These runs used different test settings. Choose conditions for a like-for-like view.</p>:null}
      {referenceFrontier?.points.length&&!series.points.length?<p className="explorer-warning">No selected records have measurements for this view. The current Pareto line is shown for reference.</p>:null}
      {frontierCoverage?.truncated?<p className="explorer-warning">Current Pareto line reference is limited to {frontierDisplayCount} of {frontierCoverage.total} compatible records by the 100-record selection limit.</p>:null}
      {epochSlug&&!series.points.length&&observations.length?<button className="choose-measured" type="button" onClick={chooseMeasured}>Select measured models</button>:null}
      {view==='table'?<CompareTable series={series} points={displayed.points} referenceIds={displayed.referenceIds} activeId={active?.id??null} onPin={id=>setPinned(id)}/>:
      <ComparisonChart series={view==='bars'?barsSeries:series} referenceFrontier={view==='chart'?referenceFrontier??undefined:undefined} scale={displayedScale} labels={state.labels} endpointLane activeId={active?.id??null} onPreview={setHovered}
        onPin={pin} svgRef={svg} onShowLinear={()=>update({scale:'linear'})}
        overlays={{budget:costAxis?options.budget:null,budgetBestId:budgetBest?.id??null,budgetBestLabel:budgetBest?.label,onBudget:value=>updateOptions({budget:Number(value.toPrecision(4))}),budgetLabel:budgetText,valueLines:options.valueLines,sizeBySpeed:options.sizeBySpeed,
          zoom,onZoom:setZoom,soloFamily:solo,onSolo:setSolo,compareId,today,ghostLine,ghostLabel:ghostLine?'Pareto line today':undefined,domainPoints:timelineToday?.points,frontierFocus:timelineOn}}/>}
      {view==='chart'&&series.kind==='scatter'&&displayed.points.length?<p className="chart-hint">Select a point for its record. Drag across the chart to zoom, double-click to reset. Select a model name to hold it in focus.</p>:null}
      {pairFirst&&pairSecond?<PinnedPair series={series} first={pairFirst} second={pairSecond} onClose={()=>setCompareId(null)} onSwap={()=>{setPinned(compareId);setCompareId(pinned);}}/>:
      <div ref={detailsRef} className="observation-dock"><ObservationDetails series={series} point={pinned||series.kind!=='scatter'||view!=='chart'?active:null} pinned={Boolean(pinned)} onPin={()=>setPinned(pinned?null:active?.id??null)} onClose={()=>{setPinned(null);setHovered(null);setArmed(false);}}
        beatenBy={beatenBy} onInspect={id=>setPinned(id)} onCompare={view==='chart'&&series.kind==='scatter'?()=>setArmed(!armed):undefined} comparing={armed}/></div>}
      {active&&displayed.referenceIds.has(active.id)?<p className="reference-inspection-note">Pareto reference model. This model is shown for context and is not in your selection. <button type="button" onClick={()=>toggle(active.modelId)}>Add to selection</button></p>:null}
      <div className="source-strip"><span>{timelineOn?shownIds.size+' released by '+monthName(asOfMonth!):visibleModels.filter(model=>shownIds.has(model.id)).length+' selected'} · {plottableSeriesPoints(series).length} plotted observations{displayed.referencePoints.length?` + ${displayed.referencePoints.length} Pareto reference models`:''}{series.omittedFromLog.length?` · ${series.omittedFromLog.length} omitted on Log`:''}</span>
        <span>{[...new Set(series.points.map(point=>point.receipt.source))].join(' · ')||'No measurements selected'}</span>
        {series.excluded.length?<details><summary>{series.excluded.length} excluded</summary><ul>{series.excluded.map((item,index)=><li key={item.modelId+index}>
          {models.find(model=>model.id===item.modelId)?.name??item.modelId}: {item.reason}</li>)}</ul></details>:null}</div>
    </div><div className="desktop-family-rail"> <ModelSelector {...selectorProps}/></div></div>
    {embed?<p className="embed-credit"><a href="/compare" target="_blank" rel="noopener" onClick={event=>{const url=new URL(window.location.href);url.searchParams.delete('embed');event.currentTarget.href=url.href;}}>AI Stats</a> · sources and exact data on the full page</p>:null}
    <p className="share-notice" role="status">{notice}</p>
    <details className="explorer-methodology"><summary>Sources and calculations</summary>
      <p>Task cost is Artificial Analysis’s weighted average cost across its Intelligence Index evaluation tasks, including measured input, cache, reasoning, and answer-token charges. It is a benchmark methodology measure, not a universal real-world task price. Total evaluation cost is AA’s separately reported complete evaluation spend. Neither is derived from token price.</p>
      <p>Blended prices use three input tokens for each output token. Missing or unsupported values are excluded and shown as exclusions; a recorded zero remains zero.</p>
      <p>Automatic selections and reference Pareto lines exclude known free models and zero-cost points. Free models remain available through search and the Free text routes preset. Pareto lines compare models using the same AA index version and timing settings. Epoch results retain their benchmark and test settings.</p>
      <p>Historical AA results are off by default. Select a point to see its source and date.</p>
    </details>
    <details className="explorer-data"><summary>Exact chart data ({displayed.points.length} observations)</summary><div className="exact-table-scroll"><table>
      <caption>{series.yLabel} · {series.xLabel}</caption><thead><tr><th>Model</th><th>Shown as</th><th>Reasoning</th><th>{series.kind==='scatter'?series.xLabel:'Series'}</th><th>{series.yLabel}</th>{epochSlug?<th>Conditions</th>:null}<th>Source</th><th>Observed</th></tr></thead>
      <tbody>{displayed.points.map(point=><tr key={point.id} data-active={active?.id===point.id}><th scope="row"><button type="button" onClick={()=>setPinned(point.id)}>{point.label}</button></th>
        <td>{displayed.referenceIds.has(point.id)?'Pareto reference':'Selected'}</td><td>{point.reasoning}</td><td>{series.kind==='scatter'?formatChartNumber(point.x):point.series}</td><td>{formatChartNumber(point.y)} {point.unit}</td>
        {epochSlug?<td>{point.receipt.conditions?Object.entries(point.receipt.conditions).map(([key,value])=>key+': '+value).join(' · '):'Not recorded'}</td>:null}
        <td>{point.receipt.sourceUrl?<a href={point.receipt.sourceUrl} target="_blank" rel="noreferrer">{point.receipt.source}</a>:point.receipt.source}</td>
        <td>{point.receipt.observedAt?.slice(0,10)??'Not recorded'}</td></tr>)}</tbody></table></div>
      {!series.points.length?<p>No measured rows for this selection.</p>:null}
    </details>
    <dialog className="model-filter-dialog" ref={dialog} onCancel={()=>setFiltersOpen(false)} onClose={()=>{setFiltersOpen(false);filterButton.current?.focus();}} aria-labelledby="model-picker-title">
      <div className="picker-dialog-heading"><h2 id="model-picker-title">Choose model families</h2><button type="button" onClick={()=>setFiltersOpen(false)}>Done</button></div>{filtersOpen?<ModelSelector {...selectorProps}/>:null}</dialog>
  </section>;
}
