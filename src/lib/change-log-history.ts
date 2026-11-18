/**
 * Build-time reader for the committed history of the public snapshot files. The scheduled
 * refresh job commits public/data/*.json on every successful run, so each commit is a dated
 * version of what AI Stats published. Reads use plain `git log` and `git show`; nothing is written.
 *
 * A shallow checkout has no history: the reader then says so instead of inventing one.
 */
import {execFileSync, spawn} from 'node:child_process';
import type {HistoryRun, HistoryVersion} from './change-log-diff';
import {PUBLISHER_NAMES} from './publisher-evidence';

export const EPOCH_SNAPSHOT_FILE = 'public/data/epoch-benchmark-snapshot.json';
export const publisherSnapshotFile = (key: string) => `public/data/publisher-benchmarks/${key}.json`;

type Json = Record<string, unknown>;
const object = (value: unknown): Json | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : null;
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

/** One Epoch snapshot file as dated runs. Returns null for a file that is not a snapshot. */
export function epochVersion(raw: unknown): HistoryVersion | null {
  const data = object(raw);
  const fetchedAt = text(data?.fetched_at);
  if (!data || !fetchedAt || !Array.isArray(data.runs)) return null;
  const names = new Map<string, string>();
  for (const item of Array.isArray(data.benchmarks) ? data.benchmarks : []) {
    const benchmark = object(item), slug = text(benchmark?.slug), name = text(benchmark?.name);
    if (slug && name) names.set(slug, name);
  }
  const runs: HistoryRun[] = [];
  for (const item of data.runs) {
    const row = object(item);
    const slug = text(row?.benchmark_slug) ?? text(row?.benchmark_id), model = text(row?.model_version);
    if (!row || !slug || !model) continue;
    runs.push({benchmarkSlug: slug, benchmarkName: text(row.benchmark_name) ?? names.get(slug) ?? slug, model, score: finite(row.score),
      unit: text(row.score_unit), version: text(row.benchmark_version), metric: text(row.score_metric), conditions: object(row.conditions)});
  }
  return {source: 'epoch-ai', fetchedAt, runs};
}

/** Same benchmark slug the publisher adapter gives these runs (src/lib/publisher-evidence.ts). */
export const publisherBenchmarkSlug = (sourceKey: string, version: string) =>
  'publisher_' + sourceKey.replaceAll('-', '_') + '_' + version.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();

export function publisherVersion(raw: unknown, sourceKey: string): HistoryVersion | null {
  const data = object(raw);
  const fetchedAt = text(data?.fetchedAt), version = text(data?.benchmarkVersion);
  if (!data || !fetchedAt || !version || !Array.isArray(data.records)) return null;
  const slug = publisherBenchmarkSlug(sourceKey, version), name = `${PUBLISHER_NAMES[sourceKey] ?? sourceKey} ${version}`;
  const runs: HistoryRun[] = [];
  for (const item of data.records) {
    const row = object(item), model = text(row?.modelId) ?? text(row?.label);
    if (!row || !model) continue;
    runs.push({benchmarkSlug: slug, benchmarkName: name, model, score: finite(row.score), unit: text(row.unit), version,
      metric: text(row.metric), conditions: object(row.conditions)});
  }
  return {source: sourceKey, fetchedAt, runs};
}

export type GitHistory = {available: boolean; reason: string | null; versions: HistoryVersion[]; commits: number};

const git = (args: string[], cwd: string) => execFileSync('git', args, {cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore']});

/** Blob ids of a file per commit, newest first, from one `git log --raw` call. */
const blobIds = (args: string[], file: string, cwd: string): string[] =>
  git(['log', '--no-abbrev', '--raw', '--format=', ...args, '--', file], cwd).split('\n')
    .map((line) => line.match(/^:\d+ \d+ [0-9a-f]+ ([0-9a-f]+) [AM]/)?.[1]).filter((id): id is string => Boolean(id) && !/^0+$/.test(id as string));

/** Stream blobs through one `git cat-file --batch` process, handing each to `each` as it completes. */
function readBlobs(ids: string[], cwd: string, each: (content: Buffer | null) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['cat-file', '--batch'], {cwd, stdio: ['pipe', 'pipe', 'ignore']});
    let pending: Buffer = Buffer.alloc(0), remaining = ids.length, size: number | null = null;
    child.stdout.on('data', (chunk: Buffer) => {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      for (;;) {
        if (size === null) {
          const newline = pending.indexOf(10);
          if (newline < 0) return;
          const header = pending.subarray(0, newline).toString('utf8');
          pending = pending.subarray(newline + 1);
          const match = header.match(/^[0-9a-f]+ blob (\d+)$/);
          // A missing object still reports once, so results stay aligned with the ids requested.
          if (!match) { each(null); remaining--; if (!remaining) child.stdin.end(); continue; }
          size = Number(match[1]);
        }
        if (pending.length < size + 1) return;
        each(pending.subarray(0, size));
        pending = pending.subarray(size + 1);
        size = null;
        if (!--remaining) child.stdin.end();
      }
    });
    child.on('error', reject);
    child.on('close', () => resolve());
    if (!ids.length) child.stdin.end(); else child.stdin.end(ids.join('\n') + '\n');
  });
}

/**
 * Committed versions of one file from `since` onward, plus the last version before it as the
 * comparison base. Identical blobs are read once.
 */
export async function readFileHistory(file: string, since: Date, adapt: (raw: unknown) => HistoryVersion | null, cwd = process.cwd()): Promise<GitHistory> {
  try {
    if (git(['rev-parse', '--is-shallow-repository'], cwd).trim() === 'true') {
      return {available: false, reason: 'This build ran in a shallow checkout, so the committed history of the snapshot files is not available.', versions: [], commits: 0};
    }
    const iso = since.toISOString();
    const ids = [...blobIds(['-n', '1', `--until=${iso}`], file, cwd), ...blobIds([`--since=${iso}`], file, cwd).reverse()];
    const unique = [...new Set(ids)];
    // Each distinct blob is read once, in the order requested, then replayed in commit order. Only a
    // version identical to the one right before it is dropped, so a change that was later reverted
    // (A, B, A) still ends on A instead of leaving B as the latest state.
    const parsed: Array<HistoryVersion | null> = [];
    await readBlobs(unique, cwd, (content) => {
      try {
        parsed.push(content ? adapt(JSON.parse(content.toString('utf8'))) : null);
      } catch { parsed.push(null); /* an unparsable historical file is skipped, not guessed at */ }
    });
    const byId = new Map(unique.map((id, index) => [id, parsed[index] ?? null]));
    const versions: HistoryVersion[] = [];
    ids.forEach((id, index) => {
      const version = byId.get(id);
      if (version && id !== ids[index - 1]) versions.push(version);
    });
    return {available: ids.length > 0, reason: ids.length ? null : 'No committed versions of this file were found.', versions, commits: ids.length};
  } catch {
    return {available: false, reason: 'Git history could not be read in this build.', versions: [], commits: 0};
  }
}
