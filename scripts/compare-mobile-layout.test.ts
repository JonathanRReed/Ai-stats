/// <reference types="bun" />

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/pages/compare.astro", "utf8");

test("the compare hero mobile override follows the base hero styles", () => {
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
  expect(mobileOverride).toContain("font-size: clamp(2.25rem, 15vw, 4rem)");
});
