import { expect, test } from "bun:test";
import { buildModelSiblingLinks } from "./model-siblings";

test("every model in a provider group has links from nearby peers", () => {
  const records = [
    ...Array.from({ length: 12 }, (_, index) => ({
      slug: `model-${index + 1}`,
      name: `Model ${index + 1}`,
      path: `/models/model-${index + 1}`,
      provider: "Example Lab",
    })).reverse(),
    { slug: "solo", name: "Solo", path: "/models/solo", provider: "Solo Lab" },
  ];
  const links = buildModelSiblingLinks(records);

  for (const record of records) {
    const siblings = links.get(record.slug) ?? [];
    expect(siblings.length).toBeLessThanOrEqual(8);
    expect(siblings.every(({ path }) => path !== record.path)).toBeTrue();
    if (record.provider === "Example Lab") {
      expect(siblings.length).toBeGreaterThan(0);
      expect([...links.values()].some((group) => group.some(({ path }) => path === record.path)))
        .toBeTrue();
    }
  }
  expect(links.get("model-6")?.map(({ path }) => path)).toContain("/models/model-5");
  expect(links.get("model-6")?.map(({ path }) => path)).toContain("/models/model-7");
  expect(links.get("solo")).toEqual([]);
});
