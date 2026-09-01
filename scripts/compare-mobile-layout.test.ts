/// <reference types="bun" />

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/pages/compare.astro", "utf8");

test("the compact compare header and task lens stack cleanly on mobile", () => {
  const baseHeroIndex = source.indexOf(
    ".compare-hero {\n      position: relative;",
  );
  const mobileOverrideIndex = source.indexOf(
    "@media (max-width: 640px)",
    baseHeroIndex,
  );

  expect(baseHeroIndex).toBeGreaterThan(-1);
  expect(mobileOverrideIndex).toBeGreaterThan(baseHeroIndex);

  const mobileOverride = source.slice(
    mobileOverrideIndex,
    source.indexOf("\n    }", mobileOverrideIndex) + 6,
  );
  expect(mobileOverride).toContain("grid-template-columns: 1fr");
  expect(mobileOverride).not.toContain("15vw");
  expect(source).toContain(".compare-preset-strip");
  expect(source).toContain("grid-template-columns: 1fr;");
  expect(source.indexOf('id="compare-task-preset"')).toBeLessThan(
    source.indexOf('class="charts-section'),
  );
});
