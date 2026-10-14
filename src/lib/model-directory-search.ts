export type DirectorySearchGroup={provider:string;names:string[]};
export function searchDirectoryGroups(groups:DirectorySearchGroup[],raw:string){
 const query=raw.trim().toLowerCase();
 return groups.map(group=>{
  const providerHit=Boolean(query)&&group.provider.toLowerCase().includes(query);
  const itemMatches=group.names.map(name=>!query||providerHit||name.toLowerCase().includes(query));
  const matchCount=itemMatches.filter(Boolean).length;
  return {itemMatches,matchCount,visible:!query||matchCount>0,countText:query?`${matchCount} matching / ${group.names.length} total`:`${group.names.length} ${group.names.length===1?'model':'models'}`,showRange:!query};
 });
}
export function providerIdFromHash(hash:string):string|null{
 try{return decodeURIComponent(hash.replace('#',''))||null;}catch{return null;}
}
