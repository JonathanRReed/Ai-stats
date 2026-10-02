import {useEffect,useMemo,useRef,useState} from 'react';
import {buildUsageSeries,usageModels,type UsageSnapshot} from '../lib/openrouter-usage';
type Props={snapshot:UsageSnapshot|null;receipt?:{fetchedAt:string;publishedAt:string;status:string}|null};
const label=(key:string)=>key==='other'?'Other (outside daily top 50)':key==='unselected'?'Unselected ranked models':key;
const colors=['#d88662','#79a9c6','#b4aa78','#a895ba','#75b6a9','#c18e9c','#9daa75','#a4b2c4'];
const color=(key:string)=>{if(key==='other')return '#636c78';if(key==='unselected')return '#90979e';
 let hash=0;for(const char of key)hash=(hash*31+char.charCodeAt(0))>>>0;return colors[hash%colors.length];};
const compact=(value:number)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value);
export default function OpenRouterUsage({snapshot,receipt}:Props){
 const models=useMemo(()=>snapshot?usageModels(snapshot):[],[snapshot]);
 const [windowDays,setWindowDays]=useState(30),[mode,setMode]=useState('share');
 const [selected,setSelected]=useState(()=>models.slice(0,4)),[search,setSearch]=useState('');
 const [activeDate,setActiveDate]=useState(snapshot?.endDate??'');
 const chartFrame=useRef<HTMLDivElement|null>(null),[chartWidth,setChartWidth]=useState(1000);
 useEffect(()=>{
  if(!chartFrame.current)return;
  const observer=new ResizeObserver(([entry])=>setChartWidth(Math.max(500,entry.contentRect.width)));
  observer.observe(chartFrame.current);return()=>observer.disconnect();
 },[snapshot]);
 const dayRefs=useRef<Array<SVGGElement|null>>([]);
 const series=useMemo(()=>snapshot?buildUsageSeries(snapshot,windowDays,selected,mode):null,[snapshot,windowDays,selected,mode]);
 if(!snapshot||!series)return <section className="usage-module usage-unavailable" aria-label="OpenRouter traffic">
  <h2>OpenRouter traffic</h2><p>Usage history is not available yet.</p></section>;
 const keys=[...series.selectedModels,'unselected','other'];
 const active=series.days.find(day=>day.date===activeDate)??series.days.at(-1);
 const ceiling=mode==='share'?100:Math.max(1,...series.days.map(day=>Number(day.totalTokens??0)));
 const left=72,right=chartWidth-26,top=24,bottom=314,width=(right-left)/Math.max(1,series.days.length);
 const filtered=models.filter(key=>key.toLowerCase().includes(search.toLowerCase())).slice(0,30);
 const inspect=(index:number)=>{setActiveDate(series.days[index].date);dayRefs.current[index]?.focus();};
 const toggle=(key:string)=>setSelected(current=>current.includes(key)?current.filter(value=>value!==key):current.length<8?[...current,key]:current);
 return <section className="usage-module" aria-labelledby="usage-title">
  <header className="usage-heading"><div><h2 id="usage-title">OpenRouter traffic</h2>
   <p>Daily tokens across OpenRouter’s public models.</p></div>
   <div className="usage-controls">
    <div role="group" aria-label="Usage window">{[7,30,90].map(days=><button type="button" key={days} aria-pressed={days===windowDays} onClick={()=>setWindowDays(days)}>{days} days</button>)}</div>
    <div role="group" aria-label="Usage measure">{[['share','Share'],['volume','Token volume']].map(([key,name])=><button type="button" key={key} aria-pressed={key===mode} onClick={()=>setMode(key)}>{name}</button>)}</div>
   </div>
  </header>
  <div className="usage-settings">
   <details><summary>Models ({series.selectedModels.length}/8)</summary>
    <label>Find a model<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Model or provider" /></label>
    <div className="usage-selection-actions"><button type="button" onClick={()=>setSelected(models.slice(0,4))}>Reset models</button><button type="button" onClick={()=>setSelected([])}>Clear models</button></div>
    <div className="usage-model-list">{filtered.map(key=><label key={key}><input type="checkbox" checked={selected.includes(key)} disabled={!selected.includes(key)&&selected.length>=8} onChange={()=>toggle(key)} />{key}</label>)}</div>
    {models.length>filtered.length?<p>Showing {filtered.length} matches. Search to narrow the list.</p>:null}
   </details>
   <p>{series.availableDays} days available in the requested {windowDays}-day window · UTC</p>
  </div>
  {receipt&&receipt.status!=='healthy'?<p className="usage-warning" role="status">{receipt.status==='failed'?'The latest refresh failed.':'The refresh is overdue.'} Showing the last successful snapshot.</p>:null}
  <div className="usage-chart-scroll" ref={chartFrame}>
   <svg viewBox={`0 0 ${chartWidth} 362`} role="group" aria-label={mode==='share'?'Share of all reported OpenRouter traffic by day':'OpenRouter token volume by day'}>
    <title>OpenRouter daily token usage</title>
    {[0,.25,.5,.75,1].map(ratio=><g key={ratio}><line x1={left} x2={right} y1={bottom-ratio*(bottom-top)} y2={bottom-ratio*(bottom-top)} className="usage-grid"/>
     <text x={left-10} y={bottom-ratio*(bottom-top)+4} textAnchor="end">{mode==='share'?ratio*100+'%':compact(ceiling*ratio)}</text></g>)}
    {series.days.map((day,index)=>{
     let stack=bottom;const x=left+index*width+1;
     return <g key={day.date} ref={node=>{dayRefs.current[index]=node;}} role="button" tabIndex={0}
      aria-label={day.date+': '+(day.available?day.totalTokens+' total tokens':'No data')}
      onFocus={()=>setActiveDate(day.date)} onPointerEnter={()=>setActiveDate(day.date)} onClick={()=>setActiveDate(day.date)}
      onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();
       inspect(event.key==='Home'?0:event.key==='End'?series.days.length-1:Math.max(0,Math.min(series.days.length-1,index+(event.key==='ArrowLeft'?-1:1))));}}}>
      <title>{day.date+': '+(day.available?day.totalTokens+' tokens':'No data')}</title>
      <rect x={x} y={top} width={Math.max(1,width-2)} height={bottom-top} className={active?.date===day.date?'usage-day-hit active':'usage-day-hit'} />
      {day.available?day.parts.map(part=>{const h=part.value===null?0:Math.max(0,part.value/ceiling*(bottom-top));stack-=h;
       return <rect key={part.key} x={x} y={stack} width={Math.max(1,width-2)} height={h} fill={color(part.key)} pointerEvents="none"/>;}):
       <line x1={x+width/2} x2={x+width/2} y1={top} y2={bottom} className="usage-gap" />}
     </g>;
    })}
    {[0,Math.floor((series.days.length-1)/2),series.days.length-1].filter((value,index,array)=>array.indexOf(value)===index).map(index=><text key={index} x={left+(index+.5)*width} y={340} textAnchor="middle">{series.days[index]?.date.slice(5)}</text>)}
   </svg>
  </div>
  <div className="usage-legend">{keys.map(key=><span key={key}><i style={{background:color(key)}}/>{label(key)}</span>)}</div>
  <div className="usage-inspector" aria-live="polite"><strong>{active?.date}</strong><span>{active?.available?active.totalTokens+' total tokens':'No data for this UTC day'}</span>
   {active?.available?<dl>{active.parts.map(part=><div key={part.key}><dt>{label(part.key)}</dt><dd>{part.tokens===null?'Not in daily top 50':mode==='share'?(part.value===null?'No traffic':part.value.toFixed(2)+'%'):part.tokens+' tokens'}</dd></div>)}</dl>:null}
  </div>
  <p className="usage-caveat">Share uses all reported traffic, including Other. A model missing from a day’s top 50 has unknown individual traffic. Provider tokenizers differ.</p>
  <details className="usage-data"><summary>Exact daily data</summary><div className="usage-table-scroll"><table>
   <caption>Unrounded token totals. Missing days are gaps.</caption><thead><tr><th scope="col">Date (UTC)</th>{keys.map(key=><th key={key} scope="col">{label(key)}</th>)}<th scope="col">All traffic</th></tr></thead>
   <tbody>{series.days.map(day=><tr key={day.date}><th scope="row">{day.date}</th>{keys.map(key=>{const part=day.parts.find(item=>item.key===key);return <td key={key}>{!day.available?'No data':part?.tokens??'Not in daily top 50'}</td>;})}<td>{day.totalTokens??'No data'}</td></tr>)}</tbody>
  </table></div></details>
  <footer className="usage-source">Source: <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">OpenRouter</a>, as of <time dateTime={snapshot.asOf}>{snapshot.asOf}</time>. <a href={snapshot.licenseUrl} target="_blank" rel="noreferrer">CC BY 4.0</a>.
   {receipt?<span> Retrieved <time dateTime={receipt.fetchedAt}>{receipt.fetchedAt}</time>.</span>:null}
  </footer>
 </section>;
}
