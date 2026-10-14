export type LeaderboardCatalogRecord = {id:string;source:string;sourceModelId:string};

/** Convert a leaderboard run row into the Compare catalog identity used by initial and rebuilt links. */
export function leaderboardRunCatalogRecord(model:{source_key?:string|null;model_version:string}):LeaderboardCatalogRecord{
 const source=model.source_key?'publisher':'epoch';
 return {id:`${source}:${model.model_version}`,source,sourceModelId:model.model_version};
}

/** Keep the displayed score cohort when opening its ranked records in Compare. */
export function leaderboardComparisonHref(links:string[],catalog:LeaderboardCatalogRecord[]):string{
 const parsed=links.filter(link=>link.startsWith('/compare?')).map(link=>new URLSearchParams(link.slice('/compare?'.length)));
 const first=parsed[0];
 if(!first)return '/compare';
 const sameCohort=parsed.filter(params=>params.get('metric')===first.get('metric')&&params.get('score_metric')===first.get('score_metric'));
 const ids=new Set<string>();
 for(const params of sameCohort){
  const direct=params.get('m');
  if(direct&&catalog.some(model=>model.id===direct)){ids.add(direct);continue;}
  const source=params.get('source')==='epoch-ai'?'epoch':params.get('source');
  const matches=catalog.filter(model=>model.source===source&&model.sourceModelId===params.get('record'));
  if(matches.length===1)ids.add(matches[0].id);
 }
 if(!ids.size)return '/compare?'+first.toString();
 const params=new URLSearchParams(first);
 for(const key of ['m','models','model','source','record','inventory','auto'])params.delete(key);
 if(!sameCohort.every(item=>item.get('condition')===first.get('condition')))params.delete('condition');
 for(const id of [...ids].slice(0,100))params.append('m',id);
 return '/compare?'+params.toString();
}
