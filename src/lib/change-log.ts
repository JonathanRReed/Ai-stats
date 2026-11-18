/**
 * Pure builders for /changes and /changes.xml. Every entry comes from a recorded date:
 * a source's release date, AI Stats' first observation, an evaluation date, or the
 * retrieval timestamps of two committed snapshot versions. Nothing is interpolated.
 */
import type {FirstRecorded, ScoreRevision} from './change-log-diff';
import {benchmarkPath} from './site-routes';

export type ChangeKind = 'model-release' | 'model-added' | 'score-revised' | 'results-recorded' | 'result-evaluated' | 'source-refresh';

export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  'model-release': 'Model released',
  'model-added': 'Model added',
  'score-revised': 'Scores revised',
  'results-recorded': 'New results recorded',
  'result-evaluated': 'Result evaluated',
  'source-refresh': 'Sources retrieved',
};
const KIND_ORDER: ChangeKind[] = ['model-release', 'model-added', 'score-revised', 'results-recorded', 'result-evaluated', 'source-refresh'];

export type ChangeItem = {label: string; before?: string; after?: string; beforeDate?: string; afterDate?: string};

export type ChangeEntry = {
  id: string;
  /** UTC day, YYYY-MM-DD. */
  date: string;
  /** Most precise recorded time for the feed; a date-only source keeps midnight UTC. */
  timestamp: string;
  kind: ChangeKind;
  title: string;
  href: string | null;
  source: string;
  sourceUrl: string | null;
  summary: string;
  items?: ChangeItem[];
};

export type ChangeWindow = {start: string; end: string};

const day = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
};
const stamp = (value: string): string => {
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return new Date(time).toISOString();
};
const inWindow = (date: string | null, window: ChangeWindow): date is string => date !== null && date >= window.start && date <= window.end;

/** A window of `days` UTC days ending on `now`. */
export const changeWindow = (now: Date, days: number): ChangeWindow => ({
  start: new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10),
  end: now.toISOString().slice(0, 10),
});

