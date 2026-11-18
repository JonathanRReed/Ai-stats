import {buildBenchmarkCohorts,benchmarkRecordHref,benchmarkRunSettings} from './benchmark-leaderboard';
import {resolveEpochLeaderboardRunNames} from './epoch-model-display-name';
import {rankModelFamilies,type RankedModelFamily} from './model-family-ranking';
import type {AaModel,EpochBenchmark,EpochBenchmarkRun} from './supabase';

/**
 * Server-side data for the homepage Benchmarks leaderboard. Moved out of
 * Dashboard.astro unchanged: the first five ranked rows per metric, the total
 * ranked count, and the measured families behind each AA row.
 */

export type LeaderboardConfig = {key:string;label:string;source:'aa'|'epoch'};
/** A ranked row: an AA model record or a resolved Epoch/publisher run. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LeaderboardRow = any;

// Combined benchmark configs - AA benchmarks first, then Epoch benchmarks
export const AA_LEADERBOARD_CONFIGS: LeaderboardConfig[] = [
  { key: "mmlu_pro", label: "MMLU Pro", source: "aa" },
  { key: "gpqa", label: "GPQA", source: "aa" },
  { key: "hle", label: "HLE", source: "aa" },
  { key: "aime", label: "AIME", source: "aa" },
  { key: "scicode", label: "SciCode", source: "aa" },
  { key: "math_500", label: "Math 500", source: "aa" },
  { key: "livecodebench", label: "LiveCodeBench", source: "aa" },
  { key: "aa_math_index", label: "AA Math Index", source: "aa" },
  { key: "aa_coding_index", label: "AA Coding Index", source: "aa" },
  { key: "aa_agentic_index", label: "AA Agentic Index", source: "aa" },
  {
    key: "aa_intelligence_index",
    label: "AA Intelligence Index",
    source: "aa",
  },
];

export type DashboardLeaderboard = {
  availableBenchmarkConfigs: LeaderboardConfig[];
  defaultBenchmarkKey: string;
  topByBenchmark: Record<string, LeaderboardRow[]>;
  topBenchmarkTotals: Record<string, number>;
  modelFamiliesByBenchmark: Record<string, RankedModelFamily<AaModel>[]>;
  /** Each Epoch cohort key mapped to its benchmark's `epoch_<slug>` attribution key. */
  cohortAttributionKeys: Record<string, string>;
};

export function buildDashboardLeaderboard(
  currentMeasuredModels: AaModel[],
  epochBenchmarksWithRuns: EpochBenchmark[],
  epochRuns: EpochBenchmarkRun[],
  benchmarkModelNameRecord: Record<string, string>,
): DashboardLeaderboard {
  const benchmarkConfigs: LeaderboardConfig[] = [
    ...AA_LEADERBOARD_CONFIGS,
    ...epochBenchmarksWithRuns.flatMap(benchmark=>buildBenchmarkCohorts(benchmark,epochRuns).map(cohort=>({
      key:cohort.key,label:cohort.label,source:"epoch" as const,
    }))),
  ];

  const topByBenchmark: Record<string, LeaderboardRow[]> = {};
  const modelFamiliesByBenchmark: Record<string, RankedModelFamily<AaModel>[]> = {};
  const topBenchmarkTotals: Record<string, number> = {};
  const cohortAttributionKeys: Record<string, string> = {};

  // AA benchmarks - from the current measured cohort
  benchmarkConfigs
    .filter((c) => c.source === "aa")
    .forEach(({ key }) => {
      const families = rankModelFamilies(currentMeasuredModels, key);
      const allList = families.map((family) => family.best);
      const list = allList.slice(0,5);
      modelFamiliesByBenchmark[key] = families;
      topBenchmarkTotals[key] = allList.length;
      topByBenchmark[key] = list;
    });

  epochBenchmarksWithRuns.forEach((benchmark) => {
    const slug = benchmark.slug;
    buildBenchmarkCohorts(benchmark,epochRuns).forEach(cohort=>{
      cohortAttributionKeys[cohort.key]=`epoch_${slug}`;
      const allRuns = resolveEpochLeaderboardRunNames(cohort.runs, benchmarkModelNameRecord)
        .map((r) => ({
          name: r.name,
          company_name: r.organization,
          score: r.score,
          score_metric: r.score_metric,
          source_key: r.source_key,
          score_unit: r.score_unit ?? 'native',
          model_version: r.model_version,
          run_id: r.id,
          benchmark_version: r.benchmark_version ?? null,
          conditions: r.conditions ?? null,
          isEpoch: true,
          metric_key:cohort.metricKey,
          higher_is_better:cohort.higherIsBetter,
        }));
      const runs = allRuns.slice(0,5);
      topBenchmarkTotals[cohort.key] = allRuns.length;
      topByBenchmark[cohort.key] = runs;
    });
  });

  const availableBenchmarkConfigs = benchmarkConfigs.filter(
    ({key}) => (topByBenchmark[key]?.length ?? 0) > 0,
  );
  const defaultBenchmarkKey = availableBenchmarkConfigs.some(({key}) => key === "aa_intelligence_index")
    ? "aa_intelligence_index" : availableBenchmarkConfigs[0]?.key ?? "";

  return {availableBenchmarkConfigs,defaultBenchmarkKey,topByBenchmark,topBenchmarkTotals,modelFamiliesByBenchmark,cohortAttributionKeys};
}

export const formatEpochLeaderboardScore = (score: number, unit: string | undefined) => {
  if (unit === 'fraction') return `${(score * 100).toFixed(1)}%`;
  if (unit === 'percent') return `${score.toFixed(1)}%`;
  return score.toLocaleString('en-US', {maximumFractionDigits: 3});
};
export const epochRunHref = (model:LeaderboardRow,metric:string):string=>benchmarkRecordHref(model,model.metric_key??metric);
export const epochRunSettings = benchmarkRunSettings;
