import type { AaModel, EpochBenchmarkRun, EpochModel } from './supabase';

const toTime = (value: string | null | undefined): number => {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
};

const toScore = (value: number | null | undefined): number => {
  const score = Number(value);
  return Number.isFinite(score) ? score : -Infinity;
};

const compareAaFreshness = (a: AaModel, b: AaModel): number => {
  const lastSeenDiff = toTime(a.last_seen) - toTime(b.last_seen);
  if (lastSeenDiff !== 0) return lastSeenDiff;

  const firstSeenDiff = toTime(a.first_seen) - toTime(b.first_seen);
  if (firstSeenDiff !== 0) return firstSeenDiff;

  return toScore(a.aa_intelligence_index) - toScore(b.aa_intelligence_index);
};

export const sortAaModelsByIntelligence = (models: AaModel[]): AaModel[] =>
  [...models].sort((a, b) => {
    const scoreDiff =
      toScore(b.aa_intelligence_index) - toScore(a.aa_intelligence_index);
    if (scoreDiff !== 0) return scoreDiff;
    return toTime(b.last_seen) - toTime(a.last_seen);
  });

export const dedupeAaModelsBySlug = (models: AaModel[]): AaModel[] => {
  const byKey = new Map<string, AaModel>();
  const passthrough: AaModel[] = [];

  models.forEach((model) => {
    const slug = model.slug?.trim();
    if (!slug) {
      passthrough.push(model);
      return;
    }

    const existing = byKey.get(slug);
    if (!existing || compareAaFreshness(model, existing) > 0) {
      byKey.set(slug, model);
    }
  });

  return sortAaModelsByIntelligence([...byKey.values(), ...passthrough]);
};

const humanizeEpochVersion = (value: string): string => {
  const effort = value.match(/_(high|medium|low|none)$/i)?.[1];
  const base = value
    .replace(/^(chutes|openrouter)\//i, '')
    .replace(/_(high|medium|low|none)$/i, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/i, '')
    .replace(/-\d{4}$/i, '')
    .replace(/-/g, ' ')
    .replace(/\bgpt\b/gi, 'GPT')
    .replace(/\bo\b/gi, 'o')
    .replace(/\br1\b/gi, 'R1')
    .replace(/\bv3\b/gi, 'V3')
    .replace(/\s+/g, ' ')
    .trim();

  if (!base) return value;
  return effort ? `${base} (${effort.toLowerCase()})` : base;
};

export const hydrateEpochModelsFromRuns = (
  models: EpochModel[],
  runs: EpochBenchmarkRun[],
): EpochModel[] => {
  const byVersion = new Map<string, EpochModel>();

  models.forEach((model) => {
    if (!model.model_version) return;
    byVersion.set(model.model_version, model);
  });

  runs.forEach((run) => {
    const version = run.model_version?.trim();
    if (!version || byVersion.has(version)) return;

    const displayName = humanizeEpochVersion(version);
    byVersion.set(version, {
      id: `run:${version}`,
      model_version: version,
      model_name: displayName.replace(/\s+\((high|medium|low|none)\)$/i, ''),
      display_name: displayName,
      organization: run.organization,
      country: run.country,
      model_accessibility: null,
      release_date: run.release_date,
      eci_score: null,
      training_compute_flop: null,
      training_compute_confidence: null,
      description: 'Backfilled from Epoch benchmark runs.',
    });
  });

  return [...byVersion.values()].sort((a, b) => {
    const eciDiff = toScore(b.eci_score) - toScore(a.eci_score);
    if (eciDiff !== 0) return eciDiff;
    return String(a.display_name || a.model_version).localeCompare(
      String(b.display_name || b.model_version),
    );
  });
};
