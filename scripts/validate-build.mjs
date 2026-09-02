import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export function validateComparisonBuild(data) {
  if (!data || !Array.isArray(data.validModels) || data.validModels.length < 2) {
    throw new Error('Release blocked: model comparisons are empty. Check Supabase build configuration and source availability.');
  }
  const models = new Map();
  for (const model of data.validModels) {
    if (!model || typeof model.id !== 'string' || !model.id || typeof model.name !== 'string' || !model.name.trim()) {
      throw new Error('Release blocked: a comparison model is missing its identity.');
    }
    if (models.has(model.id)) throw new Error('Release blocked: duplicate comparison model IDs.');
    models.set(model.id, model);
  }
  const defaults = data.defaultModelIds;
  if (!Array.isArray(defaults) || defaults.length < 2 || new Set(defaults).size !== defaults.length) {
    throw new Error('Release blocked: the initial model comparison is incomplete.');
  }
  for (const id of defaults) {
    const model = models.get(id);
    if (!model || !Number.isFinite(model.aa_coding_index) || model.isIllustrativeFallback) {
      throw new Error('Release blocked: a default comparison lacks measured coding evidence.');
    }
  }
  const benchmarks = data.availableBenchmarks;
  if (!benchmarks || typeof benchmarks !== 'object' || Array.isArray(benchmarks) ||
    Object.keys(benchmarks).length === 0 ||
    Object.entries(benchmarks).some(([slug, label]) => !slug.trim() || typeof label !== 'string' || !label.trim())) {
    throw new Error('Release blocked: no named benchmark comparisons were built.');
  }
  return { models: models.size, defaults: defaults.length, benchmarks: Object.keys(benchmarks).length };
}

if (import.meta.main) {
  const data = JSON.parse(await readFile(resolve('dist/api/compare-initial.json'), 'utf8'));
  console.log('Validated populated comparison build:', validateComparisonBuild(data));
}
