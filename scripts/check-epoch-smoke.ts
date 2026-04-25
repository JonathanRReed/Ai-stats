import { getEpochBenchmarkRuns, getEpochModels } from '../src/lib/supabase';

async function main() {
  const models = await getEpochModels();
  const runs = await getEpochBenchmarkRuns();

  if (models.length === 0 || runs.length === 0) {
    throw new Error(
      `Epoch smoke check failed: ${models.length} models, ${runs.length} runs`,
    );
  }

  console.info(`Epoch smoke check passed: ${models.length} models, ${runs.length} runs`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
