import { expect, test } from 'bun:test';
import { aaEvidenceNote, normalizeAaEvidence } from './aa-evidence';
import type { AaModel } from './supabase';

test('current Free responses do not revive retired benchmark columns', () => {
  const row = { source_metadata: { endpoint: 'language/models/free', intelligence_index_version: 4.2 },
    evaluations: { artificial_analysis_intelligence_index: 0.7, artificial_analysis_coding_index: 0 },
    aa_math_index: 95, mmlu_pro: 0.9, aa_intelligence_index: 80 } as unknown as AaModel;
  const result = normalizeAaEvidence(row);
  expect(result.aa_math_index).toBeNull();
  expect(result.mmlu_pro).toBeNull();
  expect(result.aa_intelligence_index).toBe(0.7);
  expect(result.aa_coding_index).toBe(0);
  expect(row.aa_math_index).toBe(95);
});

test('unknown historical provenance is not assigned the latest version', () => {
  expect(aaEvidenceNote(null)).toContain('version not recorded');
  expect(aaEvidenceNote({ intelligence_index_version: 4.2, performance_prompt: 'long' })).toContain('10,000 input tokens');
});
