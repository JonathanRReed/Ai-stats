/// <reference types="bun" />

import { expect, test } from "bun:test";
import {
  getFreshnessUpdatedAt,
  resolveSourceFreshness,
  type SourceFreshness,
  type SourceFreshnessInput,
} from "./data-freshness";

const now = new Date("2026-09-01T12:00:00.000Z");

const source = (overrides: Partial<SourceFreshnessInput> = {}): SourceFreshnessInput => ({
  sourceKey: "artificial-analysis",
  displayName: "Artificial Analysis",
  lastObservedAt: "2026-08-31T12:00:00.000Z",
  lastSuccessfulRunAt: "2026-08-31T12:00:00.000Z",
  coverageLabel: "320 models",
  ...overrides,
});

test("resolveSourceFreshness marks a recent successful source healthy", () => {
  expect(resolveSourceFreshness(source(), now)).toMatchObject({
    status: "healthy",
    ageDays: 1,
    message: "Current source snapshot is available.",
  });
});

test("resolveSourceFreshness marks an old successful source stale", () => {
  expect(
    resolveSourceFreshness(
      source({
        lastObservedAt: "2026-08-01T12:00:00.000Z",
        lastSuccessfulRunAt: "2026-08-01T12:00:00.000Z",
      }),
      now,
    ),
  ).toMatchObject({
    status: "stale",
    ageDays: 31,
    message: "Last successful source snapshot is older than 14 days.",
  });
});

test("resolveSourceFreshness uses the last successful run for staleness after a newer failed observation", () => {
  expect(
    resolveSourceFreshness(
      source({
        status: "failed",
        lastObservedAt: "2026-09-01T11:00:00.000Z",
        lastSuccessfulRunAt: "2026-08-01T12:00:00.000Z",
      }),
      now,
    ),
  ).toMatchObject({
    status: "failed",
    ageDays: 31,
  });
});

test("resolveSourceFreshness retains a partial ingestion receipt", () => {
  expect(
    resolveSourceFreshness(
      source({ status: "partial", statusMessage: "12 records were unavailable." }),
      now,
    ),
  ).toMatchObject({
    status: "partial",
    message: "12 records were unavailable.",
  });
});

test("resolveSourceFreshness retains a failed ingestion receipt", () => {
  expect(
    resolveSourceFreshness(
      source({ status: "failed", statusMessage: "Upstream response failed." }),
      now,
    ),
  ).toMatchObject({
    status: "failed",
    message: "Upstream response failed.",
  });
});

test("resolveSourceFreshness marks disabled and timestamp-free sources unavailable", () => {
  expect(
    resolveSourceFreshness(source({ isEnabled: false }), now),
  ).toMatchObject({
    status: "unavailable",
    message: "This source is not enabled.",
  });

  expect(
    resolveSourceFreshness(
      source({ lastObservedAt: null, lastSuccessfulRunAt: null }),
      now,
    ),
  ).toMatchObject({
    status: "unavailable",
    message: "No source snapshot is available yet.",
  });
});

test("resolveSourceFreshness carries PoliBench's source-native operational freshness", () => {
  expect(
    resolveSourceFreshness(
      source({
        sourceKey: "polibench",
        displayName: "PoliBench",
        coverageLabel: "103 models / 110 runs",
        lastObservedAt: "2026-08-30T07:15:38.021Z",
        lastSuccessfulRunAt: "2026-08-30T07:15:38.021Z",
      }),
      now,
    ),
  ).toMatchObject({
    sourceKey: "polibench",
    coverageLabel: "103 models / 110 runs",
    status: "healthy",
    ageDays: 2,
  });
});

test("getFreshnessUpdatedAt preserves the newest source observation instead of a newer successful receipt", () => {
  const sources: SourceFreshness[] = [
    {
      sourceKey: "artificial-analysis",
      displayName: "Artificial Analysis",
      status: "healthy",
      lastObservedAt: new Date("2026-08-30T12:00:00.000Z"),
      lastSuccessfulRunAt: new Date("2026-09-01T12:00:00.000Z"),
      coverageLabel: "320 models",
      ageDays: 0,
      message: "Current source snapshot is available.",
    },
    {
      sourceKey: "epoch-ai",
      displayName: "Epoch AI",
      status: "healthy",
      lastObservedAt: new Date("2026-08-31T12:00:00.000Z"),
      lastSuccessfulRunAt: new Date("2026-08-31T12:00:00.000Z"),
      coverageLabel: "1,000 observations",
      ageDays: 1,
      message: "Current source snapshot is available.",
    },
  ];

  expect(getFreshnessUpdatedAt(sources)?.toISOString()).toBe(
    "2026-08-31T12:00:00.000Z",
  );
});
