/// <reference types="bun" />

import { afterEach, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fetchLiveSnapshot } from "../src/lib/live-data";

const originalFetch = globalThis.fetch;
const dashboardSource = readFileSync("src/components/Dashboard.astro", "utf8");
const compareSource = readFileSync("src/pages/compare.astro", "utf8");

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const rowFor = (pathname: string, index: number): Record<string, unknown> => {
  if (pathname.endsWith("/aa_models")) {
    return {
      id: `aa-${index}`,
      slug: `aa-${index}`,
      name: `AA ${index}`,
      first_seen: "",
      last_seen: "",
    };
  }
  if (pathname.endsWith("/epoch_models")) {
    return { id: `epoch-${index}`, model_version: `epoch-${index}` };
  }
  if (pathname.endsWith("/epoch_benchmarks")) {
    return {
      id: `benchmark-${index}`,
      slug: `benchmark-${index}`,
      name: `Benchmark ${index}`,
    };
  }
  return {
    id: `run-${index}`,
    model_version: `epoch-${index}`,
    benchmark_id: `benchmark-${index}`,
    score: index,
  };
};

test("public routes do not schedule a direct Supabase table refresh", () => {
  for (const source of [dashboardSource, compareSource]) {
    expect(source).not.toContain('import { fetchLiveSnapshot }');
    expect(source).not.toContain("scheduleLiveRefresh");
  }
});

test("the diagnostic live snapshot helper caps oversized table responses", async () => {
  const supabaseCalls: URL[] = [];
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const raw = String(input);
    if (raw.startsWith("/")) return new Response(null, { status: 404 });

    const url = new URL(raw);
    supabaseCalls.push(url);
    return Response.json(
      Array.from({ length: 1_000 }, (_, index) => rowFor(url.pathname, index)),
    );
  }) as unknown as typeof fetch;

  const snapshot = await fetchLiveSnapshot({
    supabaseUrl: "https://public-project.supabase.co",
    supabaseAnonKey: "public-anon-key",
    includeEpoch: true,
  });

  expect(supabaseCalls).toHaveLength(4);
  expect(supabaseCalls.every((url) => url.searchParams.get("limit") === "250")).toBeTrue();
  expect(supabaseCalls.every((url) => url.searchParams.get("offset") === "0")).toBeTrue();
  expect(snapshot).not.toBeNull();
  expect(snapshot?.aaModels).toHaveLength(250);
  expect(snapshot?.epochModels).toHaveLength(250);
  expect(snapshot?.epochBenchmarks).toHaveLength(250);
  expect(snapshot?.epochRuns).toHaveLength(250);
});

test("the diagnostic live snapshot helper preserves a normal short response", async () => {
  const supabaseCalls: URL[] = [];
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const raw = String(input);
    if (raw.startsWith("/")) return new Response(null, { status: 404 });

    const url = new URL(raw);
    supabaseCalls.push(url);
    return Response.json(
      Array.from({ length: 2 }, (_, index) => rowFor(url.pathname, index)),
    );
  }) as unknown as typeof fetch;

  const snapshot = await fetchLiveSnapshot({
    supabaseUrl: "https://public-project.supabase.co",
    supabaseAnonKey: "public-anon-key",
    includeEpoch: true,
  });

  expect(supabaseCalls).toHaveLength(4);
  expect(snapshot?.aaModels).toHaveLength(2);
  expect(snapshot?.epochModels).toHaveLength(2);
  expect(snapshot?.epochBenchmarks).toHaveLength(2);
  expect(snapshot?.epochRuns).toHaveLength(2);
});
