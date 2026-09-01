/// <reference types="bun" />

import { expect, test } from "bun:test";
import { formatScore } from "./format-utils";

test("formatScore renders zero as benchmark evidence and keeps missing values unavailable", () => {
  expect(formatScore(0)).toBe("0.0%");
  expect(formatScore("0")).toBe("0.0%");
  expect(formatScore(null)).toBe("N/A");
  expect(formatScore(undefined)).toBe("N/A");
  expect(formatScore(Number.NaN)).toBe("N/A");
});
