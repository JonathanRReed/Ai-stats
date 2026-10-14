export type RankableModel = {
  id: string;
  name?: string | null;
  company_name?: string | null;
  creator_name?: string | null;
  source?: string;
  current_source_member?: boolean | null;
  reasoning?: string | null;
};

export type RankedModelFamily<T extends RankableModel> = {
  key: string;
  source: string;
  provider: string;
  family: string;
  variants: T[];
  best: T;
};

const familyAndReasoning = (name: string) => {
  const suffix = name.match(/\(([^)]*)\)\s*$/)?.[1] ?? "";
  const effort = suffix.match(/\b(xhigh|high|medium|low|minimal|max)\b/i)?.[1]?.toLowerCase();
  const qualifier = /\b(reasoning|xhigh|high|medium|low|minimal|max)\b/i.test(suffix);
  return {
    family: qualifier ? name.replace(/\s*\([^)]*\)\s*$/, "").trim() : name,
    reasoning: /non-reasoning/i.test(suffix) ? "none" : effort ?? "unknown",
  };
};

const normalized = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("en-US");
const score = (model: RankableModel, metric: string): number | null => {
  const raw = (model as Record<string, unknown>)[metric];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
  return null;
};

/** Filter measured records before grouping and truncating; family identity never crosses providers or sources. */
export function rankModelFamilies<T extends RankableModel>(
  models: T[],
  metric: string,
  options: { limit?: number; query?: string; reasoning?: string[]; higherIsBetter?: boolean; mode?: "families" | "variants" } = {},
): RankedModelFamily<T>[] {
  const query = normalized(options.query);
  const reasoning = new Set((options.reasoning ?? []).map(normalized));
  const groups = new Map<string, RankedModelFamily<T>>();
  const eligible = models.flatMap((model) => {
    if (model.current_source_member === false) return [];
    const name = String(model.name ?? "").trim();
    const facets = familyAndReasoning(name);
    const effort = normalized(model.reasoning && model.reasoning !== "unknown" ? model.reasoning : facets.reasoning);
    if (reasoning.size && !reasoning.has(effort)) return [];
    const provider = String(model.company_name ?? model.creator_name ?? "Unknown provider").trim() || "Unknown provider";
    const source = String(model.source ?? "aa");
    const key = [source, normalized(provider), normalized(facets.family)].join("\u001f");
    if (query && ![name, provider, facets.family].some((value) => normalized(value).includes(query))) return [];
    return [{ model, source, provider, family: facets.family, effort, key, value: score(model, metric) }];
  }).filter((row) => row.value !== null);

  const compare = (a: number, b: number) => (options.higherIsBetter === false ? a - b : b - a);
  eligible.forEach((row) => {
    let group = groups.get(row.key);
    if (!group) {
      group = { key: row.key, source: row.source, provider: row.provider, family: row.family, variants: [], best: row.model };
      groups.set(row.key, group);
    }
    group.variants.push(row.model);
  });
  const ordered = [...groups.values()].map((group) => {
    group.variants.sort((a, b) => {
      const av = score(a, metric)!;
      const bv = score(b, metric)!;
      return compare(av, bv) || String(a.name ?? a.id).localeCompare(String(b.name ?? b.id));
    });
    group.best = group.variants[0];
    return group;
  }).sort((a, b) => {
    const diff = compare(score(a.best, metric)!, score(b.best, metric)!);
    return diff || a.family.localeCompare(b.family) || a.provider.localeCompare(b.provider) || a.source.localeCompare(b.source);
  });
  const limit = Number.isFinite(options.limit) ? Math.max(0, Math.floor(options.limit!)) : ordered.length;
  const limited = ordered.slice(0, limit);
  if (options.mode !== "variants") return limited;
  const top = ordered.flatMap((group) => group.variants.map((variant) => ({ group, variant })));
  top.sort((a, b) => compare(score(a.variant, metric)!, score(b.variant, metric)!) || a.group.family.localeCompare(b.group.family));
  return top.slice(0, limit).map(({ group, variant }) => ({ ...group, variants: [variant], best: variant }));
}