const shortDate = (value: string) => new Intl.DateTimeFormat('en-US', {year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'})
  .format(new Date(stamp(value)));

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export type ModelChangeInput = {id: string; name: string; provider: string; path: string | null; releaseDate: string | null; firstSeen: string | null; sourceUrl: string | null};

/**
 * One entry per model at most. A model released inside the window is listed on its release
 * date. A model released earlier (or without a release date) that AI Stats first observed inside
 * the window is listed on that observation day, except on the day observation began, when every
 * existing model was first observed at once.
 */
export function modelEntries(models: ModelChangeInput[], window: ChangeWindow, observationStart: string | null): ChangeEntry[] {
  const entries: ChangeEntry[] = [];
  for (const model of models) {
    const released = day(model.releaseDate), seen = day(model.firstSeen);
    const base = {href: model.path, source: 'Artificial Analysis', sourceUrl: model.sourceUrl};
    const page = model.path ? '' : ' No AI Stats model page: outside the current Artificial Analysis cohort.';
    const releasedInWindow = inWindow(released, window);
    if (releasedInWindow && released) {
      entries.push({...base, id: `model-release:${model.id}`, date: released, timestamp: stamp(released), kind: 'model-release',
        title: model.name, summary: `${model.provider}. Release date as recorded by Artificial Analysis.${seen ? ` First observed by AI Stats ${shortDate(seen)}.` : ''}${page}`});
    } else if (inWindow(seen, window) && seen !== observationStart && (released === null || released < window.start)) {
      entries.push({...base, id: `model-added:${model.id}`, date: seen, timestamp: stamp(model.firstSeen as string), kind: 'model-added',
        title: model.name, summary: `${model.provider}. First observed by AI Stats in the Artificial Analysis feed. ${released ? `Released ${shortDate(released)}.` : 'Release date not recorded.'}${page}`});
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Benchmark results
// ---------------------------------------------------------------------------

/** Score text in the unit the source stored, with just enough digits to tell two values apart. */
export function formatScorePair(before: number, after: number, unit: string | null): [string, string] {
  const scale = unit === 'fraction' ? 100 : 1, suffix = unit === 'fraction' || unit === 'percent' ? '%' : '';
  const format = (value: number, digits: number) => new Intl.NumberFormat('en-US', {maximumSignificantDigits: digits, useGrouping: false}).format(value * scale) + suffix;
  for (let digits = 3; digits <= 15; digits++) {
    const pair: [string, string] = [format(before, digits), format(after, digits)];
    if (pair[0] !== pair[1]) return pair;
  }
  return [format(before, 15), format(after, 15)];
}

export type SourceInfo = {name: string; url: string | null};

/** Score revisions grouped per benchmark per day of the later retrieval. */
export function revisionEntries(revisions: ScoreRevision[], window: ChangeWindow, sources: Record<string, SourceInfo>): ChangeEntry[] {
  const groups = new Map<string, ScoreRevision[]>();
  for (const revision of revisions) {
    const date = day(revision.afterFetchedAt);
    if (!inWindow(date, window)) continue;
    const key = `${date}|${revision.source}|${revision.benchmarkSlug}`;
    groups.set(key, [...(groups.get(key) ?? []), revision]);
  }
  return [...groups].map(([key, group]) => {
    const [date] = key.split('|'), first = group[0], source = sources[first.source] ?? {name: first.source, url: null};
    const items = group.map((revision) => {
      const [before, after] = formatScorePair(revision.before, revision.after, revision.unit);
      const detail = [revision.metric, revision.version ? `version ${revision.version}` : null,
        revision.conditions ? Object.entries(revision.conditions).map(([name, value]) => `${name}: ${String(value)}`).join(', ') : null].filter(Boolean).join(' · ');
      return {label: detail ? `${revision.model} (${detail})` : revision.model, before, after,
        beforeDate: revision.beforeFetchedAt, afterDate: revision.afterFetchedAt};
    }).sort((a, b) => a.label.localeCompare(b.label));
    const latest = group.map((revision) => revision.afterFetchedAt).sort().at(-1) as string;
    return {id: `score-revised:${key}`, date: date as string, timestamp: stamp(latest), kind: 'score-revised' as const, title: first.benchmarkName,
      href: benchmarkPath(first.benchmarkSlug), source: source.name, sourceUrl: source.url, items,
      summary: `${group.length} stored ${group.length === 1 ? 'score' : 'scores'} changed between two ${source.name} snapshots. Same benchmark, model, version, metric, unit and conditions.`};
  });
}

export function firstRecordedEntries(groups: FirstRecorded[], window: ChangeWindow, sources: Record<string, SourceInfo>): ChangeEntry[] {
  return groups.flatMap((group) => {
    const date = day(group.fetchedAt);
    if (!inWindow(date, window)) return [];
    const source = sources[group.source] ?? {name: group.source, url: null};
    const shown = group.models.slice(0, 8);
    return [{id: `results-recorded:${date}|${group.source}|${group.benchmarkSlug}`, date, timestamp: stamp(group.fetchedAt), kind: 'results-recorded' as const,
      title: group.benchmarkName, href: benchmarkPath(group.benchmarkSlug), source: source.name, sourceUrl: source.url,
      summary: `${group.count} ${group.count === 1 ? 'model' : 'models'} with a first result on this benchmark in the ${source.name} snapshot retrieved ${shortDate(group.fetchedAt)} and in no earlier snapshot read for this log: ${shown.join(', ')}${group.models.length > shown.length ? `, and ${group.models.length - shown.length} more` : ''}.`}];
  });
}

export type EvaluatedRun = {id: string; benchmarkSlug: string; benchmarkName: string; model: string; evaluationDate: string | null; source: SourceInfo};

export function evaluationEntries(runs: EvaluatedRun[], window: ChangeWindow): ChangeEntry[] {
  return runs.flatMap((run) => {
    const date = day(run.evaluationDate);
    if (!inWindow(date, window)) return [];
    return [{id: `result-evaluated:${run.id}`, date, timestamp: stamp(date), kind: 'result-evaluated' as const, title: `${run.benchmarkName}: ${run.model}`,
      href: benchmarkPath(run.benchmarkSlug), source: run.source.name, sourceUrl: run.source.url, summary: `Evaluation date as recorded by ${run.source.name}.`}];
  });
}

// ---------------------------------------------------------------------------
// Source retrievals
// ---------------------------------------------------------------------------

export type Retrieval = {source: string; fetchedAt: string};

/** One entry per day listing how many times each source snapshot was retrieved. */
export function refreshEntries(retrievals: Retrieval[], window: ChangeWindow, sources: Record<string, SourceInfo>): ChangeEntry[] {
  const days = new Map<string, Map<string, string[]>>();
  for (const retrieval of retrievals) {
    const date = day(retrieval.fetchedAt);
    if (!inWindow(date, window)) continue;
    const bySource = days.get(date) ?? new Map<string, string[]>();
    bySource.set(retrieval.source, [...new Set([...(bySource.get(retrieval.source) ?? []), retrieval.fetchedAt])]);
    days.set(date, bySource);
  }
  return [...days].map(([date, bySource]) => {
    const names = [...bySource].map(([key, times]) => ({name: sources[key]?.name ?? key, count: times.length, latest: times.sort().at(-1) as string}))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {id: `source-refresh:${date}`, date, timestamp: stamp(names.map((item) => item.latest).sort().at(-1) as string), kind: 'source-refresh' as const,
      title: `${names.length} ${names.length === 1 ? 'source' : 'sources'} retrieved`, href: null, source: 'AI Stats refresh receipts', sourceUrl: null,
      summary: names.map((item) => item.count > 1 ? `${item.name} ×${item.count}` : item.name).join(', ') + '.'};
  });
}

// ---------------------------------------------------------------------------
// Grouping and feed
// ---------------------------------------------------------------------------

export type ChangeDay = {date: string; entries: ChangeEntry[]};

/** Newest day first; within a day, models before results before retrievals, then by title. */
export function groupByDay(entries: ChangeEntry[]): ChangeDay[] {
  const days = new Map<string, ChangeEntry[]>();
  for (const entry of entries) days.set(entry.date, [...(days.get(entry.date) ?? []), entry]);
  return [...days].sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]) => ({
    date,
    entries: items.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)),
  }));
}

