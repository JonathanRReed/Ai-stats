/** Keep the active label inside a narrow plot; the inspection card retains the full name. */
export function inlineChartLabel(label:string,cx:number,cy:number,bounds:{left:number;right:number;top:number}){
  const maxCharacters=Math.max(4,Math.min(24,Math.floor((bounds.right-bounds.left-16)/6.5)));
  const text=label.length>maxCharacters?label.slice(0,maxCharacters-1)+'…':label;
  const width=text.length*6.5;
  return {text,x:Math.max(bounds.left+4,Math.min(cx+8,bounds.right-width-4)),y:Math.max(bounds.top+14,cy-10),width};
}
