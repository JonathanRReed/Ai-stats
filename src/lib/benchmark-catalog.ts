import type { EpochBenchmark, EpochBenchmarkRun } from './supabase';

export type BenchmarkAttribution = {
  sourceName: string;
  sourceUrl: string;
  viaName?: string;
  viaUrl?: string;
  license?: string;
};

export const VALUABLE_FREE_BENCHMARK_SLUGS = [
  'gpqa_diamond',
  'frontiermath',
  'frontiermath_tier_4',
  'swe_bench_verified',
  'terminalbench_external',
  'aider_polyglot_external',
  'hle_external',
  'simplebench_external',
  'simpleqa_verified',
  'mmlu_external',
  'math_level_5',
  'otis_mock_aime_2024_2025',
  'arc_agi_2_external',
  'arc_agi_external',
  'live_bench_external',
  'webdev_arena_external',
  'cybench_external',
  'os_world_external',
  'gdpval_external',
  'video_mme_external',
  'metr_time_horizons_external',
  'apex_agents_external',
  'the_agent_company_external',
  'balrog_external',
  'deepresearchbench_external',
  'weirdml_external',
] as const;

export const VALUABLE_FREE_BENCHMARK_SET = new Set<string>(
  VALUABLE_FREE_BENCHMARK_SLUGS,
);

export const getEpochBenchmarksWithRuns = (
  benchmarks: EpochBenchmark[],
  runs: EpochBenchmarkRun[],
): EpochBenchmark[] => {
  const slugsWithRuns = new Set(
    runs
      .filter((run) => run.benchmark_slug && run.score !== null)
      .map((run) => String(run.benchmark_slug)),
  );

  return sortEpochBenchmarksByValue(
    benchmarks.filter((benchmark) => slugsWithRuns.has(benchmark.slug)),
  );
};

export const sortEpochBenchmarksByValue = (
  benchmarks: EpochBenchmark[],
): EpochBenchmark[] => {
  const rank = new Map<string, number>(
    VALUABLE_FREE_BENCHMARK_SLUGS.map((slug, index) => [slug, index]),
  );

  return [...benchmarks].sort((a, b) => {
    const aRank = rank.get(a.slug) ?? Number.POSITIVE_INFINITY;
    const bRank = rank.get(b.slug) ?? Number.POSITIVE_INFINITY;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name);
  });
};

export const EPOCH_BENCHMARK_LABELS: Record<string, string> = {
  adversarial_nli_external: 'Adversarial NLI',
  aider_polyglot_external: 'Aider Polyglot',
  apex_agents_external: 'APEX-Agents',
  arc_agi_2_external: 'ARC-AGI-2',
  arc_agi_external: 'ARC-AGI',
  arc_ai2_external: 'ARC-AI2',
  balrog_external: 'BALROG',
  bbh_external: 'Big-Bench Hard',
  bool_q_external: 'BoolQ',
  cad_eval_external: 'CAD Eval',
  chess_puzzles: 'Chess Puzzles',
  common_sense_qa_2_external: 'CommonsenseQA 2',
  cybench_external: 'CyBench',
  deepresearchbench_external: 'DeepResearchBench',
  fictionlivebench_external: 'FictionLiveBench',
  frontiermath: 'FrontierMath',
  frontiermath_tier_4: 'FrontierMath Tier 4',
  gdpval_external: 'GDPval',
  geobench_external: 'GeoBench',
  gpqa_diamond: 'GPQA Diamond',
  gsm8k_external: 'GSM8K',
  gso_external: 'GSO',
  hella_swag_external: 'HellaSwag',
  hle_external: 'HLE',
  lambada_external: 'LAMBADA',
  lech_mazur_writing_external: 'Lech Mazur Writing',
  live_bench_external: 'LiveBench',
  math_level_5: 'MATH Level 5',
  metr_time_horizons_external: 'METR Time Horizons',
  mmlu_external: 'MMLU',
  open_book_qa_external: 'OpenBookQA',
  os_world_external: 'OSWorld',
  otis_mock_aime_2024_2025: 'OTIS Mock AIME 2024-2025',
  piqa_external: 'PIQA',
  posttrainbench_external: 'PostTrainBench',
  science_qa_external: 'ScienceQA',
  simplebench_external: 'SimpleBench',
  simpleqa_verified: 'SimpleQA Verified',
  superglue_external: 'SuperGLUE',
  swe_bench_bash: 'SWE-bench Bash',
  swe_bench_verified: 'SWE-bench Verified',
  terminalbench_external: 'TerminalBench',
  the_agent_company_external: 'The Agent Company',
  trivia_qa_external: 'TriviaQA',
  video_mme_external: 'Video-MME',
  vpct_external: 'VPCT',
  webdev_arena_external: 'WebDev Arena',
  weirdml_external: 'WeirdML',
  wino_grande_external: 'WinoGrande',
};

export const getEpochBenchmarkLabel = (benchmark: EpochBenchmark): string =>
  EPOCH_BENCHMARK_LABELS[benchmark.slug] ?? benchmark.name;

export const AA_BENCHMARK_ATTRIBUTION: BenchmarkAttribution = {
  sourceName: 'Artificial Analysis',
  sourceUrl: 'https://artificialanalysis.ai/',
};

export const EPOCH_BENCHMARK_ATTRIBUTION: BenchmarkAttribution = {
  sourceName: 'Epoch AI Benchmarking Hub',
  sourceUrl: 'https://epoch.ai/benchmarks',
  license: 'CC BY, with Apache 2.0 for Aider Polyglot and Terminal-Bench subsets',
};

