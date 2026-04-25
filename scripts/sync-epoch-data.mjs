#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DATA_URL = 'https://epoch.ai/data/benchmark_data.zip';
const PAGE_SIZE = 500;

const SCORE_COLUMNS = [
  'mean_score',
  'Best score (across scorers)',
  'Percent correct',
  'Accuracy',
  'Accuracy mean',
  'Average',
  'Average score',
  'Average progress',
  'Average (%)',
  'Global average',
  'Score',
  'Score (AVG@5)',
  'Pass@1 score',
  'Challenge score',
  'EM',
  'Overall accuracy',
  'Overall pass (%)',
  'Overall (no subtitles)',
  'Win Rate (%)',
  '% Score',
  '% Resolved',
  '% Resolved',
  'Unguided % Solved',
  'Correct',
  'Time horizon',
  'Arena Score',
  '120k token score',
];

const METADATA_COLUMNS = new Set([
  'Model version',
  'Release date',
  'Organization',
  'Country',
  'Training compute (FLOP)',
  'Training compute notes',
  'Model accessibility',
  'Model name',
  'Description',
  'Display name',
  'Confidence',
  'Source',
  'Source link',
  'Source Link',
  'Source link (site from table)',
  'Notes',
  'Notes (details)',
  'id',
]);

const loadEnv = async () => {
  const envPath = path.join(process.cwd(), '.env');
  try {
    const body = await readFile(envPath, 'utf8');
    for (const line of body.split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) continue;
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    return;
  }
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  const [header = [], ...body] = rows;
  return body.map((values) =>
    Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])),
  );
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim().replace(/,/g, '').replace(/%$/, '');
  if (!cleaned || cleaned === 'N/A') return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
};

const toTextOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const slugToName = (slug) =>
  slug
    .replace(/_external$/u, '')
    .replace(/_/gu, ' ')
    .replace(/\b\w/gu, (letter) => letter.toUpperCase())
    .replace(/\bGpqa\b/u, 'GPQA')
    .replace(/\bMmlu\b/u, 'MMLU')
    .replace(/\bGsm8k\b/u, 'GSM8K')
    .replace(/\bHle\b/u, 'HLE')
    .replace(/\bSwe\b/u, 'SWE')
    .replace(/\bAgi\b/u, 'AGI')
    .replace(/\bAi2\b/u, 'AI2')
    .replace(/\bQa\b/u, 'QA');

const getPrimaryScoreColumn = (row) =>
  SCORE_COLUMNS.find((column) => toNumberOrNull(row[column]) !== null) ??
  Object.keys(row).find(
    (column) => !METADATA_COLUMNS.has(column) && toNumberOrNull(row[column]) !== null,
  ) ??
  null;

const getSourceLink = (row) =>
  toTextOrNull(row['Source link']) ??
  toTextOrNull(row['Source Link']) ??
  toTextOrNull(row['Source link (site from table)']);

const getRunId = (slug, row, scoreMetric) => {
  const sourceId = toTextOrNull(row.id);
  if (sourceId) return sourceId;
  return [
    slug,
    row['Model version'],
    scoreMetric,
    row['Release date'],
    getSourceLink(row),
  ]
    .map((part) => String(part ?? '').trim())
    .join(':');
};

const readCsv = async (filePath) => parseCsv(await readFile(filePath, 'utf8'));

const findCsvFiles = async (dir, baseDir = dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findCsvFiles(fullPath, baseDir)));
    } else if (entry.isFile() && entry.name.endsWith('.csv')) {
      files.push({
        fullPath,
        filePath: path.relative(baseDir, fullPath),
      });
    }
  }
  return files.sort((a, b) => a.filePath.localeCompare(b.filePath));
};

const downloadEpochZip = async (targetPath) => {
  const response = await fetch(DATA_URL, {
    headers: { Accept: 'application/zip,application/octet-stream,*/*' },
  });
  if (!response.ok) {
    throw new Error(`Epoch data download failed with HTTP ${response.status}`);
  }
  await writeFile(targetPath, Buffer.from(await response.arrayBuffer()));
};

