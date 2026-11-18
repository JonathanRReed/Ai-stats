export type PlotPoint={id:string;x:number;y:number};
/** A visitor-chosen window in value space; either axis may be left to the data. */
export type PlotZoom={x?:[number,number];y?:[number,number]};
export const formatChartNumber=(value:number)=>Math.abs(value)>=1e6||(value!==0&&Math.abs(value)<.001)
  ?value.toExponential(1):new Intl.NumberFormat('en-US',Math.abs(value)<1?{maximumSignificantDigits:4}:{maximumFractionDigits:2}).format(value);
export function plotGeometry<T extends PlotPoint>(points:T[],kind:'scatter'|'bars',scale:'linear'|'log',width=1000,height=520,topPadding=20,rightPadding=24,leftPadding=70,zoom?:PlotZoom|null){
  const left=leftPadding,right=Math.max(left+100,width-rightPadding),top=topPadding,bottom=Math.max(top+100,height-66);
  // Nonpositive coordinates never enter log geometry (no epsilon / Number.MIN_VALUE clamp).
  const logX=kind==='scatter'&&scale==='log',logY=kind==='bars'&&scale==='log';
  const finite=points.filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)&&(!logX||point.x>0)&&(!logY||point.y>0));
  const niceStep=(span:number)=>{
    const rough=span/5;if(!Number.isFinite(rough)||rough<=0)return 1;
    const power=10**Math.floor(Math.log10(rough));const ratio=rough/power;
    return (ratio<=1.5?1:ratio<=3?2:ratio<=7?5:10)*power;
  };
  // Linear axes use value-space domains. Log axes use EXPONENT domains, so every
  // finite positive double (including subnormals and values near Number.MAX_VALUE) maps
  // exactly, with no epsilon or 1e±300 clamp and no overflow when forming 10**exponent.
  const linearDomain=(values:number[]):[number,number]=>{
    const usable=values.filter(value=>Number.isFinite(value));
    if(!usable.length)return [0,1];
    const min=Math.min(0,...usable);let max=Math.max(0,...usable);
    if(min===max)max=min+1;
    else {const padded=max+(max-min)*.08;max=Number.isFinite(padded)?padded:max;}
    const step=niceStep(max-min);
    return [Math.floor(min/step)*step,Math.ceil(max/step)*step];
  };
  const logDomain=(values:number[]):[number,number]=>{
    const usable=values.filter(value=>Number.isFinite(value)&&value>0);
    if(!usable.length)return [0,1];
    let low=Math.floor(Math.log10(Math.min(...usable))),high=Math.ceil(Math.log10(Math.max(...usable)));
    if(low===high){low-=1;high+=1;}
    else if(high-low<=12&&low>=-300&&high<=300&&Math.min(...usable)!==Math.max(...usable)){
      const min=Math.log10(Math.min(...usable)),max=Math.log10(Math.max(...usable));
      const steps=[0,Math.log10(2),Math.log10(5)];
      const candidates=[];
      for(let exponent=low;exponent<=high;exponent++)for(const step of steps)candidates.push(exponent+step);
      low=Math.max(...candidates.filter(value=>value<=min));
      high=Math.min(...candidates.filter(value=>value>=max));
    }
    return [low,high];
  };
  // A zoom window replaces the data-derived domain. Log windows need a positive, finite, non-empty span.
  const windowFor=(range:[number,number]|undefined,log:boolean):[number,number]|null=>{
    if(!range||!range.every(Number.isFinite)||range[0]===range[1])return null;
    const low=Math.min(...range),high=Math.max(...range);
    if(!log)return [low,high];
    return low>0?[Math.log10(low),Math.log10(high)]:null;
  };
  const xDomain=windowFor(zoom?.x,logX)??(logX?logDomain(finite.map(point=>point.x)):linearDomain(finite.map(point=>point.x)));
  const yDomain=windowFor(zoom?.y,logY)??(logY?logDomain(finite.map(point=>point.y)):linearDomain(finite.map(point=>point.y)));
  const fraction=(value:number,[min,max]:[number,number],log:boolean)=>{
    if(log)return (Math.log10(value)-min)/(max-min);
    const magnitude=Math.max(Math.abs(min),Math.abs(max),1);
    return (value/magnitude-min/magnitude)/(max/magnitude-min/magnitude);
  };
  const exponentFraction=(exponent:number,[min,max]:[number,number])=>(exponent-min)/(max-min);
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
  const ticks=(range:[number,number],log:boolean,axis:'x'|'y')=>{
    if(log){
      const step=Math.max(1,Math.ceil((range[1]-range[0])/10)),result=[];
      const exponents:number[]=[];
      if(range[1]-range[0]<=12){
        for(let exponent=Math.floor(range[0]);exponent<=Math.ceil(range[1]);exponent++){
          for(const multiplier of (range[1]-range[0]<3&&(range[1]-range[0]<2||range.some(value=>!Number.isInteger(value)))&&range[0]>=-300&&range[1]<=300?[1,2,5]:[1])){
            const value=exponent+Math.log10(multiplier);
            if(value>=range[0]-1e-12&&value<=range[1]+1e-12)exponents.push(value);
          }
        }
      }else for(let exponent=range[0];exponent<=range[1];exponent+=step)exponents.push(exponent);
      for(const exponent of exponents){
        const at=exponentFraction(exponent,range);
        result.push({value:10**exponent,label:Math.abs(exponent)>300?'1e'+exponent:formatChartNumber(10**exponent),
          position:axis==='x'?left+at*(right-left):bottom-at*(bottom-top)});
      }
      return result;
    }
    const values:number[]=[];
    const step=niceStep(range[1]-range[0]);
    // Start on a multiple of the step so a zoom window still gets round tick values.
    const first=Math.ceil(range[0]/step-1e-9)*step;
    for(let index=0;index<=20;index++){const value=Number((first+index*step).toPrecision(12));if(value>range[1]+step*1e-9)break;values.push(value);}
    return values.map(value=>({value,label:formatChartNumber(value),position:axis==='x'?px(value):py(value)}));
  };
  // Pixel to value, for drag interactions. Clamped to the plot so a drag cannot leave the axis.
  const valueAt=(pixel:number,start:number,end:number,domain:[number,number],log:boolean)=>{
    const at=Math.min(1,Math.max(0,(pixel-start)/(end-start)));
    const raw=domain[0]+at*(domain[1]-domain[0]);
    return log?10**raw:raw;
  };
  return {width,height,left,right,top,bottom,points:plotted,logX,logY,
    xValueAt:(pixel:number)=>valueAt(pixel,left,right,xDomain,logX),
    yValueAt:(pixel:number)=>valueAt(pixel,bottom,top,yDomain,logY),
    xPixel:px,yPixel:py,
    xRange:(logX?[10**xDomain[0],10**xDomain[1]]:xDomain) as [number,number],
    yRange:(logY?[10**yDomain[0],10**yDomain[1]]:yDomain) as [number,number],
    xTicks:ticks(xDomain,logX,'x'),
    yTicks:ticks(yDomain,logY,'y'),
    baseline:logY?bottom:py(0)};
}
