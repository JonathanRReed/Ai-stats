/**
 * Build-time assembly of the change log. Reads only the existing loaders and the committed
 * history of public/data; one promise per build so /changes and /changes.xml agree.
 */
import {getModelPageRecords} from './model-pages-data';
import {getModelCatalogData} from './model-catalog-data';
import {getDataFreshness} from './data-freshness';
import {PUBLISHER_NAMES} from './publisher-evidence';
import {diffHistory, type HistoryDiff} from './change-log-diff';
import {EPOCH_SNAPSHOT_FILE, epochVersion, publisherSnapshotFile, publisherVersion, readFileHistory} from './change-log-history';
import {
  changeWindow, evaluationEntries, firstRecordedEntries, groupByDay, modelEntries, refreshEntries, revisionEntries,
  type ChangeEntry, type EvaluatedRun, type Retrieval, type SourceInfo,
} from './change-log';

export const CHANGE_WINDOW_DAYS = 90;

export type HistorySummary = {source: string; name: string; available: boolean; reason: string | null; versions: number; baseline: string | null; latest: string | null; revisions: number; firstRecorded: number};

async function load(now = new Date()) {
  const window = changeWindow(now, CHANGE_WINDOW_DAYS);
  const historyStart = new Date(`${window.start}T00:00:00Z`);
  const [records, catalog, freshness] = await Promise.all([getModelPageRecords(), getModelCatalogData(), getDataFreshness()]);

  const sources: Record<string, SourceInfo> = {'epoch-ai': {name: 'Epoch AI', url: 'https://epoch.ai/benchmarks'}};
  for (const snapshot of catalog.publishers.snapshots) sources[snapshot.sourceKey] = {name: PUBLISHER_NAMES[snapshot.sourceKey] ?? snapshot.sourceKey, url: snapshot.sourceUrl};
  for (const source of freshness.sources) sources[source.sourceKey] ??= {name: source.displayName, url: null};

  // Committed snapshot history: Epoch and each original publisher, diffed per source.
  const tracked = [
    {source: 'epoch-ai', read: () => readFileHistory(EPOCH_SNAPSHOT_FILE, historyStart, epochVersion)},
    ...Object.keys(PUBLISHER_NAMES).map((key) => ({source: key, read: () => readFileHistory(publisherSnapshotFile(key), historyStart, (raw) => publisherVersion(raw, key))})),
  ];
  const histories = await Promise.all(tracked.map(async (item) => {
    const history = await item.read();
    return {source: item.source, history, diff: diffHistory(history.versions) as HistoryDiff};
  }));

  // Models: release date from the AA record, first observation from AI Stats' ingestion.
  const firstSeenDays = catalog.aaModels.map((model) => model.first_seen?.slice(0, 10)).filter((value): value is string => Boolean(value)).sort();
  const observationStart = firstSeenDays[0] ?? null;
  // Every AA row, including ones outside the current cohort (no model page): new releases often land there first.
  const pages = new Map(records.map((record) => [record.id, record]));
  const seenSlugs = new Set<string>();
  const models = catalog.aaModels.filter((model) => {
    const key = model.slug ?? model.id;
    if (seenSlugs.has(key)) return false;
    seenSlugs.add(key);
    return true;
  }).map((model) => {
    const page = pages.get(model.id);
    return {
      id: model.id, name: page?.name ?? model.name ?? model.slug ?? model.id,
      provider: page?.provider ?? model.company_name ?? model.creator_name ?? 'Unknown provider', path: page?.path ?? null,
      releaseDate: model.source_metadata?.release_date ?? null, firstSeen: model.first_seen ?? null,
      sourceUrl: model.slug ? `https://artificialanalysis.ai/models/${encodeURIComponent(model.slug)}` : 'https://artificialanalysis.ai/',
    };
  });

  const evaluated: EvaluatedRun[] = catalog.benchmarks.epochRuns.filter((run) => run.evaluation_date).map((run) => ({
    id: run.id, benchmarkSlug: run.benchmark_slug ?? run.benchmark_id, benchmarkName: run.benchmark_name ?? run.benchmark_id, model: run.model_version,
    evaluationDate: run.evaluation_date ?? null, source: run.source_key && sources[run.source_key] ? sources[run.source_key] : sources['epoch-ai'],
  }));

  // Retrievals: every committed snapshot, plus the latest receipt of sources whose history is not committed.
  const committed = new Set(tracked.map((item) => item.source));
  const retrievals: Retrieval[] = [
    ...histories.flatMap((item) => item.diff.refreshes),
    ...freshness.sources.filter((source) => !committed.has(source.sourceKey))
      .map((source) => ({source: source.sourceKey, fetchedAt: (source.fetchedAt ?? source.lastObservedAt)?.toISOString() ?? ''}))
      .filter((item) => item.fetchedAt),
  ];

  const entries: ChangeEntry[] = [
    ...modelEntries(models, window, observationStart),
    ...histories.flatMap((item) => revisionEntries(item.diff.revisions, window, sources)),
    ...histories.flatMap((item) => firstRecordedEntries(item.diff.firstRecorded, window, sources)),
    ...evaluationEntries(evaluated, window),
    ...refreshEntries(retrievals, window, sources),
  ];

  const summaries: HistorySummary[] = histories.map(({source, history, diff}) => ({
    source, name: sources[source]?.name ?? source, available: history.available, reason: history.reason, versions: diff.versions,
    baseline: diff.baseline, latest: diff.refreshes.at(-1)?.fetchedAt ?? null,
    revisions: diff.revisions.filter((item) => item.afterFetchedAt.slice(0, 10) >= window.start).length,
    firstRecorded: diff.firstRecorded.filter((item) => item.fetchedAt.slice(0, 10) >= window.start).reduce((sum, item) => sum + item.count, 0),
  }));

  return {
    window, entries, days: groupByDay(entries), summaries, observationStart,
    sourceUrls: [...new Set(Object.values(sources).map((source) => source.url).filter((url): url is string => Boolean(url)))],
    evaluatedTotal: evaluated.length,
    updated: entries.map((entry) => entry.timestamp).sort().at(-1) ?? now.toISOString(),
  };
}

let cached: ReturnType<typeof load> | undefined;
export const getChangeLog = () => cached ??= load().catch((error) => { cached = undefined; throw error; });
