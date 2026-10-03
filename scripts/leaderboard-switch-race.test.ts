import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';

// Exercise the actual inline swap routine with a controllable animation clock.
// Removing the stale-selection guard must reproduce the production A -> B -> A failure.
const source=readFileSync(new URL('../src/components/Dashboard.astro',import.meta.url),'utf8');
const routine=source.slice(source.indexOf('const swapLeaderboardMetric ='),source.indexOf('metricSelect?.addEventListener("change"'));
function harness(reduced=false){
 class Panel{
  dataset:{metric:string};hidden:boolean;isConnected=true;offsetWidth=100;
  classes=new Set<string>();
  classList={add:(...names:string[])=>names.forEach(n=>this.classes.add(n)),remove:(...names:string[])=>names.forEach(n=>this.classes.delete(n))};
  constructor(metric:string){this.dataset={metric};this.hidden=metric!=='a';}
 }
 const panels=['a','b','c'].map(x=>new Panel(x));
 const select={value:'a'};const callbacks:Array<()=>void>=[];
 const swap=new Function('document','HTMLElement','metricSelect','prefersReducedMotion','playBarFill','onceAfterFade','FAILSAFE_METRIC_SWAP_MS',routine+';return swapLeaderboardMetric;')(
  {querySelectorAll:()=>panels},Panel,select,()=>reduced,()=>{},(_el:Panel,_ms:number,cb:()=>void)=>callbacks.push(cb),320
 );
 return {panels,callbacks,choose:(metric:string)=>{select.value=metric;swap(metric);},visible:()=>panels.filter(p=>!p.hidden).map(p=>p.dataset.metric)};
}
test('returning to the visible benchmark cancels an older pending fade',()=>{
 const h=harness();h.choose('b');h.choose('a');h.callbacks.forEach(cb=>cb());
 expect(h.visible()).toEqual(['a']);
});
test('out-of-order fade completion cannot restore an older benchmark',()=>{
 const h=harness();h.choose('b');h.choose('c');[...h.callbacks].reverse().forEach(cb=>cb());
 expect(h.visible()).toEqual(['c']);
});
test('a refresh replacing panels makes pending animation callbacks harmless',()=>{
 const h=harness();h.choose('b');h.panels.forEach(p=>p.isConnected=false);h.callbacks.forEach(cb=>cb());
 expect(h.visible()).toEqual(['a']);
});
test('reduced motion changes the selected benchmark immediately',()=>{
 const h=harness(true);h.choose('b');expect(h.visible()).toEqual(['b']);h.choose('c');expect(h.visible()).toEqual(['c']);
});
