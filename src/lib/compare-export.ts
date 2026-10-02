import type {EvidenceReceipt} from './compare-series';
type CsvPoint={id?:string;modelId?:string;series?:string;label:string;reasoning?:string;x:number;y:number;unit:string;receipt:EvidenceReceipt};
const cell=(value:unknown)=>{
  let text=value===null||value===undefined?'':String(value);
  if(typeof value!=='number'&&/^[\s]*[=+@-]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
};
export function seriesCsv(points:CsvPoint[],options:{includeX?:boolean;xLabel?:string;yLabel?:string;metricId?:string;metricName?:string}={}):string{
  const includeX=options.includeX!==false;
  const rows:Array<Array<string|number>>=[['Metric','Metric ID','Model','Model ID','Observation ID','Series','Index version','Reasoning',...(includeX?[options.xLabel??'X']:[]),
    options.yLabel??'Value','Unit','Source','Observed','Retrieved','Conditions','Source URL','Snapshot']];
  for(const point of points)rows.push([options.metricName??'',options.metricId??'',point.label,point.modelId??'',point.id??'',point.series??'',point.receipt.indexVersion??'',point.reasoning??'unknown',...(includeX?[point.x]:[]),point.y,point.unit,
    point.receipt.source,point.receipt.observedAt??'',point.receipt.fetchedAt??'',
    point.receipt.conditions?JSON.stringify(point.receipt.conditions):'unknown',point.receipt.sourceUrl??'',point.receipt.snapshotId??'']);
  return rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export function downloadText(text:string,filename:string,type='text/csv;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([text],{type}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function chartExportCaption(points:CsvPoint[],metricName:string):string {
  const sources=[...new Set(points.map(point=>point.receipt.source+' · '+
    (point.receipt.observedAt?'observed '+point.receipt.observedAt.slice(0,10):
      point.receipt.fetchedAt?'retrieved '+point.receipt.fetchedAt.slice(0,10):'date not recorded')))];
  return 'AI Stats · '+metricName+' · '+sources.join(' · ');
}
export async function downloadChartPng(svg:SVGSVGElement,caption:string){
  const clone=svg.cloneNode(true) as SVGSVGElement;
  const original=[svg,...Array.from(svg.querySelectorAll('*'))];
  const copied=[clone,...Array.from(clone.querySelectorAll('*'))];
  const properties=['fill','stroke','stroke-width','font-family','font-size','font-weight','opacity'];
  original.forEach((node,index)=>{
    const styles=getComputedStyle(node);
    properties.forEach(property=>(copied[index] as SVGElement).style.setProperty(property,styles.getPropertyValue(property)));
  });
  const rect=svg.getBoundingClientRect();const width=Math.max(800,Math.round(rect.width));const height=Math.round(width*rect.height/rect.width);
  const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  try{
    const image=new Image();image.src=url;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=(height+64)*2;
    const context=canvas.getContext('2d');if(!context)throw new Error('Image export unavailable');
    context.font='12px sans-serif';
    const lines:string[]=[];let line='';
    for(const word of caption.split(' ')){const next=line?line+' '+word:word;
      if(line&&context.measureText(next).width>width-40){lines.push(line);line=word;}else line=next;}
    if(line)lines.push(line);
    canvas.height=(height+40+lines.length*18)*2;
    context.scale(2,2);context.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--surface-0')||'#090b0d';
    context.fillRect(0,0,width,height+40+lines.length*18);context.drawImage(image,0,0,width,height);
    context.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--ink-0')||'#f2f1ea';
    context.font='12px sans-serif';lines.forEach((text,index)=>context.fillText(text,20,height+26+index*18));
    const link=document.createElement('a');link.download='ai-stats-comparison.png';link.href=canvas.toDataURL('image/png');link.click();
  }finally{URL.revokeObjectURL(url);}
}
