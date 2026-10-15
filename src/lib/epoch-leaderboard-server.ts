import {getModelCatalogData} from './model-catalog-data';
import {getEpochBenchmarkLabel,getEpochBenchmarksWithRuns,preferPublisherBenchmarks} from './benchmark-catalog';
import {withEpochRankingRevision} from './epoch-ranking-revision';

/**
 * One leaderboard source for the rendered top rows and the on-demand full ranking. Its revision
 * fingerprints the ranking content itself (not the compare manifest), so SSR and
 * /api/epoch-ranking/<revision>.json always agree and any ranked change gets a new URL.
 */
export async function getEpochLeaderboardSource(){
 const catalog=await getModelCatalogData();
 const {epochBenchmarks,epochRuns,epochModels}=catalog.benchmarks;
 return withEpochRankingRevision({
  benchmarks:preferPublisherBenchmarks(getEpochBenchmarksWithRuns(epochBenchmarks,epochRuns)),
  runs:epochRuns,
  labels:Object.fromEntries(epochBenchmarks.map(benchmark=>[benchmark.slug,getEpochBenchmarkLabel(benchmark)])),
  modelNames:Object.fromEntries([
   ...epochModels.flatMap(model=>{const name=model.display_name?.trim()||model.model_name?.trim();return name?[[model.model_version,name] as const]:[];}),
   ...catalog.publishers.snapshots.flatMap(snapshot=>snapshot.records.map(row=>[row.systemId,row.label] as const)),
  ]),
 });
}
