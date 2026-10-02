import {useDeferredValue,useMemo,useState} from 'react';
import {EXPLORER_SOURCE_LABELS,type ExplorerModel} from '../../lib/compare-series';
import {familyColor} from './ComparisonChart';
type Props={models:ExplorerModel[];selected:string[];includeHistory:boolean;onToggle:(id:string)=>void;
  onFamily:(family:string,checked:boolean)=>void;onGroup?:(ids:string[],checked:boolean)=>void;onHistory:(value:boolean)=>void;reasoningEfforts:string[];onReasoning:(value:string)=>void;onClear:()=>void;onReset:()=>void};
export default function ModelSelector({models,selected,includeHistory,onToggle,onFamily,onGroup,onHistory,reasoningEfforts,onReasoning,onClear,onReset}:Props){
  const [limit,setLimit]=useState(80);const [source,setSource]=useState('all');
  const [search,setSearch]=useState('');const query=useDeferredValue(search).toLowerCase().trim();
  const selectedSet=useMemo(()=>new Set(selected),[selected]);
  const matches=useMemo(()=>models.filter(model=>(includeHistory||model.current!==false)&&(source==='all'||model.source===source)&&
    (!query||(model.name+' '+model.provider+' '+model.sourceModelId).toLowerCase().includes(query))),[models,query,includeHistory,source]);
  const visible=matches.slice(0,limit);const groups=new Map<string,ExplorerModel[]>();
  for(const model of visible){const group=groups.get(model.family)??[];group.push(model);groups.set(model.family,group);}
  const chosen=models.filter(model=>selectedSet.has(model.id));
  const chosenGroups=new Map<string,ExplorerModel[]>();
  for(const model of chosen){const group=chosenGroups.get(model.family)??[];group.push(model);chosenGroups.set(model.family,group);}
  const groupChosen=(group:ExplorerModel[])=>group.every(model=>selectedSet.has(model.id));
  return <div className="model-selector">
    <label className="model-search-label">Find models<input type="search" placeholder="Search models or providers" value={search} onChange={event=>{setSearch(event.target.value);setLimit(80);}}/></label>
    <label className="catalog-source-label">Catalog source<select value={source} onChange={event=>{setSource(event.target.value);setLimit(80);}}>
      <option value="all">All sources ({models.length})</option>{Object.entries(EXPLORER_SOURCE_LABELS).filter(([key])=>models.some(model=>model.source===key)).map(([key,label])=><option key={key} value={key}>{label} ({models.filter(model=>model.source===key).length})</option>)}
    </select></label>
    <div className="selector-heading"><h2>Selected models <span>{chosen.length}</span></h2><button type="button" onClick={onClear}>Clear</button></div>
    <div className="selected-models">{chosen.length?[...chosenGroups].map(([family,group])=><button type="button" key={family}
      onClick={()=>onFamily(family,false)} aria-label={'Remove family '+family}><span style={{background:familyColor(family)}}/>
      <span className="selected-family-name">{family}<small>{group.length} {group.length===1?'variant':'variants'}</small></span>
      <span aria-hidden="true">×</span></button>):<p>No models selected</p>}</div>
    <details className="model-advanced"><summary>Reasoning and history</summary>{models.some(model=>model.source==='aa')?<fieldset className="reasoning-filters"><legend>Reasoning label</legend>
      <button type="button" aria-pressed={!reasoningEfforts.length} onClick={()=>onReasoning('all')}>All</button>
      {['none','low','medium','high','xhigh','max','unknown'].map(value=><button type="button" key={value}
        aria-pressed={reasoningEfforts.includes(value)} onClick={()=>onReasoning(value)}>{value}</button>)}</fieldset>:null}
    <label className="history-toggle"><input type="checkbox" checked={includeHistory} onChange={event=>onHistory(event.target.checked)}/> Include historical AA records</label></details>
    <div className="selector-heading"><h2>Browse records</h2><button type="button" onClick={onReset}>Reset</button></div>
    <div className="model-options">{[...groups].map(([family,group])=><section key={family} className="model-family">
      <button type="button" className="family-toggle" aria-pressed={groupChosen(group)}
        onClick={()=>onGroup?.(group.map(model=>model.id),!groupChosen(group))}><span>{family}</span><span style={{background:familyColor(family)}}/></button>
      {group.map(model=><label key={model.id} className="model-option" data-selected={selectedSet.has(model.id)}>
        <input type="checkbox" checked={selectedSet.has(model.id)} onChange={()=>onToggle(model.id)}/>
        <span>{model.name}<small>{EXPLORER_SOURCE_LABELS[model.source]} · {model.provider}{model.source==='epoch'?' · '+model.sourceModelId:''}{model.current===false?' · Historical':model.source==='aa'&&model.current===null?' · Membership unverified':''}</small><small>{model.source==='epoch'?'Benchmark records':model.source==='aa'?'AA measurements':typeof model.priceInput==='number'||typeof model.priceOutput==='number'?'Token prices available':'Catalog only · no chart measurements'}</small></span></label>)}
    </section>)}</div>
    <p className="selector-note" role="status">Showing {Math.min(limit,matches.length)} of {matches.length} matching records</p>
    {matches.length>limit?<button className="show-more-models" type="button" onClick={()=>setLimit(value=>value+80)}>Show more ({matches.length-limit} remaining)</button>:null}
    {selected.length>=100?<p className="selector-note">100-record comparison limit. Remove a record to add another.</p>:null}
    {!matches.length?<p className="selector-note">No matching models.</p>:null}
  </div>;
}
