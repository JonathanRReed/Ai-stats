import {expect,test} from 'bun:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import CompareExplorer from '../components/compare/CompareExplorer';
import ModelSelector from '../components/compare/ModelSelector';
import OverviewExplorer from '../components/compare/OverviewExplorer';
import {compactCatalog,expandCatalog} from './compare-delivery';
import {availableCompareCharts,availableAaMetrics,buildComparePresets} from './compare-presets';
import {browseRankingFor} from './compare-browse-rank';
import type {ExplorerModel} from './compare-series';

const aa=(id:string,family:string,intelligence:number,extra:Partial<ExplorerModel>={}):ExplorerModel=>({id,name:family,family,provider:'Lab',source:'aa',sourceModelId:id,current:true,
 intelligence,aaTaskCost:1,priceBlended:1,indexVersion:'4.3',...extra});
// Alphabetical order (A.X-K2, Agnes, Apertus…) is the opposite of measured strength here.
const rows=[aa('ax','A.X-K2',10),aa('agnes','Agnes',20),aa('apertus','Apertus',30),aa('sonnet','Claude Sonnet 5.5',95),aa('fable','Claude Fable 5.1',90),aa('astra','GPT-6 Astra',85),aa('seed','Seed',1)];
const deliveryFor=(catalog=compactCatalog(rows))=>({catalog,revision:'r',charts:availableCompareCharts(rows),aaMetrics:availableAaMetrics(rows),presets:buildComparePresets(rows)});
const listed=(html:string)=>['A.X-K2','Agnes','Apertus','Claude Sonnet 5.5','Claude Fable 5.1','GPT-6 Astra'].map(name=>[name,html.indexOf('>'+name+'<')] as const).filter(([,at])=>at>=0).sort((a,b)=>a[1]-b[1]).map(([name])=>name);

test('server render lists Recommended families by measured rank with a stated basis',()=>{
 const html=renderToStaticMarkup(createElement(CompareExplorer,{models:[rows[6]],benchmarks:[],defaultModelIds:['seed'],delivery:deliveryFor()}));
 expect(html).toContain('<option value="recommend" selected="">Recommended</option>');
 expect(html).toContain('Ranked by AA Intelligence Index');
 expect(listed(html).slice(0,3)).toEqual(['Claude Sonnet 5.5','Claude Fable 5.1','GPT-6 Astra']);
});

test('a release without rank metadata shows Alphabetical, never a Recommended label over an alphabetical list',()=>{
 const legacy=compactCatalog(rows);delete legacy.browseRanks;
 const html=renderToStaticMarkup(createElement(CompareExplorer,{models:[rows[6]],benchmarks:[],defaultModelIds:['seed'],delivery:deliveryFor(legacy)}));
 expect(html).toContain('<option value="recommend" disabled="">Recommended (unavailable here)</option>');
 expect(html).toContain('<option value="alpha" selected="">Alphabetical</option>');
 expect(html).toContain('Ranking metadata is unavailable for this data release.');
 expect(listed(html).slice(0,3)).toEqual(['A.X-K2','Agnes','Apertus']);
});

test('controlled sort is shared: the same props render the same order in rail and dialog instances',()=>{
 const catalog=compactCatalog(rows),models=expandCatalog(catalog);
 const ranking=browseRankingFor({models,ranks:catalog.browseRanks,chart:'task-cost',metricId:'aa_intelligence_index'});
 const props={models,selected:[],suggestedIds:[],includeHistory:false,chart:'task-cost',metricId:'aa_intelligence_index',onHistory:()=>{},reasoningEfforts:[],onReasoning:()=>{},
  onToggle:()=>{},onToggleFamily:()=>{},onReset:()=>{},onSuggested:()=>{},presets:[],onPreset:()=>{},query:'',onQuery:()=>{},browseOrder:ranking.keys,browseBasis:ranking.basis,onBrowseSort:()=>{}};
 const rail=renderToStaticMarkup(createElement(ModelSelector,{...props,browseSort:'alpha'}));
 const dialog=renderToStaticMarkup(createElement(ModelSelector,{...props,browseSort:'alpha'}));
 expect(listed(rail)).toEqual(listed(dialog));
 expect(listed(rail).slice(0,3)).toEqual(['A.X-K2','Agnes','Apertus']);
 expect(rail).toContain('Alphabetical order.');
 const recommended=renderToStaticMarkup(createElement(ModelSelector,{...props,browseSort:'recommend'}));
 expect(listed(recommended).slice(0,3)).toEqual(['Claude Sonnet 5.5','Claude Fable 5.1','GPT-6 Astra']);
});

test('homepage all-zero Log says nothing can be drawn, counts only plottable records and offers Linear',()=>{
 const zeros=[aa('z1','Zero One',70,{aaTaskCost:0,priceBlended:0,performancePrompt:'long'}),aa('z2','Zero Two',60,{aaTaskCost:0,priceBlended:0,performancePrompt:'long'})];
 const html=renderToStaticMarkup(createElement(OverviewExplorer,{models:zeros,suggestions:{'task-cost:4.3':['z1','z2']}}));
 expect(html).toContain('Nothing to plot on Log');
 expect(html).not.toContain('No comparable measurements selected');
 expect(html).toContain('<dt>Plotted for these axes</dt><dd>0</dd>');
 expect(html).toContain('0 of 0 plotted points');
 expect(html).toContain('2 selected observations are not plotted on Log');
 expect(html).toContain('Zero One: 0');
 expect((html.match(/Show all on Linear/g)??[]).length).toBeGreaterThanOrEqual(2);
});

test('homepage mixed Log counts exclude omitted records',()=>{
 const mixed=[aa('z1','Zero One',70,{aaTaskCost:0,priceBlended:0}),aa('p1','Paid One',60,{aaTaskCost:2,priceBlended:2})];
 const html=renderToStaticMarkup(createElement(OverviewExplorer,{models:mixed,suggestions:{'task-cost:4.3':['z1','p1']}}));
 expect(html).toContain('<dt>Plotted for these axes</dt><dd>1</dd>');
 expect(html).toContain('1 of 1 plotted points');
 expect(html).toContain('1 measured record is not plotted on Log.');
});
