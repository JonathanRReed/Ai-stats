import {useDeferredValue,useMemo,useState} from 'react';
import type {ExplorerModel} from '../../lib/compare-series';
import {familyColor} from './ComparisonChart';
type Props={models:ExplorerModel[];selected:string[];includeHistory:boolean;onToggle:(id:string)=>void;
  onFamily:(family:string,checked:boolean)=>void;onHistory:(value:boolean)=>void;onClear:()=>void;onReset:()=>void};
export default function ModelSelector({models,selected,includeHistory,onToggle,onFamily,onHistory,onClear,onReset}:Props){
  const [search,setSearch]=useState('');const query=useDeferredValue(search).toLowerCase().trim();
  const selectedSet=useMemo(()=>new Set(selected),[selected]);
  const matches=useMemo(()=>models.filter(model=>(includeHistory||model.current!==false)&&
    (!query||(model.name+' '+model.provider+' '+model.sourceModelId).toLowerCase().includes(query))),[models,query,includeHistory]);
  const visible=matches.slice(0,80);const groups=new Map<string,ExplorerModel[]>();
  for(const model of visible){const group=groups.get(model.family)??[];group.push(model);groups.set(model.family,group);}
  const chosen=models.filter(model=>selectedSet.has(model.id));
  return <div className="model-selector">
    <label className="model-search-label">Find models<input type="search" placeholder="Search models or providers" value={search} onChange={event=>setSearch(event.target.value)}/></label>
    <div className="selector-heading"><h2>Selected models <span>{chosen.length}</span></h2><button type="button" onClick={onClear}>Clear</button></div>
    <div className="selected-models">{chosen.length?chosen.map(model=><button type="button" key={model.id} onClick={()=>onToggle(model.id)}
      aria-label={'Remove '+model.name}><span style={{background:familyColor(model.family)}}/>{model.name}<span aria-hidden="true">×</span></button>):<p>No models selected</p>}</div>
    <label className="history-toggle"><input type="checkbox" checked={includeHistory} onChange={event=>onHistory(event.target.checked)}/> Include historical AA records</label>
    <div className="selector-heading"><h2>Model families</h2><button type="button" onClick={onReset}>Reset</button></div>
    <div className="model-options">{[...groups].map(([family,group])=><section key={family} className="model-family">
      <button type="button" className="family-toggle" aria-pressed={group.every(model=>selectedSet.has(model.id))}
        onClick={()=>onFamily(family,!group.every(model=>selectedSet.has(model.id)))}><span>{family}</span><span style={{background:familyColor(family)}}/></button>
      {group.map(model=><label key={model.id} className="model-option" data-selected={selectedSet.has(model.id)}>
        <input type="checkbox" checked={selectedSet.has(model.id)} onChange={()=>onToggle(model.id)}/>
        <span>{model.name}<small>{model.provider}{model.current===false?' · Historical':''}</small></span></label>)}
    </section>)}</div>
    {matches.length>80?<p className="selector-note">Showing 80 of {matches.length}. Narrow the search to find more.</p>:null}
    {!matches.length?<p className="selector-note">No matching models.</p>:null}
  </div>;
}
