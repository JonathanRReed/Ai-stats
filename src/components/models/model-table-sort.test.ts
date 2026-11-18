import { expect, test } from "bun:test";
import { defaultDirection, parseSortValue, sortByMeasure } from "./model-table-sort";

const rows = [
  { id: "a", v: 3 },
  { id: "missing-1", v: null },
  { id: "b", v: 1 },
  { id: "c", v: 3 },
  { id: "missing-2", v: null },
  { id: "zero", v: 0 },
];

test("missing values sort last in both directions; ties keep order", () => {
  expect(sortByMeasure(rows, (r) => r.v, "asc").map((r) => r.id)).toEqual(["zero", "b", "a", "c", "missing-1", "missing-2"]);
  expect(sortByMeasure(rows, (r) => r.v, "desc").map((r) => r.id)).toEqual(["a", "c", "b", "zero", "missing-1", "missing-2"]);
});

test("attribute text parses to a number or to missing, never to zero", () => {
  expect(parseSortValue("")).toBeNull();
  expect(parseSortValue(null)).toBeNull();
  expect(parseSortValue("n/a")).toBeNull();
  expect(parseSortValue("0")).toBe(0);
  expect(parseSortValue("12.5")).toBe(12.5);
});

test("prices start cheapest first, other measures highest first", () => {
  expect(defaultDirection("input")).toBe("asc");
  expect(defaultDirection("output")).toBe("asc");
  expect(defaultDirection("index")).toBe("desc");
  expect(defaultDirection("context")).toBe("desc");
});
