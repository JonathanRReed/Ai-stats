/** Keep only recorded scalar evaluation settings; missing is not an empty known configuration. */
export function normalizeEpochConditions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value).flatMap(([key, item]) => {
    if (!key.trim()) return [];
    if (typeof item === 'string' && item.trim()) return [[key, item.trim()]];
    if (typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))) return [[key, item]];
    return [];
  });
  return entries.length ? Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))) : null;
}

export function normalizeEpochEvaluationDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const day = value.slice(0, 10);
  const calendarTime = Date.parse(day + 'T00:00:00Z');
  return Number.isFinite(calendarTime) && new Date(calendarTime).toISOString().slice(0, 10) === day ? day : null;
}

export function normalizeEpochScoreUnit(value) {
  return value === 'percent' || value === 'fraction' ? value : 'native';
}

const SCORE_COLUMNS = [
  'mean_score', 'Best score (across scorers)', 'Percent correct', 'Accuracy',
  'Accuracy mean', 'Average', 'Average score', 'Average progress', 'Average (%)',
  'Global average', 'Score', 'Score (AVG@5)', 'Pass@1 score', 'Challenge score',
  'EM', 'Overall accuracy', 'Overall pass (%)', 'Overall (no subtitles)',
  'Win Rate (%)', '% Score', '% Resolved', 'Unguided % Solved', 'Correct',
  'Time horizon', 'Arena Score', '120k token score', 'Performance', 'Overall score',
  'Mean score', 'Pass@1', 'GDP.pdf score', 'Main score', 'Overall', 'Score OPT@1',
  'ACW Avg Score', 'Mean capability', '0 token score', 'Dominance',
  'Binary accuracy', 'Pooled score',
];
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = value => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const cleaned = String(value).trim().replace(/,/g, '').replace(/%$/, '');
  if (!cleaned) return null;
  const result = Number(cleaned);
  return Number.isFinite(result) ? result : null;
};
/** @param {Record<string, unknown>} row @param {Record<string, unknown> | null} [metadata] */
export function getEpochScoreMetric(row, metadata = null) {
  const primary = text(metadata?.score_column);
  if (primary) return number(row[primary]) !== null ? primary : null;
  return SCORE_COLUMNS.find(key => number(row[key]) !== null) ?? null;
}
const CONDITION_KEYS = new Set([
  'edit format', 'temperature', 'harness', 'harness version', 'scorer', 'scorers',
  'shots', 'number of shots', 'few-shot', 'max tokens', 'max output tokens',
  'token budget', 'thinking budget', 'step budget', 'time budget',
  'prompt', 'prompting', 'prompt version', 'system prompt', 'seed', 'dataset',
  'dataset version', 'sampling', 'top p', 'top k', 'reasoning', 'reasoning effort',
  'reasoning level', 'thinking', 'tools', 'tool setting', 'tool use', 'agent',
  'agent org', 'agent version', 'version', 'livebench version', 'metr version', 'benchmark version', 'scaffold', 'settings', 'evaluation settings', 'run number',
]);

/** Normalize a single source row without selecting a winner among observations. */
export function normalizeEpochRecord(row, benchmarkSlug, context = {}) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const modelVersion = text(row['Model version']);
  const slug = text(benchmarkSlug);
  if (!modelVersion || !slug) return null;
  const metricKey = getEpochScoreMetric(row, context.metadata);
  const settings = Object.fromEntries(Object.entries(row).filter(([key]) =>
    key !== metricKey && !SCORE_COLUMNS.includes(key) && CONDITION_KEYS.has(key.trim().toLowerCase()) &&
    !key.startsWith('Training ') && !key.includes('Source')));
  const conditions = normalizeEpochConditions(settings);
  const canonicalRow = Object.fromEntries(Object.entries(row)
    .filter(([,value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)));
  const source = text(row['Source link']) ?? text(row['Source Link']) ?? text(row['Source link (site from table)']) ?? text(row.Source);
  let sourceUrl = null;
  if (source) {
    try { const url = new URL(source); if (url.protocol === 'https:' && !url.username && !url.password) sourceUrl = url.href; } catch { /* Unknown source stays absent. */ }
  }
  return {
    id: text(row.id) ?? `source:${slug}:${JSON.stringify(canonicalRow)}`,
    modelVersion, benchmarkSlug: slug, metricKey,
    value: metricKey ? number(row[metricKey]) : null,
    unit: getEpochStoredUnit(slug, metricKey, context.metadata),
    benchmarkVersion: getEpochBenchmarkVersion(row, slug, sourceUrl),
    conditions,
    evaluationDate: normalizeEpochEvaluationDate(row['Date of evaluation']),
    sourceUrl,
    fetchedAt: text(context.fetchedAt),
    snapshotId: text(context.snapshotId),
  };
}

/** The public artifact contains selected evidence, never the raw source payload. */
export function buildPublicEpochRun(run, benchmarkSlug, context = {}) {
  const observation = normalizeEpochRecord(run.raw, benchmarkSlug, context);
  return {
    id: run.epoch_run_id, model_version: run.model_version,
    benchmark_id: benchmarkSlug, benchmark_slug: benchmarkSlug,
    score: run.score, score_metric: run.score_metric,
    release_date: run.release_date ?? null, organization: run.organization ?? null,
    country: run.country ?? null, stderr: run.stderr ?? null,
    source_name: run.source_name ?? null, source_link: observation?.sourceUrl ?? null,
    conditions: observation?.conditions ?? null,
    evaluation_date: observation?.evaluationDate ?? null,
    score_unit: observation?.unit ?? 'native',
    benchmark_version: observation?.benchmarkVersion ?? null,
  };
}

/** Units come from the exact source schema, never the observed value's magnitude. */
export function getEpochStoredUnit(slug, metric, metadata = null) {
  if (metric && metric === text(metadata?.score_column)) {
    const scale = number(metadata.scale), ceiling = number(metadata.score_ceiling);
    if (ceiling === 1 && scale === 1) return 'fraction';
    if (ceiling === 1 && scale === 0.01) return 'percent';
    return 'native';
  }
  // Verified legacy contracts, for callers without the archive metadata.
  if (slug === 'aider_polyglot_external' && metric === 'Percent correct') return 'percent';
  if (slug === 'forecastbench_external' && metric === 'Overall score') return 'percent';
  return 'native';
}
export function getEpochBenchmarkVersion(row, slug, sourceUrl = null) {
  if (slug === 'terminalbench_external' && sourceUrl) {
    const match = new URL(sourceUrl).pathname.match(/\/leaderboard\/terminal-bench\/(\d+(?:\.\d+)+)/);
    if (match) return match[1];
  }
  if (slug === 'live_bench_external') return text(row['LiveBench Version']);
  if (slug === 'metr_time_horizons_external') return text(row['METR version']) ?? text(row.version) ?? text(row.Version);
  return text(row['Benchmark version']) ?? text(row['Dataset version']);
}

/** Source-provided display names are keyed only by the exact native version. */
export function normalizeEpochModelMetadata(row) {
 const version=text(row?.model_version);if(!version)return null;
 return {model_version:version,model_name:text(row.model_group)??version,
  display_name:text(row.display_name)??text(row.model_group)??version,
  organization:text(row.organization),country:text(row.country),model_accessibility:text(row.accessibility),
  release_date:text(row.date),training_compute_flop:number(row.training_compute_flop),
  eci_score:null,training_compute_confidence:null,description:null};
}
