import { useEffect, useMemo, useRef, useState } from 'react';
import { type ExplorerModel } from '../../lib/compare-series';
import { buildOverviewSeries, defaultOverviewMetric, overviewCohorts, overviewObservationDate, retainAvailableProvider, UNKNOWN_VERSION, type OverviewMetric } from '../../lib/overview-series';
import ComparisonChart, { familyColor } from './ComparisonChart';
import ObservationDetails from './ObservationDetails';

import '../../styles/compare-explorer.css';
import '../../styles/overview-explorer.css';

type Props = { models: ExplorerModel[] };
const dateLabel = (value: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value))
  : 'Date unavailable';

export default function OverviewExplorer({ models }: Props) {
  const cohorts = useMemo(() => overviewCohorts(models), [models]);
  const initialMetric = defaultOverviewMetric(models);
  const [metric, setMetric] = useState<OverviewMetric>(initialMetric);
  const [cohort, setCohort] = useState(cohorts.find(value => value !== UNKNOWN_VERSION) ?? cohorts[0] ?? UNKNOWN_VERSION);
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('');
  const [scale, setScale] = useState<'linear'|'log'>('log');
  const [frontierOnly, setFrontierOnly] = useState(false);
  const [activeId, setActiveId] = useState<string|null>(null);
  const [pinned, setPinned] = useState<string|null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const cohortRows = useMemo(() => models.filter(model => model.source === 'aa' && model.current === true &&
    (cohort === UNKNOWN_VERSION ? !model.indexVersion || !/^\d+(?:\.\d+)*$/.test(model.indexVersion) : model.indexVersion === cohort)), [models,cohort]);
  const providers = useMemo(() => [...new Set(cohortRows.map(model => model.provider ?? 'Unknown provider'))].sort((a,b)=>a.localeCompare(b)), [cohortRows]);
  useEffect(() => { const next=retainAvailableProvider(provider,providers);if(next!==provider)setProvider(next); }, [provider,providers]);
  const matchingRows = useMemo(() => cohortRows.filter(model => (!provider || (model.provider ?? 'Unknown provider') === provider) &&
    (!search || (model.name+' '+model.family+' '+model.provider+' '+model.sourceModelId).toLowerCase().includes(search.toLowerCase().trim()))), [cohortRows,provider,search]);
  const series = useMemo(() => buildOverviewSeries(matchingRows,metric,cohort,scale), [matchingRows,metric,cohort,scale]);
  const visiblePoints = useMemo(() => series.points.filter(point => !frontierOnly ||
    Object.values(series.frontierGroups).some(ids => ids.includes(point.id))), [series,frontierOnly]);
  const visibleSeries = useMemo(() => ({...series,points:visiblePoints}), [series,visiblePoints]);
  const visibleFamilies = useMemo(() => [...new Set(visiblePoints.map(point=>point.family))].sort((a,b)=>a.localeCompare(b)), [visiblePoints]);
  const active = series.points.find(point => point.id === (pinned ?? activeId)) ?? null;
  const costAvailable = cohorts.some(version => version !== UNKNOWN_VERSION && buildOverviewSeries(models,'task-cost',version).points.length>0);
  const comparisonUrl = (id:string) => `/compare?${new URLSearchParams({chart:metric,m:id,metric:'aa_intelligence_index',scale:series.scale}).toString()}`;

  return <section className="overview-explorer compare-explorer" aria-label="AA Intelligence Index cost comparison">
    <header className="overview-chart-heading">
      <div><h2>Cost and Intelligence Index</h2></div>
    </header>
    <div className="overview-chart-controls" aria-label="Overview chart controls">
      <fieldset className="overview-metric-switch"><legend>Horizontal axis</legend>
        <button type="button" aria-pressed={metric==='task-cost'} disabled={!costAvailable} onClick={()=>{setMetric('task-cost');setActiveId(null);setPinned(null);}}>Cost per task</button>
        <button type="button" aria-pressed={metric==='cost-intelligence'} onClick={()=>{setMetric('cost-intelligence');setActiveId(null);setPinned(null);}}>Token price vs Intelligence</button>
      </fieldset>
      <label>AA Index version<select value={cohort} onChange={event=>{setCohort(event.target.value);setActiveId(null);setPinned(null);}}>
        {!cohorts.length?<option value={UNKNOWN_VERSION}>No recorded version</option>:null}
        {cohorts.map(version=><option key={version} value={version}>{version===UNKNOWN_VERSION?'Unknown version':version}</option>)}
      </select></label>
      <label>Provider<select value={provider} onChange={event=>setProvider(event.target.value)}><option value="">All providers</option>
        {provider&&!providers.includes(provider)?<option value={provider}>Unavailable: {provider}</option>:null}{providers.map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="overview-search">Find a model<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search full model name"/></label>
      <div className="overview-scale" role="group" aria-label="Horizontal axis scale">
        <button type="button" aria-pressed={series.scale==='linear'} onClick={()=>setScale('linear')}>Linear</button>
        <button type="button" aria-pressed={series.scale==='log'} onClick={()=>setScale('log')}>Log</button>
      </div>
      <label className="overview-check"><input type="checkbox" checked={frontierOnly} onChange={event=>setFrontierOnly(event.target.checked)}/>Show frontier only</label>
    </div>
    <p className="overview-axis-definition">X: {series.xLabel} · Y: AA Intelligence Index</p>
    {metric==='task-cost'?<details className="overview-methodology"><summary>How AA task cost is measured</summary>
      <p>AA reports a weighted average across its Intelligence Index evaluation tasks. Its cost includes the measured input, cache, reasoning, and answer-token charges for those evaluations. This is a benchmark methodology measure, not a prediction of what every real-world prompt will cost.</p>
    </details>:<p className="overview-methodology-note">Token prices use the recorded 3:1 input/output blend. Zero is a measured price when the source reports it.</p>}
    <dl className="overview-summary" aria-label="Selected cohort summary">
      <div><dt>AA records in cohort</dt><dd>{cohortRows.length.toLocaleString('en-US')}</dd></div>
      <div><dt>Plotted for these axes</dt><dd>{series.points.length.toLocaleString('en-US')}</dd></div>
      <div><dt>Latest source observation</dt><dd>{dateLabel(overviewObservationDate(cohortRows,cohort))}</dd></div>
    </dl>
    <p className="overview-plot-status" aria-live="polite">{visiblePoints.length} of {series.points.length} points{search||provider?' match filters':''}. Recorded zeros stay on a linear axis.</p>
    {series.scaleNotice?<p className="explorer-warning" role="status">{series.scaleNotice}</p>:null}
    <div className="overview-chart-layout">
      <div className="overview-chart-wrap">
        <ComparisonChart series={visibleSeries} labels={false} showFamilyLegend={false} activeId={active?.id??null} onPreview={setActiveId}
          onPin={id=>setPinned(pinned===id?null:id)} svgRef={svg}/>
        <p className="overview-inspect-hint">Model names appear when you focus, hover, or select a point. Use arrow keys to inspect nearby records; the full names remain in the exact data table.</p>
        <ObservationDetails series={series} point={active} pinned={Boolean(pinned)} onPin={()=>setPinned(pinned?null:active?.id??null)} onClose={()=>{setPinned(null);setActiveId(null);}}/>
      </div>
      <aside className="overview-family-key" aria-label="Visible model families">
        <h3>Families</h3>
        {visibleFamilies.slice(0,12).map(family=><span key={family} title={family}><i style={{background:familyColor(family)}}/>{family}</span>)}
        {!visibleFamilies.length?<p>No points match this cohort and metric.</p>:null}
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
