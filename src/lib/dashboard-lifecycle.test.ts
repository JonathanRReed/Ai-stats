import { expect, test } from 'bun:test';
import { bindDashboardLifecycle } from './dashboard-lifecycle';

class RoutedDocument extends EventTarget {
  root: Element | null = null;
  querySelector() { return this.root; }
}

test('Stats to Compare to Stats remounts metric, filters, catalog and row handlers once', () => {
  const routed = new RoutedDocument();
  const globalEvents = new EventTarget();
  const firstRoot = {} as Element;
  const compareRoot = {} as Element;
  const returnedRoot = {} as Element;
  const mounts: Element[] = [];
  const state = new Map<Element, { metric:string; filters:number; catalog:number; rows:number; refreshes:number }>();
  const continuations: Array<() => boolean> = [];
  const fire=(type:string,detail?:string)=>{const event=new Event(type);Object.assign(event,{detail});globalEvents.dispatchEvent(event);};

  routed.root = firstRoot;
  bindDashboardLifecycle(routed as unknown as Document, '#leaderboard-panels', (root, signal, isCurrent) => {
    mounts.push(root);
    state.set(root,{metric:'aa_intelligence_index',filters:0,catalog:0,rows:0,refreshes:0});
    const bind=(type:string,handler:()=>void)=>globalEvents.addEventListener(type,()=>{if(isCurrent())handler();},{signal});
    bind('metric-change',()=>{state.get(root)!.metric=(globalEvents as EventTarget & {lastDetail?:string}).lastDetail??'unknown';});
    bind('family-filter',()=>state.get(root)!.filters++);
    bind('catalog-control',()=>state.get(root)!.catalog++);
    bind('row-action',()=>state.get(root)!.rows++);
    bind('live-refresh',()=>state.get(root)!.refreshes++);
    continuations.push(isCurrent);
  });
  const metric=(value:string)=>{(globalEvents as EventTarget & {lastDetail?:string}).lastDetail=value;fire('metric-change',value);};
  metric('aa_coding_index');metric('aa_agentic_index');
  fire('family-filter');fire('catalog-control');fire('row-action');fire('live-refresh');
  expect(state.get(firstRoot)).toEqual({metric:'aa_agentic_index',filters:1,catalog:1,rows:1,refreshes:1});
  expect(continuations[0]()).toBe(true);

  routed.root = compareRoot;
  routed.dispatchEvent(new Event('astro:before-swap'));
  routed.dispatchEvent(new Event('astro:page-load'));
  metric('aa_coding_index');fire('family-filter');fire('catalog-control');fire('row-action');fire('live-refresh');
  expect(state.get(firstRoot)).toEqual({metric:'aa_agentic_index',filters:1,catalog:1,rows:1,refreshes:1});
  expect(state.get(compareRoot)).toEqual({metric:'aa_coding_index',filters:1,catalog:1,rows:1,refreshes:1});
  expect(continuations[0]()).toBe(false);
  expect(continuations[1]()).toBe(true);

  routed.root = returnedRoot;
  routed.dispatchEvent(new Event('astro:before-swap'));
  routed.dispatchEvent(new Event('astro:page-load'));
  routed.dispatchEvent(new Event('astro:page-load'));
  metric('aa_agentic_index');metric('aa_coding_index');fire('family-filter');fire('catalog-control');fire('row-action');fire('live-refresh');
  expect(mounts).toEqual([firstRoot, compareRoot, returnedRoot]);
  expect(state.get(returnedRoot)).toEqual({metric:'aa_coding_index',filters:1,catalog:1,rows:1,refreshes:1});
  expect(state.get(firstRoot)).toEqual({metric:'aa_agentic_index',filters:1,catalog:1,rows:1,refreshes:1});
  expect(state.get(compareRoot)).toEqual({metric:'aa_coding_index',filters:1,catalog:1,rows:1,refreshes:1});
  expect(continuations.map(isCurrent => isCurrent())).toEqual([false, false, true]);
});
