import {getModels,getCompareCatalogSources,getCanonicalModels,getModelAliases,getIntelligenceSources,normalizeAaModelsForDisplay} from './supabase';
import {getEpochEvidence} from './epoch-evidence';
import {buildExplorerCatalog} from './compare-catalog';
async function load(){
 const [aaModels,epoch,catalogs,canonical,aliases,sources]=await Promise.all([
  getModels(true,true),getEpochEvidence(),getCompareCatalogSources(),getCanonicalModels(),getModelAliases(),getIntelligenceSources()
 ]);
 const records=buildExplorerCatalog(aaModels,epoch.epochModels,catalogs,{models:canonical,aliases,sources});
 const currentAaModels=normalizeAaModelsForDisplay(aaModels.filter(model=>model.current_source_member!==false));
 return {aaModels,currentAaModels,epoch,catalogs,canonical,aliases,sources,records};
}
let cached:ReturnType<typeof load>|undefined;
/** One immutable source inventory per server/build process; no per-visitor upstream calls. */
export const getModelCatalogData=()=>cached??=load();
