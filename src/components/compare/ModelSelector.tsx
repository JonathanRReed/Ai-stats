import {useMemo,useState} from 'react';
import {EXPLORER_SOURCE_LABELS,type ExplorerModel} from '../../lib/compare-series';
import {compareCatalogScope,familySelectionState,groupCompareFamilies,type CompareFamily} from '../../lib/compare-families';
import {familyColor} from '../../lib/family-color';
import type {ComparePreset} from '../../lib/compare-presets';

type Props={models:ExplorerModel[];selected:string[];suggestedIds:string[];includeHistory:boolean;chart:string;metricId:string;onHistory:(value:boolean)=>void;
 reasoningEfforts:string[];onReasoning:(value:string)=>void;onToggle:(id:string)=>void;onToggleFamily:(ids:string[],checked:boolean)=>void;
 onReset:()=>void;onSuggested:()=>void;presets:ComparePreset[];onPreset:(preset:ComparePreset)=>void;query:string;onQuery:(value:string)=>void;selectionNotice?:string};
const reasoningLevels=['none','low','medium','high','xhigh','minimal','max','unknown'];

export default function ModelSelector({models,selected,suggestedIds,includeHistory,chart,metricId,onHistory,reasoningEfforts,onReasoning,onToggle,onToggleFamily,onReset,onSuggested,presets,onPreset,query,onQuery,selectionNotice}:Props){
 const [showAll,setShowAll]=useState(false);
 const [allCatalog,setAllCatalog]=useState(false);
 const selectedKey=JSON.stringify(selected);
 const suggestedKey=JSON.stringify(suggestedIds);
 const stableSelected=useMemo(()=>selected,[selectedKey]);
 const stableSuggestedIds=useMemo(()=>suggestedIds,[suggestedKey]);
 const selectedSet=useMemo(()=>new Set(stableSelected),[stableSelected]);
 const searchable=useMemo(()=>compareCatalogScope(models,chart,metricId,stableSelected,allCatalog)
  .filter(model=>includeHistory||model.current!==false||selectedSet.has(model.id)),[models,chart,metricId,stableSelected,allCatalog,includeHistory,selectedSet]);
 const groups=useMemo(()=>groupCompareFamilies(searchable,stableSelected,query,stableSuggestedIds),[searchable,stableSelected,query,stableSuggestedIds]);
 const allGroups=useMemo(()=>groupCompareFamilies(searchable,stableSelected,'',stableSuggestedIds),[searchable,stableSelected,stableSuggestedIds]);
 const hasQuery=query.trim().length>0;
 const chosen=allGroups.filter(group=>group.selectedIds.length>0);
 const suggested=groups.filter(group=>group.selectedIds.length===0&&group.suggested);
 const more=groups.filter(group=>group.selectedIds.length===0&&!group.suggested);
 const shownMore=hasQuery||showAll?more:more.slice(0,8);
 const hasAa=searchable.some(model=>model.source==='aa');

 const atLimit=selected.length>=100;
 const groupRow=(group:CompareFamily)=>{
  const addingCount=group.records.filter(model=>!selectedSet.has(model.id)).length;
  const wouldExceedLimit=familySelectionState(group)!==true&&selected.length+addingCount>100;
  const nameCounts=new Map<string,number>();
  group.records.forEach(model=>nameCounts.set(model.name,(nameCounts.get(model.name)??0)+1));
  return <div className="family-entry" key={group.key}>
  <button type="button" role="checkbox" aria-checked={familySelectionState(group)} className="family-row"
   disabled={familySelectionState(group)!==true&&wouldExceedLimit} title={wouldExceedLimit?'This family would exceed the 100-record selection limit':undefined} data-selected={group.selectedIds.length>0} onClick={()=>onToggleFamily(group.records.map(model=>model.id),familySelectionState(group)!==true)}>
   <span className="family-color-dot" style={{'--family-color':familyColor(group.family)} as React.CSSProperties} aria-hidden="true"/>
   <span className="family-row-copy"><strong>{group.family}</strong><small>{group.provider} · {EXPLORER_SOURCE_LABELS[group.source]}</small></span>
   {group.selectedIds.length&&group.selectedIds.length<group.records.length?<span className="family-partial">{group.selectedIds.length}/{group.records.length}</span>:null}
  </button>
  {group.records.length>1?<details className="family-variants"><summary aria-label={`Choose exact ${group.family} variants`}>Variants · {group.records.length}</summary>
   <div className="family-variant-list">{group.records.map(model=><label key={model.id} className="family-variant">
    <input type="checkbox" checked={selectedSet.has(model.id)} disabled={!selectedSet.has(model.id)&&atLimit}
     aria-label={nameCounts.get(model.name)!>1?`Select ${model.name}, ${group.provider}, ${EXPLORER_SOURCE_LABELS[group.source]}, record ${model.sourceModelId??model.id}`:undefined}
     onChange={()=>onToggle(model.id)}/>
    <span title={nameCounts.get(model.name)!>1?`${model.name} · ${model.sourceModelId??model.id}`:undefined}>{model.name}</span><small>{model.reasoning==='unknown'?'Reasoning not recorded':model.reasoning}{model.current===false?' · Historical':''}</small>
   </label>)}</div>
  </details>:null}
 </div>;
 };

 return <aside className="model-selector family-rail" aria-label="Model families">
  <header className="family-rail-heading"><h2>Models</h2><span aria-live="polite">{selected.length} / 100 records{atLimit?' · limit reached':''}</span></header>
  <label className="family-search-label">Browse records<select value={allCatalog?'all':'chart'} onChange={event=>setAllCatalog(event.target.value==='all')}><option value="chart">Chart data</option><option value="all">All catalog sources</option></select></label>
  <label className="family-search-label">Search families<input type="search" placeholder="Family or variant" value={query} onChange={event=>onQuery(event.target.value)}/></label>
  {hasAa?<fieldset className="reasoning-filters"><legend>Reasoning levels</legend>
   <button type="button" aria-pressed={!reasoningEfforts.length} onClick={()=>onReasoning('all')}>All</button>
   {reasoningLevels.filter(level=>level!=='unknown'||searchable.some(model=>model.source==='aa'&&(model.reasoning??'unknown')==='unknown')).map(level=><button type="button" key={level}
    aria-pressed={reasoningEfforts.includes(level)} onClick={()=>onReasoning(level)}>{level==='none'?'No reasoning':level}</button>)}
  </fieldset>:null}
  <label className="history-toggle"><input type="checkbox" checked={includeHistory} onChange={event=>onHistory(event.target.checked)}/> Include historical records</label>
  {chosen.length?<section className="family-section" aria-label="Selected families"><h3>Selected families <span>{chosen.length}</span></h3>{chosen.map(groupRow)}</section>:null}
  <section className="family-section" aria-label="Suggested families"><header><h3>Suggested families <span>{suggested.length}</span></h3>
   {suggestedIds.length?<button type="button" className="rail-action" onClick={onSuggested}>Use suggestions</button>:null}</header>
   {suggested.length?suggested.map(groupRow):<p className="family-empty">{suggestedIds.length&&suggestedIds.every(id=>selectedSet.has(id))?'All suggestions are selected.':suggestedIds.length?'No suggestions match this search.':'No measured suggestions for this view.'}</p>}
  </section>
  {shownMore.length?<section className="family-section" aria-label="More families"><h3>More families <span>{more.length}</span></h3>{shownMore.map(groupRow)}
   {!hasQuery&&more.length>8?<button type="button" className="show-all-families" aria-expanded={showAll} onClick={()=>setShowAll(value=>!value)}>{showAll?'Show fewer':'Show all families'}</button>:null}
  </section>:null}
  {hasQuery&&!groups.length?<p className="family-empty">No families match “{query}”. Try another name or variant.</p>:null}
  {atLimit?<p className="family-cap-notice" role="status">Selection limit reached. Remove a record before adding another.</p>:null}
  <footer className="family-rail-footer"><button type="button" onClick={onReset} disabled={!selected.length}>Clear selection</button>
   {presets.length?<details className="rail-presets"><summary>Other starting points</summary><div>{presets.map(preset=><button type="button" key={preset.id} title={preset.description} onClick={()=>onPreset(preset)}>{preset.label}</button>)}</div></details>:null}</footer>
  {selectionNotice?<p className="family-selection-notice" role="status">{selectionNotice}</p>:null}
 </aside>;
}
