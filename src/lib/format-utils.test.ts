/// <reference types="bun" />

import { expect, test } from "bun:test";
import { formatIndex, formatPrice, formatScore } from "./format-utils";

test("composite indexes retain points without percentage scaling", () => {
  expect(formatIndex(65.7)).toBe("65.7");
  expect(formatIndex(0.8)).toBe("0.8");
  expect(formatIndex(0)).toBe("0.0");
  for (const value of [null, undefined, "", " ", Number.NaN, Infinity]) expect(formatIndex(value)).toBe("N/A");
});

test("formatScore renders zero as benchmark evidence and keeps missing values unavailable", () => {
  expect(formatScore(0)).toBe("0.0%");
  expect(formatScore("0")).toBe("0.0%");
  expect(formatScore(null)).toBe("N/A");
  expect(formatScore(undefined)).toBe("N/A");
  expect(formatScore(Number.NaN)).toBe("N/A");
});

test("formatPrice rejects negative and non-finite pricing", () => {
  expect(formatPrice(-0.01)).toBe("-");
  expect(formatPrice(Number.NaN)).toBe("-");
  expect(formatPrice(Number.POSITIVE_INFINITY)).toBe("-");
  expect(formatPrice(0)).toBe("$0.000");
});
