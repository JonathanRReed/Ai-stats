/// <reference types="bun" />

import { expect, test } from "bun:test";
import {
  compareOptionalMetricValues,
  hasFiniteMetricValue,
  parseFiniteMetricValue,
} from "./metric-values";

test("zero is valid benchmark evidence while missing and invalid values stay missing", () => {
  expect(parseFiniteMetricValue(0)).toBe(0);
  expect(parseFiniteMetricValue("0")).toBe(0);
  expect(hasFiniteMetricValue(0)).toBeTrue();
  expect(hasFiniteMetricValue("0")).toBeTrue();

  for (const value of [null, undefined, "", "  ", Number.NaN, Infinity]) {
    expect(parseFiniteMetricValue(value)).toBeNull();
    expect(hasFiniteMetricValue(value)).toBeFalse();
  }
});

test("optional metric sorting keeps missing evidence last in both directions", () => {
  const values = [null, 0, 12, -2];

  expect([...values].sort((left, right) =>
    compareOptionalMetricValues(left, right, "desc"),
  )).toEqual([12, 0, -2, null]);
  expect([...values].sort((left, right) =>
    compareOptionalMetricValues(left, right, "asc"),
  )).toEqual([-2, 0, 12, null]);
});
