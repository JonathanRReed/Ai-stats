import type { AaModel } from './supabase';

export const AA_EVALUATION_KEYS = {
  aa_intelligence_index: 'artificial_analysis_intelligence_index',
  aa_coding_index: 'artificial_analysis_coding_index',
  aa_agentic_index: 'artificial_analysis_agentic_index',
  aa_math_index: 'artificial_analysis_math_index',
  mmlu_pro: 'mmlu_pro', gpqa: 'gpqa_diamond', hle: 'hle',
  livecodebench: 'livecodebench', scicode: 'scicode', math_500: 'math_500', aime: 'aime',
} as const;

/** Retained database columns are historical, not observations from a new API response. */
export function normalizeAaEvidence(model: AaModel): AaModel {
  if (!model.source_metadata?.endpoint?.startsWith('language/')) return model;
  const evaluations = model.evaluations ?? {};
  return {
    ...model,
    ...Object.fromEntries(Object.entries(AA_EVALUATION_KEYS).map(([column, key]) => [
      column, typeof evaluations[key] === 'number' && Number.isFinite(evaluations[key])
        ? evaluations[key] : null,
    ])),
  };
}

export function aaEvidenceNote(metadata: AaModel['source_metadata']): string {
  const version = metadata?.intelligence_index_version;
  const index = version == null ? 'AA Index version not recorded.' : `AA Index v${version}.`;
  const prompt = metadata?.performance_prompt;
  const performance = prompt === 'long' ? 'Speed and latency use the AA API default, 10,000 input tokens.'
    : prompt === 'medium' || prompt === '1000' ? 'Speed and latency use 1,000 input tokens.'
      : 'Speed-test prompt conditions not recorded.';
  return `${index} ${performance} Compare scores within the same index version and timings under the same conditions.`;
}
