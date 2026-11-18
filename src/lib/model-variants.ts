import { modelDisplayFacets } from "./compare-catalog";
import { reasoningRank } from "./compare-family-lines";
import type { ModelPageRecord } from "./model-pages";

type VariantSource = Pick<ModelPageRecord, "slug" | "name" | "path" | "provider" | "pricing" | "speed" | "indexes">;

export type ModelVariantRow = {
  slug: string;
  name: string;
  path: string;
  /** Recorded reasoning label, or "unknown" when the name carries none. */
  reasoning: string;
  index: number | null;
  blendedPrice: number | null;
  outputSpeed: number | null;
};

const value = (group: VariantSource["pricing"], key: string): number | null =>
  group.find((metric) => metric.key === key)?.value ?? null;

/**
 * Records that share a provider and a display family, in ascending reasoning effort.
 * A family of one has nothing to compare, so it gets no rows.
 */
export function buildModelVariantRows(records: VariantSource[]): Map<string, ModelVariantRow[]> {
  const families = new Map<string, ModelVariantRow[]>();
  const familyOf = new Map<string, string>();
  for (const record of records) {
    const facets = modelDisplayFacets(record.name);
    const key = JSON.stringify([record.provider, facets.family]);
    familyOf.set(record.slug, key);
    const rows = families.get(key) ?? [];
    rows.push({
      slug: record.slug,
      name: record.name,
      path: record.path,
      reasoning: facets.reasoning,
      index: value(record.indexes, "aa_intelligence_index"),
      blendedPrice: value(record.pricing, "price_1m_blended_3_to_1"),
      outputSpeed: value(record.speed, "median_output_tokens_per_second"),
    });
    families.set(key, rows);
  }
  for (const rows of families.values()) {
    rows.sort((a, b) => reasoningRank(a.reasoning) - reasoningRank(b.reasoning) || a.name.localeCompare(b.name, "en", { numeric: true }) || a.slug.localeCompare(b.slug));
  }
  const result = new Map<string, ModelVariantRow[]>();
  for (const [slug, key] of familyOf) {
    const rows = families.get(key) ?? [];
    if (rows.length > 1) result.set(slug, rows);
  }
  return result;
}
