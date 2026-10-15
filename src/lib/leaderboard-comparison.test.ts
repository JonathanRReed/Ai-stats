import {expect,test} from 'bun:test';
import {benchmarkRecordHref} from './benchmark-leaderboard';
import {leaderboardComparisonHref,leaderboardRunCatalogRecord} from './leaderboard-comparison';

const catalog=[
 {id:'epoch:one',source:'epoch',sourceModelId:'one'},
 {id:'epoch:two',source:'epoch',sourceModelId:'two'},
 {id:'publisher:astra-codex',source:'publisher',sourceModelId:'astra-codex'},
 {id:'publisher:livebench-a',source:'publisher',sourceModelId:'livebench-a'},
 {id:'publisher:livebench-b',source:'publisher',sourceModelId:'livebench-b'},
 {id:'aa:model',source:'aa',sourceModelId:'aa-native'},
];
const epoch=(model_version:string,conditions:Record<string,unknown>|null={shots:1},benchmark_version='v2')=>benchmarkRecordHref({model_version,conditions,score_metric:'accuracy',score_unit:'percent',benchmark_version},'epoch_metr');
const publisher=(model_version:string,metric='epoch_publisher_livebench_2026_06_25')=>benchmarkRecordHref({source_key:'livebench',model_version,conditions:{aggregation:'equal category means'},score_metric:'Global Average',score_unit:'points',benchmark_version:'2026-06-25'},metric);

test('leaderboard link carries all displayed models from one Epoch score cohort and its condition',()=>{
 const href=leaderboardComparisonHref([epoch('one'),epoch('two')],catalog);
 const params=new URLSearchParams(href.split('?')[1]);
 expect(params.getAll('m')).toEqual(['epoch:one','epoch:two']);
 expect(params.get('condition')).toBe('[["shots",1]]');
 expect(params.get('score_metric')).toBe('["accuracy","percent","v2"]');
});

test('AA leaderboard link preserves the requested metric and exact model identity',()=>{
 const href=leaderboardComparisonHref(['/compare?'+new URLSearchParams({chart:'benchmark',metric:'aa_coding_index',m:'aa:model'}).toString()],catalog);
 const params=new URLSearchParams(href.split('?')[1]);
 expect(params.get('metric')).toBe('aa_coding_index');
 expect(params.getAll('m')).toEqual(['aa:model']);
});

test('mixed conditions remove the forced condition and mixed versions stay out of the selected cohort',()=>{
 const links=[epoch('one',{shots:1},'v2'),epoch('two',{shots:2},'v2'),epoch('one',{shots:1},'v1')];
 const params=new URLSearchParams(leaderboardComparisonHref(links,catalog).split('?')[1]);
 expect(params.getAll('m')).toEqual(['epoch:one','epoch:two']);
 expect(params.has('condition')).toBe(false);
 expect(params.get('score_metric')).toBe('["accuracy","percent","v2"]');
});

test('unresolved native records retain a useful source link as fallback',()=>{
 const href=leaderboardComparisonHref([epoch('missing')],catalog);
 const params=new URLSearchParams(href.split('?')[1]);
 expect(params.get('record')).toBe('missing');
 expect(params.get('metric')).toBe('epoch_metr');
});

test('large expanded leaderboards open only the first hundred displayed records',()=>{
 const many=Array.from({length:120},(_,index)=>`/compare?${new URLSearchParams({chart:'benchmark',metric:'aa_coding_index',m:`aa:${index}`})}`);
 const expandedCatalog=Array.from({length:120},(_,index)=>({id:`aa:${index}`,source:'aa',sourceModelId:`aa:${index}`}));
 const params=new URLSearchParams(leaderboardComparisonHref(many,expandedCatalog).split('?')[1]);
 expect(params.getAll('m')).toHaveLength(100);
 expect(params.getAll('m')[0]).toBe('aa:0');
 expect(params.getAll('m').at(-1)).toBe('aa:99');
});

test('shared identity conversion keeps publisher source across initial and rebuilt catalogs',()=>{
 expect(leaderboardRunCatalogRecord({source_key:'livebench',model_version:'livebench-a'})).toEqual({
  id:'publisher:livebench-a',source:'publisher',sourceModelId:'livebench-a',
 });
 expect(leaderboardRunCatalogRecord({model_version:'one'})).toEqual({
  id:'epoch:one',source:'epoch',sourceModelId:'one',
 });
 const rebuilt=[{source_key:'livebench',model_version:'livebench-a'},{source_key:'livebench',model_version:'livebench-b'}].map(leaderboardRunCatalogRecord);
 const href=leaderboardComparisonHref([publisher('livebench-a'),publisher('livebench-b')],rebuilt);
 const params=new URLSearchParams(href.split('?')[1]);
 expect(params.getAll('m')).toEqual(['publisher:livebench-a','publisher:livebench-b']);
 expect(params.get('source')).toBeNull();
 expect(params.get('record')).toBeNull();
});
