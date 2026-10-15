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
    else if(high-low<=12&&Math.min(...usable)!==Math.max(...usable)){
      const min=Math.log10(Math.min(...usable)),max=Math.log10(Math.max(...usable));
      const steps=[0,Math.log10(2),Math.log10(5)];
      const candidates=[];
      for(let exponent=low;exponent<=high;exponent++)for(const step of steps)candidates.push(exponent+step);
      low=Math.max(...candidates.filter(value=>value<=min));
      high=Math.min(...candidates.filter(value=>value>=max));
    }
    return [low,high];
  };
  const xDomain=logX?logDomain(finite.map(point=>point.x)):linearDomain(finite.map(point=>point.x));
  const yDomain=logY?logDomain(finite.map(point=>point.y)):linearDomain(finite.map(point=>point.y));
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
          for(const multiplier of (range[1]-range[0]<2?[1,2,5]:[1])){
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
    const step=niceStep(range[1]-range[0]);const count=Math.min(20,Math.round((range[1]-range[0])/step));
    for(let index=0;index<=count;index++)values.push(Number((range[0]+index*step).toPrecision(12)));
    return values.map(value=>({value,label:formatChartNumber(value),position:axis==='x'?px(value):py(value)}));
  };
  return {width,height,left,right,top,bottom,points:plotted,
    xTicks:ticks(xDomain,logX,'x'),
    yTicks:ticks(yDomain,logY,'y'),
    baseline:logY?bottom:py(0)};
}
