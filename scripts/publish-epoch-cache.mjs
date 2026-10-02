import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildEpochCacheInput, prepareSourceSnapshot, publishSourceSnapshot } from './source-snapshots.mjs';

export async function runEpochCachePublication({
  argv = process.argv.slice(2), env = process.env,
  readFileImpl = path => readFile(path, 'utf8'), publishImpl = publishSourceSnapshot,
} = {}) {
  let inputPath;
  let dryRun = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--dry-run' && !dryRun) dryRun = true;
    else if (arg === '--input' && !inputPath && argv[index + 1] && !argv[index + 1].startsWith('--')) {
      inputPath = argv[++index];
    } else throw new Error('Usage: publish-epoch-cache --input <sanitized-snapshot.json> [--dry-run]');
  }
  if (!inputPath) throw new Error('An explicit snapshot input is required');
  let snapshot;
  try { snapshot = JSON.parse(await readFileImpl(inputPath)); }
  catch { throw new Error('Cannot read a valid Epoch snapshot artifact'); }
  const input = buildEpochCacheInput(snapshot);
  const validated = prepareSourceSnapshot(input);
  if (dryRun) return { dryRun: true, recordCount: validated.recordCount, contentHash: validated.contentHash };
  const receipt = await publishImpl({
    input, baseUrl: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  return { ...receipt, dryRun: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runEpochCachePublication().then(receipt => console.log(JSON.stringify(receipt))).catch(error => {
    console.error(error instanceof Error ? error.message : 'Epoch cache publication failed');
    process.exitCode = 1;
  });
}
