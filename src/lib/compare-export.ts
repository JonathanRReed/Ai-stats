import type {EvidenceReceipt,LogOmission} from './compare-series';
type CsvPoint={id?:string;modelId?:string;series?:string;label:string;reasoning?:string;x:number;y:number;unit:string;receipt:EvidenceReceipt};
const cell=(value:unknown)=>{
  let text=value===null||value===undefined?'':String(value);
  if(typeof value!=='number'&&/^[\s]*[=+@-]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
};
/** When `scale` is given, every row states the axis scale and whether it is drawn (Log omits zero/negative values). */
export function seriesCsv(points:CsvPoint[],options:{includeX?:boolean;xLabel?:string;yLabel?:string;metricId?:string;metricName?:string;scale?:'linear'|'log';omittedIds?:string[];referenceIds?:string[]}={}):string{
  const includeX=options.includeX!==false;
  const rows:Array<Array<string|number>>=[['Metric','Metric ID','Model','Model ID','Observation ID','Series','Index version','Reasoning',...(includeX?[options.xLabel??'X']:[]),
    options.yLabel??'Value','Unit','Source','Observed','Retrieved','Conditions','Source URL','Snapshot',...(options.scale?['Axis scale','Plotted on chart']:[]),...(options.referenceIds?['Shown as']:[])]];
  const omitted=new Set(options.omittedIds??[]);
  for(const point of points)rows.push([options.metricName??'',options.metricId??'',point.label,point.modelId??'',point.id??'',point.series??'',point.receipt.indexVersion??'',point.reasoning??'unknown',...(includeX?[point.x]:[]),point.y,point.unit,
    point.receipt.source,point.receipt.observedAt??'',point.receipt.fetchedAt??'',
    point.receipt.conditions?JSON.stringify(point.receipt.conditions):'unknown',point.receipt.sourceUrl??'',point.receipt.snapshotId??'',
    ...(options.scale?[options.scale,options.scale==='log'&&point.id!==undefined&&omitted.has(point.id)?'No: zero or negative value cannot be drawn on Log':'Yes']:[]),...(options.referenceIds?[options.referenceIds.includes(point.id??'')?'Pareto reference':'Selected']:[])]);
  return rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export function downloadText(text:string,filename:string,type='text/csv;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([text],{type}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function chartExportCaption(points:CsvPoint[],metricName:string,context:{scale?:'linear'|'log';axisLabel?:string;omitted?:LogOmission[]}={}):string {
  const sources=[...new Set(points.map(point=>point.receipt.source+' · '+
    (point.receipt.observedAt?'observed '+point.receipt.observedAt.slice(0,10):
      point.receipt.fetchedAt?'retrieved '+point.receipt.fetchedAt.slice(0,10):'date not recorded')))];
  const scale=context.scale?' · '+(context.scale==='log'?'Log':'Linear')+' scale'+(context.axisLabel?' ('+context.axisLabel+')':''):'';
  const omitted=context.scale==='log'&&context.omitted?.length?' · Not plotted on Log: '+context.omitted.map(item=>item.label+' ('+item.valueLabel+')').join(', '):'';
  return 'AI Stats · '+metricName+scale+' · '+sources.join(' · ')+omitted;
}
export function canvasPngBlob(canvas:Pick<HTMLCanvasElement,'toBlob'>):Promise<Blob>{
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image encoding failed')),'image/png'));
}
const EXPORT_STYLE_PROPERTIES=['fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','paint-order','font-family','font-size','font-weight','font-style','font-variant-numeric','letter-spacing','text-anchor','dominant-baseline','opacity','filter'];
// The three faces the chart sets text in. Embedding them keeps an exported chart looking like the page.
const EXPORT_FONTS:Array<[family:string,url:string,weight:string]>=[
  ['Nebula Sans','/fonts/nebula-sans/NebulaSans-Medium.woff2','500'],
  ['Nebula Sans','/fonts/nebula-sans/NebulaSans-Semibold.woff2','600'],
  ['JetBrains Mono','/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2','100 800'],
];
const assetCache=new Map<string,Promise<string>>();
/** Same-origin assets only, as data URLs, because an image drawn from an SVG cannot load anything external. */
const assetDataUrl=(url:string):Promise<string>=>{
  let pending=assetCache.get(url);
  if(!pending){
    pending=fetch(url).then(response=>{if(!response.ok)throw new Error('Asset unavailable');return response.blob();})
      .then(blob=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);}));
    pending.catch(()=>assetCache.delete(url));
    assetCache.set(url,pending);
  }
  return pending;
};
/** Breaks the source line to the chart's width; the character estimate errs short so a line never clips. */
export function wrapCaption(caption:string,width:number,characterWidth=6.6):string[]{
  const limit=Math.max(20,Math.floor((width-40)/characterWidth));
  const lines:string[]=[];let line='';
  for(const word of caption.split(' ')){
    const next=line?line+' '+word:word;
    if(line&&next.length>limit){lines.push(line);line=word;}else line=next;
  }
  if(line)lines.push(line);
  return lines;
}
/**
 * A self-contained copy of the chart: computed styles written inline, lab marks and (optionally) fonts
 * embedded, a background, and the source line underneath. It renders the same with no stylesheet.
 */
