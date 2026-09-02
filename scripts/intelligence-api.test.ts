/// <reference types="bun" />

import { afterEach, expect, mock, test } from "bun:test";

const { GET } = await import("../src/pages/api/intelligence.json");
const { fetchIntelligenceRefresh } = await import("../src/lib/live-data");
type IntelligenceRefreshPayload = import("../src/lib/live-data").IntelligenceRefreshPayload;

const restoreFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = restoreFetch;
});

test("intelligence endpoint returns a versioned build contract with explicit live or fallback metadata", async () => {
  const response = await GET({} as never);

  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBeNull();
  expect(response.headers.get("Content-Type")).toContain("application/json");

  const payload = await response.json();
  expect(payload.delivery.generatedAt).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  );
  expect(payload).toMatchObject({
    schemaVersion: "1.0",
    delivery: {
      mode: "build-snapshot",
      generatedAt: expect.any(String),
      refreshRequiresBuild: true,
    },
    taskPresets: expect.arrayContaining([
      expect.objectContaining({
        id: "coding",
        minimumCoverage: 2,
        weights: expect.any(Object),
      }),
    ]),
    overview: expect.objectContaining({
      qualityVsPrice: expect.objectContaining({
        qualityMetricKey: "aa_intelligence_index",
        priceMetricKey: "price_1m_blended_3_to_1",
      }),
    }),
  });
  expect(payload.freshness).toHaveProperty("updatedAt");
  expect(payload.freshness).toHaveProperty("aaLastSeen");
  expect(payload.freshness).toHaveProperty("epochFetchedAt");
  expect(payload.freshness.fallback.mode).toMatch(/^(live-view|static-snapshot)$/);
  expect(payload.freshness.fallback.fallback).toBe(
    payload.freshness.fallback.mode === "static-snapshot",
  );
  if (payload.freshness.fallback.fallback) {
    expect(payload.freshness.fallback.reason).toEqual(expect.any(String));
  } else {
    expect(payload.freshness.fallback.reason).toBeNull();
  }
  expect(Array.isArray(payload.freshness.sources)).toBe(true);
  expect(payload.freshness.sources.length).toBeGreaterThan(0);
  expect(payload.freshness.sources).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        sourceKey: expect.any(String),
        displayName: expect.any(String),
        status: expect.stringMatching(/^(healthy|stale|partial|failed|unavailable)$/),
        message: expect.any(String),
      }),
    ]),
  );
});

test("fetchIntelligenceRefresh rejects malformed browser payloads instead of accepting a partial contract", async () => {
  globalThis.fetch = mock(async () =>
    new Response(
      JSON.stringify({
        schemaVersion: "1.0",
        delivery: {
          mode: "build-snapshot",
          generatedAt: "not-a-date",
          refreshRequiresBuild: true,
        },
        freshness: {
          updatedAt: "2026-09-01T00:00:00.000Z",
          aaLastSeen: null,
          epochFetchedAt: null,
          sources: "not-an-array",
          fallback: { mode: "live-view", fallback: false, reason: null },
        },
        taskPresets: [],
        overview: {
          qualityVsPrice: {
            qualityMetricKey: "aa_intelligence_index",
            priceMetricKey: "price_1m_blended_3_to_1",
            qualityLabel: "Quality",
            priceLabel: "Price",
          },
          coverageMetrics: [],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  ) as unknown as typeof fetch;

  expect(await fetchIntelligenceRefresh()).toBeNull();
});

test("fetchIntelligenceRefresh accepts the full browser refresh contract", async () => {
  const payload: IntelligenceRefreshPayload = {
    schemaVersion: "1.0",
    delivery: {
      mode: "build-snapshot",
      generatedAt: "2026-09-01T00:00:00.000Z",
      refreshRequiresBuild: true,
    },
    freshness: {
      updatedAt: "2026-09-01T00:00:00.000Z",
      aaLastSeen: "2026-08-31T00:00:00.000Z",
      epochFetchedAt: "2026-08-30T00:00:00.000Z",
      sources: [
        {
          sourceKey: "artificial-analysis",
          displayName: "Artificial Analysis",
          status: "healthy",
          lastObservedAt: "2026-08-31T00:00:00.000Z",
          lastSuccessfulRunAt: "2026-08-31T00:00:00.000Z",
          coverageLabel: "320 models",
          ageDays: 1,
          message: "Current source snapshot is available.",
        },
      ],
      fallback: {
        mode: "live-view",
        fallback: false,
        reason: null,
      },
    },
    taskPresets: [
      {
        id: "coding",
        label: "Coding agent",
        minimumCoverage: 2,
        budgetMetricKey: "price_1m_blended_3_to_1",
        weights: {
          aa_coding_index: 0.5,
          livecodebench: 0.3,
          price_1m_blended_3_to_1: 0.2,
        },
        metricDirections: {
          price_1m_blended_3_to_1: "lower-is-better",
        },
      },
    ],
    overview: {
      qualityVsPrice: {
        qualityMetricKey: "aa_intelligence_index",
        priceMetricKey: "price_1m_blended_3_to_1",
        qualityLabel: "Artificial Analysis Intelligence Index",
        priceLabel: "Blended price, USD per 1M tokens",
      },
      coverageMetrics: [
        {
          key: "aa_intelligence_index",
          label: "Intelligence Index",
          sourceKey: "artificial-analysis",
          unit: "index",
        },
      ],
    },
  };

  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(input).toBe("/api/intelligence.json");
    expect(init).toMatchObject({ cache: "no-store" });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;

  expect(await fetchIntelligenceRefresh()).toEqual(payload);
});
