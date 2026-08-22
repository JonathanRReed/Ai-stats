/// <reference types="bun" />

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/Header.astro", "utf8");

const zIndexFor = (selector: string, startAt = 0): number => {
  const selectorIndex = source.indexOf(selector, startAt);
  const blockEnd = source.indexOf("}", selectorIndex);
  const block = source.slice(selectorIndex, blockEnd);
  const value = block.match(/z-index:\s*(\d+)/)?.[1];
  if (!value) throw new Error(`Missing z-index for ${selector}`);
  return Number(value);
};

test("the open mobile menu button stays above its dismiss overlay", () => {
  const overlayZIndex = zIndexFor(".mobile-nav-overlay {");
  const mobileMediaIndex = source.indexOf("@media (max-width: 640px)");
  const controlsZIndex = zIndexFor(".mobile-controls {", mobileMediaIndex);

  expect(controlsZIndex).toBeGreaterThan(overlayZIndex);
});