export async function standaloneChartSvg(svg:SVGSVGElement,caption:string,options:{fonts?:boolean}={}):Promise<{text:string;width:number;height:number}>{
  const clone=svg.cloneNode(true) as SVGSVGElement;
  const original=[svg,...Array.from(svg.querySelectorAll('*'))];
  const copied=[clone,...Array.from(clone.querySelectorAll('*'))];
  original.forEach((node,index)=>{
    const styles=getComputedStyle(node);
    EXPORT_STYLE_PROPERTIES.forEach(property=>{const value=styles.getPropertyValue(property);if(value)(copied[index] as SVGElement).style.setProperty(property,value);});
  });
  const box=svg.viewBox.baseVal;
  const width=Math.round(box?.width||svg.getBoundingClientRect().width),chartHeight=Math.round(box?.height||svg.getBoundingClientRect().height);
  await Promise.all(Array.from(clone.querySelectorAll('image')).map(async image=>{
    const href=image.getAttribute('href');
    if(!href||!href.startsWith('/')){image.remove();return;}
    try{image.setAttribute('href',await assetDataUrl(href));}catch{image.remove();}
  }));
  const root=getComputedStyle(document.documentElement);
  const surface=root.getPropertyValue('--surface-0').trim()||'#090b0d',ink=root.getPropertyValue('--ink-1').trim()||'#c5cbc8';
  const lines=wrapCaption(caption,width);
  const height=chartHeight+28+lines.length*18;
  const namespace='http://www.w3.org/2000/svg';
  clone.setAttribute('xmlns',namespace);clone.setAttribute('viewBox',`0 0 ${width} ${height}`);
  clone.setAttribute('width',String(width));clone.setAttribute('height',String(height));
  clone.removeAttribute('style');clone.style.setProperty('font-family',"'Nebula Sans', 'Helvetica Neue', Arial, sans-serif");
  const background=document.createElementNS(namespace,'rect');
  background.setAttribute('width',String(width));background.setAttribute('height',String(height));background.setAttribute('fill',surface);
  clone.insertBefore(background,clone.firstChild);
  if(options.fonts){
    try{
      const faces=await Promise.all(EXPORT_FONTS.map(async([family,url,weight])=>`@font-face{font-family:"${family}";src:url(${await assetDataUrl(url)}) format("woff2");font-weight:${weight};}`));
      const style=document.createElementNS(namespace,'style');style.textContent=faces.join('');
      clone.insertBefore(style,clone.firstChild);
    }catch{ /* The chart still exports with the fallback face. */ }
  }
  lines.forEach((line,index)=>{
    const text=document.createElementNS(namespace,'text');
    text.setAttribute('x','20');text.setAttribute('y',String(chartHeight+30+index*18));text.setAttribute('fill',ink);
    text.setAttribute('font-size','12');text.textContent=line;clone.appendChild(text);
  });
  return {text:new XMLSerializer().serializeToString(clone),width,height};
}
export async function downloadChartSvg(svg:SVGSVGElement,caption:string){
  const {text}=await standaloneChartSvg(svg,caption,{fonts:true});
  downloadText(text,'ai-stats-comparison.svg','image/svg+xml;charset=utf-8');
}
/** Without the embedded fonts, so the clipboard holds a chart-sized string rather than a quarter of a megabyte. */
export async function copyChartSvg(svg:SVGSVGElement,caption:string){
  const {text}=await standaloneChartSvg(svg,caption);
  await navigator.clipboard.writeText(text);
}
export async function downloadChartPng(svg:SVGSVGElement,caption:string){
  const {text,width,height}=await standaloneChartSvg(svg,caption,{fonts:true});
  const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml;charset=utf-8'}));
  try{
    const image=new Image();image.src=url;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;
    const context=canvas.getContext('2d');if(!context)throw new Error('Image export unavailable');
    context.scale(2,2);context.drawImage(image,0,0,width,height);
    const pngUrl=URL.createObjectURL(await canvasPngBlob(canvas));
    const link=document.createElement('a');link.download='ai-stats-comparison.png';link.href=pngUrl;link.click();
    setTimeout(()=>URL.revokeObjectURL(pngUrl),1000);
  }finally{URL.revokeObjectURL(url);}
}
/**
 * The address of the chart-only view of a comparison. It is a link, not an iframe snippet: the site's
 * headers (X-Frame-Options and frame-ancestors in public/_headers) let only this site frame its pages.
 */
export function chartOnlyUrl(href:string):string{
  const url=new URL(href);url.searchParams.set('embed','1');url.hash='';
  return url.href;
}
