import {getModelCatalogData} from './model-catalog-data';
import {getCompareReleaseManifest} from './compare-release-server';
import {getEpochBenchmarkLabel,getEpochBenchmarksWithRuns,preferPublisherBenchmarks} from './benchmark-catalog';

/** One leaderboard source for the rendered top rows and the on-demand full ranking. */
export async function getEpochLeaderboardSource(){
 const [catalog,release]=await Promise.all([getModelCatalogData(),getCompareReleaseManifest()]);
 const {epochBenchmarks,epochRuns,epochModels}=catalog.benchmarks;
 return {
  revision:release.datasetRevision,
  benchmarks:preferPublisherBenchmarks(getEpochBenchmarksWithRuns(epochBenchmarks,epochRuns)),
  runs:epochRuns,
  labels:Object.fromEntries(epochBenchmarks.map(benchmark=>[benchmark.slug,getEpochBenchmarkLabel(benchmark)])),
  modelNames:Object.fromEntries([
   ...epochModels.flatMap(model=>{const name=model.display_name?.trim()||model.model_name?.trim();return name?[[model.model_version,name] as const]:[];}),
   ...catalog.publishers.snapshots.flatMap(snapshot=>snapshot.records.map(row=>[row.systemId,row.label] as const)),
  ]),
 };
}
