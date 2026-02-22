import { getEpochBenchmarkRuns, getEpochModels } from './src/lib/supabase';
async function test() {
    const models = await getEpochModels();
    const runs = await getEpochBenchmarkRuns();
    console.log("Models:", models.length);
    console.log("Runs:", runs.length);
}
test();
