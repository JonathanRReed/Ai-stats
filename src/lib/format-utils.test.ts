/// <reference types="bun" />

import { expect, test } from "bun:test";
import { formatPrice, formatScore } from "./format-utils";

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
