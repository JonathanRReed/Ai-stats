import {useDeferredValue,useEffect,useMemo,useRef,useState} from 'react';
import {EXPLORER_SOURCE_LABELS,type ExplorerModel} from '../../lib/compare-series';
import {defaultCatalogSource,nextCatalogSource} from '../../lib/compare-presets';
import {modelPickerPage} from '../../lib/model-picker';

type Props={models:ExplorerModel[];selected:string[];includeHistory:boolean;onToggle:(id:string)=>void;
  chart:string;metricId:string;onHistory:(value:boolean)=>void;reasoningEfforts:string[];onReasoning:(value:string)=>void};

export default function ModelSelector({models,selected,includeHistory,chart,metricId,onToggle,onHistory,reasoningEfforts,onReasoning}:Props){
 const [page,setPage]=useState(0);
 const [source,setSource]=useState(defaultCatalogSource(models,chart,metricId,includeHistory));
 const sourceTouched=useRef(false);
 useEffect(()=>{setPage(0);if(sourceTouched.current){setSource(previous=>nextCatalogSource(models,previous,includeHistory));return;}
  setSource(defaultCatalogSource(models,chart,metricId,includeHistory));},[models,includeHistory,chart,metricId]);
 const [search,setSearch]=useState('');
 const query=useDeferredValue(search);
 const selectedSet=useMemo(()=>new Set(selected),[selected]);
 const results=useMemo(()=>modelPickerPage(models,query,source,includeHistory,page),[models,query,source,includeHistory,page]);
 const browsable=models.filter(model=>includeHistory||model.current!==false);

 return <div className="model-selector">
  <div className="picker-controls">
   <label className="model-search-label">Find models<input type="search" placeholder="Search by model or provider" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/></label>
   <label className="catalog-source-label">Source<select value={source} onChange={event=>{sourceTouched.current=true;setSource(event.target.value);setPage(0);}}>
    <option value="all">All sources</option>{Object.entries(EXPLORER_SOURCE_LABELS).filter(([key])=>browsable.some(model=>model.source===key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}
   </select></label>
  </div>
  <details className="model-advanced"><summary>Reasoning and history</summary>
   {models.some(model=>model.source==='aa')?<fieldset className="reasoning-filters"><legend>Chart reasoning filter</legend>
    <button type="button" aria-pressed={!reasoningEfforts.length} onClick={()=>onReasoning('all')}>All</button>
    {['none','low','medium','high','xhigh','minimal','max','unknown'].map(value=><button type="button" key={value} aria-pressed={reasoningEfforts.includes(value)} onClick={()=>onReasoning(value)}>{value}</button>)}</fieldset>:null}
   <label className="history-toggle"><input type="checkbox" checked={includeHistory} onChange={event=>onHistory(event.target.checked)}/> Include historical AA records</label>
  </details>
  <div className="picker-results" role="region" aria-label="Matching models" aria-busy={query!==search}>
   {results.records.map(model=>{
    const sourceLabel=EXPLORER_SOURCE_LABELS[model.source];
    const provider=model.provider??model.family;
    return <label className="model-option" key={model.id} data-selected={selectedSet.has(model.id)}>
     <input type="checkbox" checked={selectedSet.has(model.id)} disabled={!selectedSet.has(model.id)&&selected.length>=100} onChange={()=>onToggle(model.id)}/>
     <span><strong>{model.name}</strong><small>{provider} · {sourceLabel}</small><small>{model.sourceModelId}</small>
      <small>{model.current===false?'Historical · ':model.source==='aa'&&model.current===null?'Membership unverified · ':''}{model.source==='epoch'?'Benchmark records':model.source==='aa'?'AA measurements':model.hasTokenPrices||typeof model.priceInput==='number'||typeof model.priceOutput==='number'?'Token prices available':'Catalog only · no chart measurements'}</small>
     </span>
    </label>;
   })}
   {!results.total?<p className="selector-note">No matching models. Try another name or source.</p>:null}
  </div>
  <div className="picker-footer"><span role="status">{selected.length} selected · {results.total} matches{selected.length>=100?' · Selection limit reached':''}</span>
   <nav aria-label="Model result pages"><button type="button" disabled={results.page===0} onClick={()=>setPage(results.page-1)}>Previous</button>
    <span aria-current="page">{results.page+1} / {results.pages}</span><button type="button" disabled={results.page+1>=results.pages} onClick={()=>setPage(results.page+1)}>Next</button></nav>
  </div>
 </div>;
}
