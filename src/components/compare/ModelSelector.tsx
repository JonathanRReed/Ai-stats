import {useDeferredValue,useMemo,useState,useEffect,useRef} from 'react';
import {EXPLORER_SOURCE_LABELS,type ExplorerModel} from '../../lib/compare-series';
import {paginateFamilyGroups} from '../../lib/compare-state';
import {nextCatalogSource} from '../../lib/compare-presets';
import {familyColor} from './ComparisonChart';
type Props={models:ExplorerModel[];selected:string[];includeHistory:boolean;onToggle:(id:string)=>void;
  chart:string;
  onFamily:(family:string,checked:boolean)=>void;onGroup?:(ids:string[],checked:boolean)=>void;onHistory:(value:boolean)=>void;reasoningEfforts:string[];onReasoning:(value:string)=>void;onClear:()=>void;onReset:()=>void};
export default function ModelSelector({models,selected,includeHistory,chart,onToggle,onGroup,onHistory,reasoningEfforts,onReasoning,onClear,onReset}:Props){
  const [limit,setLimit]=useState(80);const [source,setSource]=useState(chart==='price'?'all':'aa');const sourceTouched=useRef(false);
  useEffect(()=>{if(sourceTouched.current){setSource(previous=>nextCatalogSource(models,previous,includeHistory));return;}
    setSource(chart==='price'?'all':models.some(model=>model.source==='aa'&&(includeHistory||model.current!==false))?'aa':'all');},[models,includeHistory,chart]);
  const [search,setSearch]=useState('');const query=useDeferredValue(search).toLowerCase().trim();
  const browsable=models.filter(model=>includeHistory||model.current!==false);
  const selectedSet=useMemo(()=>new Set(selected),[selected]);
  const matches=useMemo(()=>models.filter(model=>(includeHistory||model.current!==false)&&(source==='all'||model.source===source)&&
    (!query||(model.name+' '+model.family+' '+model.provider+' '+model.sourceModelId).toLowerCase().includes(query))),[models,query,includeHistory,source]);
  const page=useMemo(()=>paginateFamilyGroups(matches,limit),[matches,limit]);
  const groups=page.groups;
  const chosen=models.filter(model=>selectedSet.has(model.id));
  const selectedGroups=new Map<string,ExplorerModel[]>();
  for(const model of chosen){const key=JSON.stringify([model.source,model.family]);const group=selectedGroups.get(key)??[];group.push(model);selectedGroups.set(key,group);}
  const concise=(model:ExplorerModel)=>model.reasoning&&model.reasoning!=='unknown'
    ?({none:'Standard',low:'Low',medium:'Medium',high:'High',xhigh:'Xhigh',minimal:'Minimal',max:'Max'} as Record<string,string>)[model.reasoning]??model.name
    :model.name.length>24?model.name.slice(0,22)+'…':model.name;
  const groupChosen=(group:ExplorerModel[])=>group.every(model=>selectedSet.has(model.id));
  return <div className="model-selector">
    <label className="model-search-label">Find models<input type="search" placeholder="Search models or providers" value={search} onChange={event=>{setSearch(event.target.value);setLimit(80);}}/></label>
    <label className="catalog-source-label">Catalog source<select value={source} onChange={event=>{setSource(event.target.value);setLimit(80);}}>
      <option value="all">All sources ({browsable.length})</option>{Object.entries(EXPLORER_SOURCE_LABELS).filter(([key])=>browsable.some(model=>model.source===key)).map(([key,label])=><option key={key} value={key}>{label} ({browsable.filter(model=>model.source===key).length})</option>)}
    </select></label>
    <div className="selector-heading"><h2>Selected models <span>{chosen.length}</span></h2><button type="button" onClick={onClear}>Clear</button></div>
    <div className="selected-models">{chosen.length?[...selectedGroups].map(([key,group])=><div className="selected-family" key={key}>
      <span className="selected-family-heading"><i style={{background:familyColor(group[0].family)}}/>{group[0].family}<small>{EXPLORER_SOURCE_LABELS[group[0].source]}</small></span>
      <span className="selected-family-variants">{group.map(model=><button type="button" key={model.id} title={model.name}
        onClick={()=>onToggle(model.id)} aria-label={'Remove '+model.name+' from '+EXPLORER_SOURCE_LABELS[model.source]}>{concise(model)} <span aria-hidden="true">×</span></button>)}</span>
    </div>):<p>No models selected</p>}</div>
    <details className="model-advanced"><summary>Reasoning and history</summary>{models.some(model=>model.source==='aa')?<fieldset className="reasoning-filters"><legend>Reasoning label</legend>
      <button type="button" aria-pressed={!reasoningEfforts.length} onClick={()=>onReasoning('all')}>All</button>
      {['none','low','medium','high','xhigh','minimal','max','unknown'].map(value=><button type="button" key={value}
        aria-pressed={reasoningEfforts.includes(value)} onClick={()=>onReasoning(value)}>{value}</button>)}</fieldset>:null}
    <label className="history-toggle"><input type="checkbox" checked={includeHistory} onChange={event=>onHistory(event.target.checked)}/> Include historical AA records</label></details>
    <div className="selector-heading"><h2>Browse records</h2><button type="button" onClick={onReset}>Reset</button></div>
    <div className="model-options">{groups.map(group=>{const family=group[0]?.family??'';const sourceLabel=group[0]?EXPLORER_SOURCE_LABELS[group[0].source]:'';const key=JSON.stringify([group[0]?.source,family]);return <section key={key} className="model-family">
      <button type="button" className="family-toggle" aria-pressed={groupChosen(group)}
        onClick={()=>onGroup?.(group.map(model=>model.id),!groupChosen(group))}><span>{family}<small>{sourceLabel}</small></span><span style={{background:familyColor(family)}}/></button>
      {group.map(model=><label key={model.id} className="model-option" data-selected={selectedSet.has(model.id)} title={model.name}>
        <input type="checkbox" checked={selectedSet.has(model.id)} onChange={()=>onToggle(model.id)}/>
        <span>{concise(model)}<small title={model.name}>{model.reasoning&&model.reasoning!=='unknown'?model.name+' · ':''}{model.provider}{model.source==='epoch'?' · '+model.sourceModelId:''}{model.current===false?' · Historical':model.source==='aa'&&model.current===null?' · Membership unverified':''}</small><small>{model.source==='epoch'?'Benchmark records':model.source==='aa'?'AA measurements':model.hasTokenPrices||typeof model.priceInput==='number'||typeof model.priceOutput==='number'?'Token prices available':'Catalog only · no chart measurements'}</small></span></label>)}
    </section>;})}</div>
    <p className="selector-note" role="status">Showing {page.visibleCount} of {matches.length} matching records. Families are kept together.</p>
    {matches.length>page.visibleCount?<button className="show-more-models" type="button" onClick={()=>setLimit(value=>value+80)}>Show more ({matches.length-page.visibleCount} remaining)</button>:null}
    {selected.length>=100?<p className="selector-note">100-record comparison limit. Remove a record to add another.</p>:null}
    {!matches.length?<p className="selector-note">No matching models.</p>:null}
  </div>;
}
