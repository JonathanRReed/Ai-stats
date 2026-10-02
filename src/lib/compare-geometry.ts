export type PlotPoint={id:string;x:number;y:number};
export const formatChartNumber=(value:number)=>Math.abs(value)>=1e6||(value!==0&&Math.abs(value)<.001)
  ?value.toExponential(1):new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
export function plotGeometry<T extends PlotPoint>(points:T[],kind:'scatter'|'bars',scale:'linear'|'log',width=1000,height=520,topPadding=20){
  const left=70,right=Math.max(left+100,width-24),top=topPadding,bottom=Math.max(top+100,height-66);
  const finite=points.filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y));
  const niceStep=(span:number)=>{
    const rough=span/5;if(!Number.isFinite(rough)||rough<=0)return 1;
    const power=10**Math.floor(Math.log10(rough));const ratio=rough/power;
    return (ratio<=1.5?1:ratio<=3?2:ratio<=7?5:10)*power;
  };
  const domain=(values:number[],log:boolean):[number,number]=>{
    const usable=values.filter(value=>Number.isFinite(value)&&(!log||value>0));
    if(!usable.length)return log?[1,10]:[0,1];
    let min=log?Math.min(...usable):Math.min(0,...usable);
    let max=log?Math.max(...usable):Math.max(0,...usable);
    if(log){
      min=Math.max(Number.MIN_VALUE,10**Math.floor(Math.log10(min)));
      max=Math.min(Number.MAX_VALUE,10**Math.ceil(Math.log10(max)));
      if(min===max){min=Math.max(Number.MIN_VALUE,min/10);max=Math.min(Number.MAX_VALUE,max*10);}
    }else{
      if(min===max)max=min+1;
      else {const padded=max+(max-min)*.08;max=Number.isFinite(padded)?padded:max;}
    }
    if(!log){const step=niceStep(max-min);min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;}
    return [min,max];
  };
  const xDomain=domain(finite.map(point=>point.x),kind==='scatter'&&scale==='log');
  const yDomain=domain(finite.map(point=>point.y),kind==='bars'&&scale==='log');
  const fraction=(value:number,[min,max]:[number,number],log:boolean)=>{
    if(log)return (Math.log10(Math.max(value,Number.MIN_VALUE))-Math.log10(min))/(Math.log10(max)-Math.log10(min));
    const magnitude=Math.max(Math.abs(min),Math.abs(max),1);
    return (value/magnitude-min/magnitude)/(max/magnitude-min/magnitude);
  };
  const px=(value:number)=>left+fraction(value,xDomain,kind==='scatter'&&scale==='log')*(right-left);
  const py=(value:number)=>bottom-fraction(value,yDomain,kind==='bars'&&scale==='log')*(bottom-top);
  const groups=[...new Set(finite.map(point=>point.x))].sort((a,b)=>a-b);
  const band=(right-left)/Math.max(groups.length,1);
  const plotted=finite.map(point=>{
    const peers=finite.filter(other=>other.x===point.x);
    const peerIndex=peers.findIndex(other=>other.id===point.id);
    const barWidth=Math.min(72,band*.72/Math.max(peers.length,1));
    return {...point,cx:kind==='scatter'?px(point.x):left+(groups.indexOf(point.x)+.5)*band+
      (peerIndex-(peers.length-1)/2)*barWidth,cy:py(point.y),barWidth,visibleBarWidth:Math.max(barWidth*.55,barWidth-2)};
  });
  const ticks=(range:[number,number],log:boolean,position:(value:number)=>number)=>{
    const values:number[]=[];
    if(log){
      for(let exponent=Math.ceil(Math.log10(range[0]));exponent<=Math.floor(Math.log10(range[1]));exponent++)values.push(10**exponent);
    }else{
      const step=niceStep(range[1]-range[0]);const count=Math.min(20,Math.round((range[1]-range[0])/step));
      for(let index=0;index<=count;index++)values.push(Number((range[0]+index*step).toPrecision(12)));
    }
    return values.map(value=>({value,label:formatChartNumber(value),position:position(value)}));
  };
  return {width,height,left,right,top,bottom,points:plotted,
    xTicks:ticks(xDomain,kind==='scatter'&&scale==='log',px),
    yTicks:ticks(yDomain,kind==='bars'&&scale==='log',py),
    baseline:py(kind==='bars'&&scale==='log'?yDomain[0]:0)};
}
