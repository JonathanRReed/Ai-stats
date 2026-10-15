import { useEffect, useMemo, useRef, useState } from 'react';
import { logOmissions, logOmissionHeading, plottableSeriesPoints, type ExplorerModel } from '../../lib/compare-series';
import { buildOverviewSeries, defaultOverviewMetric, overviewCohorts, overviewObservationDate, retainAvailableProvider, UNKNOWN_VERSION, type OverviewMetric } from '../../lib/overview-series';
import ComparisonChart, { familyColor } from './ComparisonChart';
import ObservationDetails from './ObservationDetails';

import '../../styles/compare-explorer.css';
import '../../styles/overview-explorer.css';

type Props = { models: ExplorerModel[]; suggestions: Record<string,string[]> };
const dateLabel = (value: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value))
  : 'Date unavailable';

export default function OverviewExplorer({ models,suggestions }: Props) {
  const cohorts = useMemo(() => overviewCohorts(models), [models]);
  const initialMetric = defaultOverviewMetric(models);
  const [metric, setMetric] = useState<OverviewMetric>(initialMetric);
  const [cohort, setCohort] = useState(cohorts.find(value => value !== UNKNOWN_VERSION) ?? cohorts[0] ?? UNKNOWN_VERSION);
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('');
  const [scale, setScale] = useState<'linear'|'log'>('log');
  const [frontierOnly, setFrontierOnly] = useState(false);
  const [showAllMeasured,setShowAllMeasured]=useState(false);
  const [selectedIds,setSelectedIds]=useState<string[]>(()=>suggestions[`${defaultOverviewMetric(models)}:${cohorts.find(value=>value!==UNKNOWN_VERSION)??''}`]??[]);
  const customSelection=useRef(false);
  const [activeId, setActiveId] = useState<string|null>(null);
  const [pinned, setPinned] = useState<string|null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const suggestionIds=(selectedMetric:OverviewMetric,selectedCohort:string)=>suggestions[`${selectedMetric}:${selectedCohort}`]??[];

  const cohortRows = useMemo(() => models.filter(model => model.source === 'aa' && model.current === true &&
    (cohort === UNKNOWN_VERSION ? !model.indexVersion || !/^\d+(?:\.\d+)*$/.test(model.indexVersion) : model.indexVersion === cohort)), [models,cohort]);
  const providers = useMemo(() => [...new Set(cohortRows.map(model => model.provider ?? 'Unknown provider'))].sort((a,b)=>a.localeCompare(b)), [cohortRows]);
  useEffect(() => { const next=retainAvailableProvider(provider,providers);if(next!==provider)setProvider(next); }, [provider,providers]);
  const matchingRows = useMemo(() => cohortRows.filter(model => (!provider || (model.provider ?? 'Unknown provider') === provider) &&
    (!search || (model.name+' '+model.family+' '+model.provider+' '+model.sourceModelId).toLowerCase().includes(search.toLowerCase().trim()))), [cohortRows,provider,search]);
  const plotRows=useMemo(()=>showAllMeasured?cohortRows.filter(model=>!provider||(model.provider??'Unknown provider')===provider):cohortRows.filter(model=>selectedIds.includes(model.id)&&(!provider||(model.provider??'Unknown provider')===provider)),[showAllMeasured,cohortRows,provider,selectedIds]);
  const series = useMemo(() => buildOverviewSeries(plotRows,metric,cohort,scale), [plotRows,metric,cohort,scale]);
  // The chart receives every measured record (it drops only nonplottable geometry itself), so an
  // all-zero Log view says "Nothing to plot on Log" instead of "no measurements selected".
  const frontierFiltered = useMemo(() => series.points.filter(point => !frontierOnly ||
    Object.values(series.frontierGroups).some(ids => ids.includes(point.id))), [series,frontierOnly]);
  const visibleSeries = useMemo(() => {const ids=new Set(frontierFiltered.map(point=>point.id));
    return {...series,points:frontierFiltered,omittedFromLog:series.omittedFromLog.filter(point=>ids.has(point.id))};}, [series,frontierFiltered]);
  const plottable = useMemo(() => plottableSeriesPoints(series), [series]);
  const visiblePoints = useMemo(() => plottableSeriesPoints(visibleSeries), [visibleSeries]);
  const omitted = useMemo(() => logOmissions(series.omittedFromLog, series.kind), [series]);
  const visibleFamilies = useMemo(() => [...new Set(visiblePoints.map(point=>point.family))].sort((a,b)=>a.localeCompare(b)), [visiblePoints]);
  const active = series.points.find(point => point.id === (pinned ?? activeId)) ?? null;
  const costAvailable = cohort !== UNKNOWN_VERSION && buildOverviewSeries(models,'task-cost',cohort).points.length>0;
  const comparisonUrl = (id:string) => `/compare?${new URLSearchParams({chart:metric,m:id,metric:'aa_intelligence_index',scale:series.scale}).toString()}`;

  return <section className="overview-explorer compare-explorer" aria-label="AA Intelligence Index cost comparison">
    <header className="overview-chart-heading">
      <div><h2>Cost and Intelligence Index</h2></div>
    </header>
    <div className="overview-chart-controls" aria-label="Overview chart controls">
      <fieldset className="overview-metric-switch"><legend>Horizontal axis</legend>
        <button type="button" aria-pressed={metric==='task-cost'} disabled={!costAvailable} onClick={()=>{setMetric('task-cost');if(!customSelection.current)setSelectedIds(suggestionIds('task-cost',cohort));setActiveId(null);setPinned(null);}}>Cost per task</button>
        <button type="button" aria-pressed={metric==='cost-intelligence'} onClick={()=>{setMetric('cost-intelligence');if(!customSelection.current)setSelectedIds(suggestionIds('cost-intelligence',cohort));setActiveId(null);setPinned(null);}}>Token price vs Intelligence</button>
      </fieldset>
      <button type="button" onClick={()=>{customSelection.current=false;setSelectedIds(suggestionIds(metric,cohort));setShowAllMeasured(false);}}>Suggested models</button>
      <label>AA Index version<select value={cohort} onChange={event=>{setCohort(event.target.value);if(!customSelection.current)setSelectedIds(suggestionIds(metric,event.target.value));setActiveId(null);setPinned(null);}}>
        {!cohorts.length?<option value={UNKNOWN_VERSION}>No recorded version</option>:null}
        {cohorts.map(version=><option key={version} value={version}>{version===UNKNOWN_VERSION?'Unknown version':version}</option>)}
      </select></label>
      <label>Provider<select value={provider} onChange={event=>setProvider(event.target.value)}><option value="">All providers</option>
        {provider&&!providers.includes(provider)?<option value={provider}>Unavailable: {provider}</option>:null}{providers.map(value=><option key={value}>{value}</option>)}</select></label>
      <div className="overview-scale" role="group" aria-label="Horizontal axis scale">
        <button type="button" aria-pressed={series.scale==='linear'} onClick={()=>setScale('linear')}>Linear</button>
        <button type="button" aria-pressed={series.scale==='log'} onClick={()=>setScale('log')}>Log</button>
      </div>
      <label className="overview-check"><input type="checkbox" checked={frontierOnly} onChange={event=>setFrontierOnly(event.target.checked)}/>Show Pareto models only</label>
    </div>
    <p className="overview-axis-definition">X: {series.xLabel} · Y: AA Intelligence Index</p>
    {metric==='task-cost'?<details className="overview-methodology"><summary>How AA task cost is measured</summary>
      <p>AA reports a weighted average across its Intelligence Index evaluation tasks. Its cost includes the measured input, cache, reasoning, and answer-token charges for those evaluations. This is a benchmark methodology measure, not a prediction of what every real-world prompt will cost.</p>
    </details>:<p className="overview-methodology-note">Token prices use the recorded 3:1 input/output blend. Zero is a measured price when the source reports it.</p>}
    <dl className="overview-summary" aria-label="Selected cohort summary">
      <div><dt>AA records in cohort</dt><dd>{cohortRows.length.toLocaleString('en-US')}</dd></div>
      <div><dt>Plotted for these axes</dt><dd>{plottable.length.toLocaleString('en-US')}</dd></div>
      <div><dt>Latest source observation</dt><dd>{dateLabel(overviewObservationDate(cohortRows,cohort))}</dd></div>
    </dl>
    <p className="overview-plot-status" aria-live="polite">{visiblePoints.length} of {plottable.length} plotted points · {cohortRows.length} records in this version.{omitted.length?` ${omitted.length} measured ${omitted.length===1?'record is':'records are'} not plotted on Log.`:''}</p>
    <label className="overview-all-measured"><input type="checkbox" checked={showAllMeasured} onChange={event=>setShowAllMeasured(event.target.checked)}/>Show all measured models</label>
    <details className="overview-model-picker"><summary>Search, add, or remove models ({selectedIds.length} selected)</summary>
      <label>Find a model<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search full model name"/></label>
      <ul>{matchingRows.slice(0,40).map(model=><li key={model.id}><label><input type="checkbox" checked={selectedIds.includes(model.id)} onChange={()=>{customSelection.current=true;setSelectedIds(old=>old.includes(model.id)?old.filter(id=>id!==model.id):[...old,model.id]);setShowAllMeasured(false);}}/>{model.name} · {model.provider??'Unknown provider'}</label></li>)}</ul>
      {!matchingRows.length?<p>No matching models.</p>:null}
      {matchingRows.length>40?<p>Showing first 40 matches. Narrow the search to find a specific record.</p>:null}
    </details>
    {omitted.length?<div className="explorer-warning" role="status"><p>{logOmissionHeading(omitted,series.xLabel)}:</p>
      <ul className="omitted-log-list" aria-label="Records not plotted on Log">{omitted.slice(0,12).map(item=><li key={item.id}>{item.label}: {item.valueLabel}</li>)}</ul>
      {omitted.length>12?<p>{omitted.length-12} more are listed in the exact chart data.</p>:null}
      <button type="button" className="scale-notice-action" onClick={()=>setScale('linear')}>Show all on Linear</button></div>:null}
    <div className="overview-chart-layout">
      <div className="overview-chart-wrap">
        <ComparisonChart series={visibleSeries} labels={true} endpointLane activeId={active?.id??null} onPreview={setActiveId}
          onPin={id=>setPinned(pinned===id?null:id)} svgRef={svg} onShowLinear={()=>setScale('linear')}/>
        <p className="overview-inspect-hint">Frontier and selected endpoint names appear when labels fit; focus or select any point for its full details. Use arrow keys to inspect nearby records.</p>
        <ObservationDetails series={series} point={active} pinned={Boolean(pinned)} onPin={()=>setPinned(pinned?null:active?.id??null)} onClose={()=>{setPinned(null);setActiveId(null);}}/>
      </div>
      <aside className="overview-family-key" aria-label="Visible model families">
        <h3>Families</h3>
        {visibleFamilies.slice(0,12).map(family=><span key={family} title={family}><i style={{background:familyColor(family)}}/>{family}</span>)}
        {!visibleFamilies.length?<p>{frontierFiltered.length&&series.scale==='log'?'None of these records can be drawn on Log.':'No points match this cohort and metric.'}</p>:null}
        {visibleFamilies.length>12?<p>{visibleFamilies.length-12} more appear in the exact data table.</p>:null}
      </aside>
    </div>
    {series.excluded.length?<details className="overview-excluded"><summary>{series.excluded.length.toLocaleString('en-US')} cohort records not plotted</summary>
      <ul>{series.excluded.map(item=><li key={item.modelId}>{models.find(model=>model.id===item.modelId)?.name??item.modelId}: {item.reason}</li>)}</ul>
    </details>:null}
    <details className="overview-exact-data"><summary>Exact chart data ({series.points.length.toLocaleString('en-US')} records)</summary>
      <div className="exact-table-scroll"><table><caption>{series.yLabel} against {series.xLabel}. Values and receipt dates are from this record's source payload.</caption>
        <thead><tr><th scope="col">Model record</th><th scope="col">Provider</th><th scope="col">Index version</th><th scope="col">{series.xLabel}</th><th scope="col">Intelligence Index</th><th scope="col">Observed</th><th scope="col">Source</th></tr></thead>
        <tbody>{series.points.map(point=><tr key={point.id} data-active={active?.id===point.id}>
          <th scope="row"><button type="button" onClick={()=>{setPinned(point.id);setActiveId(point.id);}}>{point.label}</button><a className="overview-compare-link" href={comparisonUrl(point.modelId)}>Compare</a></th>
          <td>{models.find(model=>model.id===point.modelId)?.provider??'Unknown provider'}</td><td>{point.receipt.indexVersion??'Unknown'}</td><td>{String(point.x)}</td><td>{String(point.y)}</td>
          <td>{dateLabel(point.receipt.observedAt)}</td><td>{point.receipt.sourceUrl?<a href={point.receipt.sourceUrl} target="_blank" rel="noreferrer">{point.receipt.source}</a>:point.receipt.source}</td>
        </tr>)}</tbody>
      </table></div>
      {!series.points.length?<p>No measurements with both selected-axis values exist for this cohort.</p>:null}
    </details>
  </section>;
}
