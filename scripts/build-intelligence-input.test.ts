/// <reference types="bun" />

import { expect, test } from "bun:test";
import { buildIntelligenceInput, fetchSupabaseRows, normalizeOpenRouterModel } from "./build-intelligence-input.mjs";

test("normalizeOpenRouterModel preserves source data and normalizes pricing and modalities", () => {
  expect(normalizeOpenRouterModel({
    id: "openai/current-model",
    name: "Current model",
    context_length: 128000,
    pricing: { prompt: "0.000002", completion: "0.000008" },
    architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
  })).toMatchObject({
    openrouter_id: "openai/current-model",
    author_slug: "openai",
    prompt_price_1m: 2,
    completion_price_1m: 8,
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
  });
});

test("fetchSupabaseRows paginates without placing credentials in the URL", async () => {
  const calls: Array<{ url: URL; authorization: string | null }> = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, authorization: new Headers(init?.headers).get("authorization") });
    const offset = Number(url.searchParams.get("offset"));
    return new Response(JSON.stringify(offset === 0
      ? Array.from({ length: 1000 }, (_, id) => ({ id }))
      : [{ id: 1000 }]), { status: 200 });
  };
  const rows = await fetchSupabaseRows({
    fetchImpl,
    baseUrl: "https://bgbqdzmgxkwstjihgeef.supabase.co",
    serviceKey: "server-only-key",
    table: "aa_models",
  });
  expect(rows).toHaveLength(1001);
  expect(calls).toHaveLength(2);
  expect(calls.every((call) => !call.url.href.includes("server-only-key"))).toBe(true);
  expect(calls.every((call) => call.authorization === "Bearer server-only-key")).toBe(true);
});

test("buildIntelligenceInput joins the live and checked source bundles", async () => {
  const epoch = { fetched_at: "2026-04-25T00:00:00Z", models: [{ model_version: "epoch-model" }], benchmarks: [], runs: [] };
  const polibench = { models: [{ modelSlug: "openai/current-model" }], runs: [{ runId: "run-1" }] };
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/rest/v1/aa_models")) {
      return new Response(JSON.stringify([{ id: 1, slug: "aa-model", name: "AA model", last_seen: "2026-09-01T00:00:00Z" }]), { status: 200 });
    }
    return new Response(JSON.stringify({ data: [{ id: "openai/current-model", name: "Current model" }] }), { status: 200 });
  };
  const readJson = async (filePath: string) => filePath.includes("epoch-") ? epoch : polibench;
  const input = await buildIntelligenceInput({
    env: {
      SUPABASE_URL: "https://bgbqdzmgxkwstjihgeef.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "server-only-key",
    },
    fetchImpl,
    readJson,
  });
  expect(input.aa.observedAt).toBe("2026-09-01T00:00:00.000Z");
  expect(input.epoch).toBe(epoch);
  expect(input.polibench).toBe(polibench);
  expect(input.openrouter.models[0]?.openrouter_id).toBe("openai/current-model");
  expect(input.explicitAliases).toEqual([]);
});

test("buildIntelligenceInput keeps the freshest Artificial Analysis row for each slug", async () => {
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/rest/v1/aa_models")) {
      return new Response(JSON.stringify([
        {
          id: "older-id",
          slug: "duplicate-model",
          name: "Older name",
          creator_slug: "older-provider",
          first_seen: "2026-01-01T00:00:00Z",
          last_seen: "2026-08-01T00:00:00Z",
        },
        {
          id: "newer-id",
          slug: "duplicate-model",
          name: "Current name",
          creator_slug: "current-provider",
          first_seen: "2026-02-01T00:00:00Z",
          last_seen: "2026-09-01T00:00:00Z",
        },
      ]), { status: 200 });
    }
    return new Response(JSON.stringify({ data: [{ id: "openai/current-model", name: "Current model" }] }), { status: 200 });
  };
  const readJson = async (filePath: string) => filePath.includes("epoch-")
    ? { fetched_at: "2026-04-25T00:00:00Z", models: [], benchmarks: [], runs: [] }
    : { models: [], runs: [] };

  const input = await buildIntelligenceInput({
    env: {
      SUPABASE_URL: "https://bgbqdzmgxkwstjihgeef.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "server-only-key",
    },
    fetchImpl,
    readJson,
  });

  expect(input.aa.models).toEqual([
    expect.objectContaining({
      id: "newer-id",
      slug: "duplicate-model",
      name: "Current name",
      creator_slug: "current-provider",
    }),
  ]);
  expect(input.aa.observedAt).toBe("2026-09-01T00:00:00.000Z");
});
