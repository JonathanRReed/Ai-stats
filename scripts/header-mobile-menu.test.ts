/// <reference types="bun" />

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PRIMARY_NAV, PROJECT_NAV, SECONDARY_NAV } from "../src/lib/site-nav";

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
  const mobileMediaIndex = source.indexOf("@media (max-width: 900px)");
  expect(mobileMediaIndex).toBeGreaterThan(-1);
  const controlsZIndex = zIndexFor(".mobile-controls {", mobileMediaIndex);

  expect(controlsZIndex).toBeGreaterThan(overlayZIndex);
});

test("the mobile navigation keeps the primary links in the same order as desktop", () => {
  // Both menus render from the same lists in src/lib/site-nav.ts, primary first.
  const desktopIndex = source.indexOf('aria-label="Primary"');
  const mobileNavIndex = source.indexOf('<nav id="mobile-nav"');
  expect(source.indexOf("primaryLinks.map", desktopIndex)).toBeLessThan(mobileNavIndex);
  const mobilePrimary = source.indexOf("primaryLinks.map", mobileNavIndex);
  const mobileSecondary = source.indexOf("moreLinks.map", mobileNavIndex);
  const mobileProject = source.indexOf("projectLinks.map", mobileNavIndex);
  expect(mobilePrimary).toBeGreaterThan(mobileNavIndex);
  expect(mobileSecondary).toBeGreaterThan(mobilePrimary);
  expect(mobileProject).toBeGreaterThan(mobileSecondary);

  expect(PRIMARY_NAV.map((link) => link.label)).toEqual(["Stats", "Compare", "Models", "Benchmarks", "Labs", "Play"]);
  expect(PROJECT_NAV.map((link) => link.label)).toEqual(["About", "Contact"]);

  expect(source).toContain('nav id="mobile-nav" class="mobile-nav" inert');
  expect(source).toContain('tabindex="-1"');
});

test("every section and project page is reachable from the header", () => {
  const hrefs = [...PRIMARY_NAV, ...SECONDARY_NAV, ...PROJECT_NAV].map((link) => link.href);
  expect(hrefs).toEqual(["/", "/compare", "/models", "/benchmarks", "/labs", "/play", "/matchups", "/changes", "/about", "/contact"]);
  expect(new Set(hrefs).size).toBe(hrefs.length);
});