const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Atom 1.0 feed of the newest entries, excluding routine retrieval receipts. */
export function atomFeed(entries: ChangeEntry[], options: {origin: string; pagePath: string; feedPath: string; updated: string; limit?: number}): string {
  const host = new URL(options.origin).host;
  const year = options.updated.slice(0, 4);
  const items = groupByDay(entries.filter((entry) => entry.kind !== 'source-refresh')).flatMap((group) => group.entries).slice(0, options.limit ?? 100);
  const absolute = (path: string) => new URL(path, options.origin).href;
  const body = items.map((entry) => {
    const detail = entry.items?.length ? ' ' + entry.items.slice(0, 20).map((item) => `${item.label}: ${item.before} → ${item.after}`).join('; ') + (entry.items.length > 20 ? `; and ${entry.items.length - 20} more.` : '.') : '';
    return [
      '  <entry>',
      `    <id>tag:${host},${year}:changes/${xml(encodeURIComponent(entry.id))}</id>`,
      `    <title>${xml(`${CHANGE_KIND_LABELS[entry.kind]}: ${entry.title}`)}</title>`,
      `    <link rel="alternate" href="${xml(absolute(entry.href ?? `${options.pagePath}#day-${entry.date}`))}"/>`,
      `    <updated>${entry.timestamp}</updated>`,
      `    <summary>${xml(`${entry.summary}${detail} Source: ${entry.source}.`)}</summary>`,
      '  </entry>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '  <title>AI Stats: what changed</title>',
    '  <subtitle>New models, new and revised benchmark results, from recorded source dates.</subtitle>',
    `  <id>${xml(absolute(options.pagePath))}</id>`,
    `  <link rel="self" type="application/atom+xml" href="${xml(absolute(options.feedPath))}"/>`,
    `  <link rel="alternate" type="text/html" href="${xml(absolute(options.pagePath))}"/>`,
    `  <updated>${options.updated}</updated>`,
    '  <author><name>Jonathan R. Reed</name></author>',
    ...body,
    '</feed>',
    '',
  ].join('\n');
}
