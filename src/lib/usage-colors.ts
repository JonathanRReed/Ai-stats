export const USAGE_MODEL_COLORS=['#d88662','#79a9c6','#b4aa78','#a895ba','#75b6a9','#c18e9c','#9daa75','#a4b2c4'] as const;

export function usageColors(modelKeys:readonly string[]):Map<string,string>{
 const result=new Map<string,string>([['other','#636c78'],['unselected','#90979e']]);
 const used=new Set<number>();
 for(const key of [...new Set(modelKeys)].filter(key=>key!=='other'&&key!=='unselected').sort().slice(0,8)){
  let hash=0;for(const char of key)hash=(hash*31+char.charCodeAt(0))>>>0;
  let index=hash%USAGE_MODEL_COLORS.length;
  while(used.has(index))index=(index+1)%USAGE_MODEL_COLORS.length;
  used.add(index);result.set(key,USAGE_MODEL_COLORS[index]);
 }
 return result;
}