const EPOCH_SOURCE_FALLBACKS: Record<string, BenchmarkAttribution> = {
  aider_polyglot_external: {
    sourceName: 'Aider LLM Leaderboards',
    sourceUrl: 'https://aider.chat/docs/leaderboards/#polyglot-leaderboard',
    viaName: 'Epoch AI Benchmarking Hub',
    viaUrl: 'https://epoch.ai/benchmarks',
    license: 'Apache 2.0 subset via Epoch export',
  },
  arc_agi_2_external: {
    sourceName: 'ARC Prize, ARC-AGI-2',
    sourceUrl: 'https://arcprize.org/leaderboard',
    viaName: 'Epoch AI Benchmarking Hub',
    viaUrl: 'https://epoch.ai/benchmarks',
  },
  arc_agi_external: {
    sourceName: 'ARC Prize, ARC-AGI',
    sourceUrl: 'https://arcprize.org/leaderboard',
    viaName: 'Epoch AI Benchmarking Hub',
    viaUrl: 'https://epoch.ai/benchmarks',
  },
  frontiermath: {
    sourceName: 'Epoch AI FrontierMath',
    sourceUrl: 'https://epoch.ai/benchmarks/frontiermath',
    viaName: 'Epoch AI Benchmarking Hub',
    viaUrl: 'https://epoch.ai/benchmarks',
  },
  frontiermath_tier_4: {
    sourceName: 'Epoch AI FrontierMath',
    sourceUrl: 'https://epoch.ai/benchmarks/frontiermath',
    viaName: 'Epoch AI Benchmarking Hub',
    viaUrl: 'https://epoch.ai/benchmarks',
  },
  hle_external: {
    sourceName: "Humanity's Last Exam",
    sourceUrl: 'https://labs.scale.com/leaderboard/humanitys_last_exam',
    viaName: 'Epoch AI Benchmarking Hub',
    viaUrl: 'https://epoch.ai/benchmarks',
  },
  simplebench_external: {
    sourceName: 'SimpleBench Leaderboard',
    sourceUrl: 'https://simple-bench.com/',
    viaName: 'Epoch AI Benchmarking Hub',
    viaUrl: 'https://epoch.ai/benchmarks',
  },
  swe_bench_verified: {
    sourceName: 'SWE-bench Verified',
    sourceUrl: 'https://www.swebench.com/verified.html',
    viaName: 'Epoch AI Benchmarking Hub',
    viaUrl: 'https://epoch.ai/benchmarks',
  },
  terminalbench_external: {
    sourceName: 'Terminal-Bench Leaderboard',
    sourceUrl: 'https://www.tbench.ai/leaderboard/terminal-bench/2.0',
    viaName: 'Epoch AI Benchmarking Hub',
    viaUrl: 'https://epoch.ai/benchmarks',
    license: 'Apache 2.0 subset via Epoch export',
  },
  webdev_arena_external: {
    sourceName: 'WebDev Arena Leaderboard',
    sourceUrl: 'https://web.lmarena.ai/leaderboard',
    viaName: 'Epoch AI Benchmarking Hub',
    viaUrl: 'https://epoch.ai/benchmarks',
  },
};

const cleanSourceName = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const text = value.trim();
  if (!text || /^https?:\/\//u.test(text)) return null;
  return text;
};

const cleanSourceUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const text = value.trim();
  return /^https?:\/\//u.test(text) ? text : null;
};

export const getEpochBenchmarkAttribution = (
  benchmark: EpochBenchmark,
  runs: EpochBenchmarkRun[],
): BenchmarkAttribution => {
  const fallback = EPOCH_SOURCE_FALLBACKS[benchmark.slug];
  const sourceCounts = new Map<
    string,
    { sourceName: string | null; sourceUrl: string | null; count: number }
  >();

  runs
    .filter((run) => run.benchmark_slug === benchmark.slug)
    .forEach((run) => {
      const sourceUrl =
        cleanSourceUrl(run.source_link) ?? cleanSourceUrl(run.source_name);
      const sourceName = cleanSourceName(run.source_name);
      if (!sourceUrl && !sourceName) return;
      const key = `${sourceName ?? ''}|${sourceUrl ?? ''}`;
      const current = sourceCounts.get(key) ?? {
        sourceName,
        sourceUrl,
        count: 0,
      };
      current.count += 1;
      sourceCounts.set(key, current);
    });

  const rowSource = [...sourceCounts.values()]
    .filter((source) => source.sourceUrl || source.sourceName)
    .sort((a, b) => {
      if (Boolean(b.sourceUrl) !== Boolean(a.sourceUrl)) {
        return Number(Boolean(b.sourceUrl)) - Number(Boolean(a.sourceUrl));
      }
      return b.count - a.count;
    })[0];

  const label = getEpochBenchmarkLabel(benchmark);
  const sourceName =
    fallback?.sourceName ?? rowSource?.sourceName ?? `${label} source`;
  const sourceUrl =
    fallback?.sourceUrl ?? rowSource?.sourceUrl ?? EPOCH_BENCHMARK_ATTRIBUTION.sourceUrl;

  return {
    sourceName,
    sourceUrl,
    viaName: fallback?.viaName ?? EPOCH_BENCHMARK_ATTRIBUTION.sourceName,
    viaUrl: fallback?.viaUrl ?? EPOCH_BENCHMARK_ATTRIBUTION.sourceUrl,
    license: fallback?.license ?? EPOCH_BENCHMARK_ATTRIBUTION.license,
  };
};