const upsertChunks = async (supabase, table, rows, options) => {
  let count = 0;
  for (let index = 0; index < rows.length; index += PAGE_SIZE) {
    const chunk = rows.slice(index, index + PAGE_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, options);
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
    count += chunk.length;
  }
  return count;
};

const selectAll = async (supabase, table, columns) => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const to = from + 999;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, to);
    if (error) throw new Error(`${table} select failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
};

const dedupeRowsByKey = (rows, getKey) => {
  const byKey = new Map();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    const existing = byKey.get(key);
    byKey.set(key, {
      ...(existing ?? {}),
      ...row,
      source_name: row.source_name ?? existing?.source_name ?? null,
      source_link: row.source_link ?? existing?.source_link ?? null,
    });
  }
  return [...byKey.values()];
};

const main = async () => {
  await loadEnv();
  const dryRun = process.argv.includes('--dry-run');
  const snapshotIndex = process.argv.indexOf('--write-public-snapshot');
  const snapshotPath = snapshotIndex >= 0 ? process.argv[snapshotIndex + 1] : null;
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!dryRun && (!supabaseUrl || !serviceKey)) {
    throw new Error('Set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the Epoch sync.');
  }

  const supabase = dryRun
    ? null
    : createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

  const workDir = await mkdtemp(path.join(tmpdir(), 'aistats-epoch-'));
  const zipPath = path.join(workDir, 'benchmark_data.zip');

  try {
    await downloadEpochZip(zipPath);
    await execFileAsync('unzip', ['-q', zipPath, '-d', workDir]);

    const eciRows = await readCsv(path.join(workDir, 'epoch_capabilities_index.csv'));
    const modelByVersion = new Map();

    for (const row of eciRows) {
      const modelVersion = toTextOrNull(row['Model version']);
      if (!modelVersion) continue;
      modelByVersion.set(modelVersion, {
        model_version: modelVersion,
        model_name: toTextOrNull(row['Model name']),
        display_name: toTextOrNull(row['Display name']),
        organization: toTextOrNull(row.Organization),
        country: toTextOrNull(row.Country),
        model_accessibility: toTextOrNull(row['Model accessibility']),
        release_date: toTextOrNull(row['Release date']),
        eci_score: toNumberOrNull(row['ECI Score']),
        training_compute_flop: toNumberOrNull(row['Training compute (FLOP)']),
        training_compute_confidence: toTextOrNull(row.Confidence),
        description: toTextOrNull(row.Description),
        updated_at: new Date().toISOString(),
      });
    }

    const benchmarkRows = [];
    const runRows = [];
    const dataFileRows = [];
    const csvFiles = await findCsvFiles(workDir);

    for (const { fullPath, filePath } of csvFiles) {
      const rows = await readCsv(fullPath);
      dataFileRows.push({
        file_path: filePath,
        row_count: rows.length,
        rows,
        source_url: DATA_URL,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const filename = path.basename(filePath);
      if (
        filePath.includes(path.sep) ||
        !filename.endsWith('.csv') ||
        filename === 'epoch_capabilities_index.csv'
      ) {
        continue;
      }

      const slug = filename.replace(/\.csv$/u, '');
      benchmarkRows.push({
        slug,
        name: slugToName(slug),
        description: null,
        source: 'epoch.ai',
        updated_at: new Date().toISOString(),
      });

      for (const row of rows) {
        const modelVersion = toTextOrNull(row['Model version']);
        if (!modelVersion) continue;

        const scoreMetric = getPrimaryScoreColumn(row);
        const score = scoreMetric ? toNumberOrNull(row[scoreMetric]) : null;
        const releaseDate = toTextOrNull(row['Release date']);
        const organization = toTextOrNull(row.Organization);
        const country = toTextOrNull(row.Country);

        const existing = modelByVersion.get(modelVersion) ?? {};
        modelByVersion.set(modelVersion, {
          model_version: modelVersion,
          model_name: existing.model_name ?? toTextOrNull(row.Name) ?? modelVersion,
          display_name: existing.display_name ?? toTextOrNull(row.Name) ?? modelVersion,
          organization: existing.organization ?? organization,
          country: existing.country ?? country,
          model_accessibility: existing.model_accessibility ?? null,
          release_date: existing.release_date ?? releaseDate,
          eci_score: existing.eci_score ?? null,
          training_compute_flop:
            existing.training_compute_flop ?? toNumberOrNull(row['Training compute (FLOP)']),
          training_compute_confidence:
            existing.training_compute_confidence ?? toTextOrNull(row.Confidence),
          description: existing.description ?? null,
          updated_at: new Date().toISOString(),
        });

        runRows.push({
          epoch_run_id: getRunId(slug, row, scoreMetric),
          model_version: modelVersion,
          score,
          score_metric: scoreMetric,
          stderr: toNumberOrNull(row.stderr) ?? toNumberOrNull(row['Accuracy SE']),
          release_date: releaseDate,
          organization,
          country,
          training_compute_flop: toNumberOrNull(row['Training compute (FLOP)']),
          training_compute_notes: toTextOrNull(row['Training compute notes']),
          log_viewer_url: toTextOrNull(row['Log viewer']),
          logs_url: toTextOrNull(row.Logs),
          started_at: toTextOrNull(row['Started at']),
          source_name: toTextOrNull(row.Source),
          source_link: getSourceLink(row),
          raw: row,
          updated_at: new Date().toISOString(),
          benchmark_slug: slug,
        });
      }
    }

    const dedupedRunRows = dedupeRowsByKey(runRows, (row) => row.epoch_run_id);

    if (snapshotPath) {
      const snapshot = {
        source: DATA_URL,
        fetched_at: new Date().toISOString(),
        benchmarks: benchmarkRows,
        models: [...modelByVersion.values()],
        runs: dedupedRunRows.map(({ benchmark_slug: benchmarkSlug, ...run }) => ({
          id: run.epoch_run_id,
          model_version: run.model_version,
          benchmark_id: benchmarkSlug,
          benchmark_slug: benchmarkSlug,
          score: run.score,
          score_metric: run.score_metric,
          release_date: run.release_date,
          organization: run.organization,
          country: run.country,
          stderr: run.stderr,
          source_name: run.source_name,
          source_link: run.source_link,
        })),
      };
      await mkdir(path.dirname(snapshotPath), { recursive: true });
      await writeFile(snapshotPath, `${JSON.stringify(snapshot)}\n`);
    }

    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            source: DATA_URL,
            benchmarks: benchmarkRows.length,
            models: modelByVersion.size,
            runs: dedupedRunRows.length,
            files: dataFileRows.length,
            snapshot: snapshotPath,
          },
          null,
          2,
        ),
      );
      return;
    }

    await upsertChunks(supabase, 'epoch_benchmarks', benchmarkRows, {
      onConflict: 'slug',
    });
    const benchmarks = await selectAll(supabase, 'epoch_benchmarks', 'id,slug');
    const benchmarkIdBySlug = new Map(benchmarks.map((row) => [row.slug, row.id]));

    const modelRows = [...modelByVersion.values()];
    await upsertChunks(supabase, 'epoch_models', modelRows, {
      onConflict: 'model_version',
    });
    const models = await selectAll(supabase, 'epoch_models', 'id,model_version');
    const modelIdByVersion = new Map(models.map((row) => [row.model_version, row.id]));

    const runsForUpsert = dedupedRunRows
      .map(({ benchmark_slug: benchmarkSlug, ...run }) => ({
        ...run,
        benchmark_id: benchmarkIdBySlug.get(benchmarkSlug),
        epoch_model_id: modelIdByVersion.get(run.model_version) ?? null,
      }))
      .filter((run) => run.benchmark_id);

    await upsertChunks(supabase, 'epoch_benchmark_runs', runsForUpsert, {
      onConflict: 'epoch_run_id',
    });
    await upsertChunks(supabase, 'epoch_data_files', dataFileRows, {
      onConflict: 'file_path',
    });

    console.log(
      JSON.stringify(
        {
          source: DATA_URL,
          benchmarks: benchmarkRows.length,
          models: modelRows.length,
          runs: runsForUpsert.length,
          files: dataFileRows.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
