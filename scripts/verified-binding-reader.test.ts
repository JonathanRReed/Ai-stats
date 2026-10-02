import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {buildVerifiedBindings} from '../src/lib/catalog-bindings';
test('query-filtered callers cannot hide duplicate AA owners from the binding guard',async()=>{
 const source=readFileSync('src/lib/supabase.ts','utf8');
 const body=source.slice(source.indexOf('export async function getVerifiedCatalogBindings'),source.indexOf('/** No name-based cross-source enrichment.'));
 const code=new Bun.Transpiler({loader:'ts'}).transformSync(body.replace('export async','async'))+';getVerifiedCatalogBindings;';
 const full=[{id:'old',slug:'same'},{id:'new',slug:'same'}];
 const native={canonical_model_id:1,intelligence_source_id:1,source_model_key:'same',match_method:'source_native',confidence:1,provenance:'Native'};
 const get=runInNewContext(code,{buildVerifiedBindings,getModels:async()=>full,
 getModelAliases:async()=>[native,{...native,intelligence_source_id:2,source_model_key:'lab/old',match_method:'explicit_cross_source'}],
 getIntelligenceSources:async()=>[{id:1,source_key:'artificial-analysis'},{id:2,source_key:'openrouter'}]});
 expect(await get([full[1]])).toEqual({});
});
