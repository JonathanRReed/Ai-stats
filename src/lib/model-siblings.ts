import type { ModelPageRecord } from "./model-pages";

type ModelLinkRecord = Pick<ModelPageRecord, "slug" | "name" | "path" | "provider">;
type ModelLink = Pick<ModelPageRecord, "name" | "path">;

const modelNameOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function buildModelSiblingLinks(records: ModelLinkRecord[]): Map<string, ModelLink[]> {
  const byProvider = new Map<string, ModelLinkRecord[]>();
  for (const record of records) {
    const group = byProvider.get(record.provider) ?? [];
    group.push(record);
    byProvider.set(record.provider, group);
  }

  const links = new Map<string, ModelLink[]>();
  for (const group of byProvider.values()) {
    const ordered = [...group].sort((a, b) =>
      modelNameOrder.compare(a.name, b.name) || a.slug.localeCompare(b.slug));
    ordered.forEach((record, index) => {
      const nearby = [
        ...ordered.slice(Math.max(0, index - 4), index),
        ...ordered.slice(index + 1, index + 5),
      ];
      links.set(record.slug, nearby.map(({ name, path }) => ({ name, path })));
    });
  }
  return links;
}
