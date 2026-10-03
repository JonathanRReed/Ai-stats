import {getPublisherEvidence} from './publisher-evidence';
import {buildVerifiedBindings} from './catalog-bindings';
import {supabase,getModels,getCompareCatalogSources,getCanonicalModels,getModelAliases,getIntelligenceSources,normalizeAaModelsForDisplay} from './supabase';
import {getEpochEvidence} from './epoch-evidence';
import {EXPLORER_SOURCE_LABELS} from './compare-series';
import {buildExplorerCatalog} from './compare-catalog';
async function load(){
 const [aaModels,epoch,catalogs,canonical,aliases,sources,publishers]=await Promise.all([
  getModels(true,true),getEpochEvidence(),getCompareCatalogSources(),getCanonicalModels(),getModelAliases(),getIntelligenceSources(),getPublisherEvidence()
 ]);
 const records=[...buildExplorerCatalog(aaModels,epoch.epochModels,catalogs,{models:canonical,aliases,sources}),...publishers.models];
 const benchmarks={...epoch,epochBenchmarks:[...epoch.epochBenchmarks,...publishers.benchmarks],epochRuns:[...epoch.epochRuns,...publishers.runs]};
 const currentAaModels=normalizeAaModelsForDisplay(aaModels.filter(model=>model.current_source_member!==false));
 const bindings=buildVerifiedBindings(aaModels,aliases,sources);
 const unavailableSources=[
  ...catalogs.availability.filter(source=>!source.available).map(source=>EXPLORER_SOURCE_LABELS[source.sourceKey as keyof typeof EXPLORER_SOURCE_LABELS]),
  ...(supabase?[]:['Artificial Analysis','Database inventory']),...(epoch.fetchedAt?[]:['Epoch AI'])
 ];
 return {aaModels,currentAaModels,epoch,benchmarks,publishers,catalogs,canonical,aliases,sources,records,unavailableSources,bindings};
}
let cached:ReturnType<typeof load>|undefined;
/** One immutable source inventory per server/build process; no per-visitor upstream calls. */
export const getModelCatalogData=()=>cached??=load().catch(error=>{cached=undefined;throw error;});
