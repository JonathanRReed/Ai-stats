export type PlotPoint={id:string;x:number;y:number};
export const formatChartNumber=(value:number)=>Math.abs(value)>=1e6||(value!==0&&Math.abs(value)<.001)
  ?value.toExponential(1):new Intl.NumberFormat('en-US',Math.abs(value)<1?{maximumSignificantDigits:4}:{maximumFractionDigits:2}).format(value);
export function plotGeometry<T extends PlotPoint>(points:T[],kind:'scatter'|'bars',scale:'linear'|'log',width=1000,height=520,topPadding=20,rightPadding=24){
  const left=70,right=Math.max(left+100,width-rightPadding),top=topPadding,bottom=Math.max(top+100,height-66);
  // Nonpositive coordinates never enter log geometry (no epsilon / Number.MIN_VALUE clamp).
  const logX=kind==='scatter'&&scale==='log',logY=kind==='bars'&&scale==='log';
  const finite=points.filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)&&(!logX||point.x>0)&&(!logY||point.y>0));
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
      // Keep powers inside a safe finite band so tick loops and log10 math never overflow to Infinity/NaN.
      const logMax=1e300;
      min=Math.min(Math.max(min,1e-300),logMax);
      max=Math.min(Math.max(max,min),logMax);
      min=10**Math.floor(Math.log10(min));
      max=10**Math.ceil(Math.log10(max));
      if(!Number.isFinite(min)||min<=0)min=1e-300;
      if(!Number.isFinite(max)||max<=0)max=10;
      max=Math.min(max,logMax);
      if(min>=max){min=Math.max(min/10,1e-300);max=Math.min(Math.max(max*10,min*10),logMax);}
    }else{
      if(min===max)max=min+1;
      else {const padded=max+(max-min)*.08;max=Number.isFinite(padded)?padded:max;}
    }
    if(!log){const step=niceStep(max-min);min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;}
    return [min,max];
  };
  const xDomain=domain(finite.map(point=>point.x),logX);
  const yDomain=domain(finite.map(point=>point.y),logY);
  const fraction=(value:number,[min,max]:[number,number],log:boolean)=>{
    if(log){
      if(!(value>0)||!(min>0)||!(max>0)||min===max)return 0;
      const start=Math.log10(min),end=Math.log10(max),at=Math.log10(Math.min(value,max));
      if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(at)||end===start)return 0;
      return (at-start)/(end-start);
    }
    const magnitude=Math.max(Math.abs(min),Math.abs(max),1);
    return (value/magnitude-min/magnitude)/(max/magnitude-min/magnitude);
  };
  const px=(value:number)=>left+fraction(value,xDomain,logX)*(right-left);
  const py=(value:number)=>bottom-fraction(value,yDomain,logY)*(bottom-top);
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
      const start=Math.ceil(Math.log10(range[0])),end=Math.floor(Math.log10(range[1]));
      if(Number.isFinite(start)&&Number.isFinite(end)){
        for(let exponent=start;exponent<=end&&exponent-start<400;exponent++){
          const value=10**exponent;if(Number.isFinite(value))values.push(value);
        }
      }
    }else{
      const step=niceStep(range[1]-range[0]);const count=Math.min(20,Math.round((range[1]-range[0])/step));
      for(let index=0;index<=count;index++)values.push(Number((range[0]+index*step).toPrecision(12)));
    }
    return values.map(value=>({value,label:formatChartNumber(value),position:position(value)}));
  };
  return {width,height,left,right,top,bottom,points:plotted,
    xTicks:ticks(xDomain,logX,px),
    yTicks:ticks(yDomain,logY,py),
    baseline:py(logY?yDomain[0]:0)};
}
