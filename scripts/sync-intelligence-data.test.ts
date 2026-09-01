/// <reference types="bun" />

import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildIntelligencePayloads,
  runCli,
  syncIntelligenceData,
} from "./sync-intelligence-data.mjs";

const observedAt = "2026-08-30T07:15:38.021Z";

const createInput = (explicitAliases: unknown[] = []) => ({
  aa: {
    observedAt,
    models: [
      {
        slug: "same-model",
        name: "Same Model",
        creator_name: "OpenAI",
        last_seen: observedAt,
        aa_intelligence_index: 91.2,
        median_time_to_first_token_seconds: 0.42,
      },
    ],
  },
  epoch: {
    fetched_at: observedAt,
    benchmarks: [
      {
        slug: "math-test",
        name: "Math Test",
        description: "A source-native math evaluation.",
        updated_at: observedAt,
      },
    ],
    models: [
      {
        model_version: "epoch-model-v1",
        model_name: "Epoch Model",
        display_name: "Epoch Model v1",
        organization: "Example Lab",
        release_date: "2026-08-01",
      },
    ],
    runs: [
      {
        id: "epoch-run-1",
        model_version: "epoch-model-v1",
        benchmark_slug: "math-test",
        score: 0.75,
        score_metric: "Accuracy",
        source_link: "https://example.test/epoch-run-1",
      },
    ],
  },
  openrouter: {
    fetchedAt: observedAt,
    models: [
      {
        openrouter_id: "openai/same-model",
        name: "Same Model",
        author_slug: "openai",
        context_length: 128000,
        prompt_price_1m: 0.5,
        completion_price_1m: 1.5,
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    ],
  },
  polibench: {
    schemaVersion: "1.0",
    source: {
      repository: "https://github.com/JonathanRReed/Poli-bench",
      commit: "f49763cdbca9387d823ba19578992434b5ac04b0",
      artifactPath: "src/data/liveBenchmark.generated.json",
    },
    freshness: {
      generatedAt: observedAt,
      suite: "full",
      source: "live-convex-snapshot",
    },
    evidence: {
      kind: "live_operational_model_output",
      label: "Live operational model-output evidence",
      humanValidation: "not_collected",
      externalValidation: "not_externally_validated",
      paperRelease: "not_frozen",
      boundary: "Directional political axes are profiles, not quality scores.",
    },
    counts: { models: 1, rows: 1, runs: 1 },
    models: [
      {
        modelSlug: "openai/same-model",
        provider: "openai",
        label: "Same Model",
        note: "live completed Convex full-suite run",
        releases: {
          release: "v1",
          benchmarkRelease: "v1",
          paperReleaseVersion: "polibench-paper-v2.0.0",
        },
        runId: "polibench-run-1",
        status: "completed",
        evidenceLevel: 2,
        evidenceLabel: "live completed Convex full-suite run",
        scoreStatus: "renderable",
        uncertaintySummary: "Model-output profiling only.",
        robustness: 80.7,
        completionRate: 100,
        completedResponses: 270,
        parseValidResponses: 270,
        parseValidity: 100,
        paraphraseStability: 90.6,
        rerunStability: 0,
        contradictionConsistency: 61.1,
        resolutionRate: 78.1,
        costPerCompletedResponse: 0.000559,
        p95LatencyMs: 6834,
        axisScores: [{ axis: "economy", score: -13.3, answeredItems: 30 }],
        lastRunStartedAt: 1788065536740,
        lastRunFinishedAt: 1788066306470,
        artifactLinks: {
          canonicalResponses: "/api/runs/polibench-run-1",
          axisIntervals: "/api/runs/polibench-run-1",
          responseStyleControls: "/api/runs/polibench-run-1",
          exclusions: "/api/runs/polibench-run-1",
          duplicateResolution: "/api/runs/polibench-run-1",
          rawResponses: "/api/runs/polibench-run-1",
        },
      },
    ],
    runs: [
      {
        runId: "polibench-run-1",
        suite: "full",
        modelSlug: "openai/same-model",
        status: "completed",
        startedAt: 1788065536740,
        finishedAt: 1788066306470,
        expectedResponses: 270,
        completedResponses: 270,
        parseValidResponses: 270,
        completionRate: 100,
        parseValidity: 100,
        rerunStability: 0,
        robustness: 80.7,
        costPerCompletedResponse: 0.000559,
        p95LatencyMs: 6834,
        releases: {
          release: "v1",
          benchmarkRelease: "v1",
          paperReleaseVersion: "polibench-paper-v2.0.0",
        },
      },
    ],
  },
  explicitAliases,
});

const rejectionMessage = async (operation: Promise<unknown>): Promise<string> => {
  try {
    await operation;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected operation to reject");
};

test("payload builders are deterministic and keep native source identities separate", () => {
  const first = buildIntelligencePayloads(createInput());
  const second = buildIntelligencePayloads(createInput());

  expect(first).toEqual(second);
  expect(first.sources.map((source: { source_key: string }) => source.source_key)).toEqual([
    "artificial-analysis",
    "epoch-ai",
    "openrouter",
    "polibench",
  ]);
  expect(first.canonicalModels.map((model: { canonical_key: string }) => model.canonical_key)).toEqual([
    "artificial-analysis:same-model",
    "epoch-ai:epoch-model-v1",
    "openrouter:openai/same-model",
    "polibench:openai/same-model",
  ]);
  expect(first.aliases).toContainEqual(expect.objectContaining({
    canonical_key: "polibench:openai/same-model",
    source_key: "polibench",
    source_model_key: "openai/same-model",
    match_method: "source_native",
    confidence: 1,
  }));
  expect(first.aliases.some((alias: { match_method: string }) =>
    alias.match_method === "explicit_cross_source")).toBe(false);
  expect(first.sources.every((source: Record<string, unknown>) => [
    "status",
    "status_message",
    "coverage_label",
    "last_observed_at",
    "last_successful_run_at",
    "updated_at",
  ].every((key) => !(key in source)))).toBe(true);
});

test("PoliBench cross-source joins require an explicit provenance-bearing alias", () => {
  const payloads = buildIntelligencePayloads(createInput([
    {
      sourceKey: "polibench",
      sourceModelKey: "openai/same-model",
      canonicalKey: "artificial-analysis:same-model",
      provenance: "Reviewed against vendor model cards on 2026-08-30.",
      confidence: 0.98,
    },
  ]));

  expect(payloads.canonicalModels.some((model: { canonical_key: string }) =>
    model.canonical_key === "polibench:openai/same-model")).toBe(false);
  expect(payloads.aliases).toContainEqual(expect.objectContaining({
    canonical_key: "artificial-analysis:same-model",
    source_key: "polibench",
    source_model_key: "openai/same-model",
    match_method: "explicit_cross_source",
    provenance: "Reviewed against vendor model cards on 2026-08-30.",
    confidence: 0.98,
  }));
  expect(() => buildIntelligencePayloads(createInput([
    {
      sourceKey: "polibench",
      sourceModelKey: "openai/same-model",
      canonicalKey: "artificial-analysis:same-model",
      provenance: "",
      confidence: 0.98,
    },
  ]))).toThrow("explicitAliases[0].provenance");
});

test("payload builders preserve benchmark values, directional axes, and snapshot provenance", () => {
  const payloads = buildIntelligencePayloads(createInput());

  expect(payloads.benchmarkDefinitions).toContainEqual(expect.objectContaining({
    source_key: "epoch-ai",
    benchmark_key: "math-test",
    unit: "source_native_score",
    higher_is_better: true,
  }));
  expect(payloads.observations).toContainEqual(expect.objectContaining({
    source_key: "epoch-ai",
    observation_key: "epoch-ai:epoch-run-1",
    value: 0.75,
  }));
  expect(payloads.benchmarkDefinitions).toContainEqual(expect.objectContaining({
    source_key: "polibench",
    benchmark_key: "axis:economy",
    unit: "directional_profile_score",
    higher_is_better: null,
  }));
  expect(payloads.observations).toContainEqual(expect.objectContaining({
    source_key: "polibench",
    observation_key: "polibench:polibench-run-1:axis:economy",
    value: -13.3,
  }));
  expect(payloads.polibenchSnapshots).toEqual([
    expect.objectContaining({
      source_key: "polibench",
      snapshot_key: "f49763cdbca9387d823ba19578992434b5ac04b0:2026-08-30T07:15:38.021Z",
      model_count: 1,
      row_count: 1,
      run_count: 1,
    }),
  ]);
});

test("payload builders reject malformed PoliBench run receipts and model linkage", () => {
  const wrongEvidenceContract = structuredClone(createInput());
  wrongEvidenceContract.polibench.evidence.kind = "paper_release";
  expect(() => buildIntelligencePayloads(wrongEvidenceContract)).toThrow(
    "input.polibench.evidence.kind must be live_operational_model_output",
  );

  const emptyAxes = structuredClone(createInput());
  emptyAxes.polibench.models[0]!.axisScores = [];
  expect(() => buildIntelligencePayloads(emptyAxes)).toThrow(
    "input.polibench.models[0].axisScores must not be empty",
  );

  const missingRunField = structuredClone(createInput());
  Reflect.deleteProperty(missingRunField.polibench.runs[0]!, "robustness");
  expect(() => buildIntelligencePayloads(missingRunField)).toThrow(
    "input.polibench.runs[0].robustness",
  );

  const duplicateRun = structuredClone(createInput());
  duplicateRun.polibench.runs.push(structuredClone(duplicateRun.polibench.runs[0]!));
  duplicateRun.polibench.counts.runs = 2;
  expect(() => buildIntelligencePayloads(duplicateRun)).toThrow("Duplicate PoliBench runId");

  const unknownModel = structuredClone(createInput());
  unknownModel.polibench.runs[0]!.modelSlug = "unknown/model";
  expect(() => buildIntelligencePayloads(unknownModel)).toThrow(
    "must exactly match a PoliBench model identity",
  );

  const mismatchedReceipt = structuredClone(createInput());
  mismatchedReceipt.polibench.models[0]!.runId = "missing-run";
  expect(() => buildIntelligencePayloads(mismatchedReceipt)).toThrow(
    "must resolve to a run receipt for the same modelSlug",
  );
});

test("sync fails closed before network activity when server credentials are absent", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response();
  };

  expect(await rejectionMessage(syncIntelligenceData({
    input: createInput(),
    env: {},
    fetchImpl,
  }))).toBe("Missing server configuration: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  expect(calls).toBe(0);
});

test("CLI dry-run validates a local bundle and never requires credentials or network access", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ai-stats-intelligence-"));
  const inputPath = path.join(tempDir, "input.json");
  await writeFile(inputPath, JSON.stringify(createInput()), "utf8");
  let calls = 0;
  let output = "";

  try {
    const result = await runCli({
      env: {},
      argv: ["node", "sync-intelligence-data.mjs", "--input", inputPath, "--dry-run"],
      fetchImpl: async () => {
        calls += 1;
        return new Response();
      },
      writeOutput: (value) => {
        output += value;
      },
    });

    expect(result).toEqual({
      status: "dry-run",
      counts: {
        sources: 4,
        canonicalModels: 4,
        aliases: 4,
        benchmarkDefinitions: 13,
        benchmarkVersions: 13,
        observations: 13,
        polibenchSnapshots: 1,
      },
    });
    expect(JSON.parse(output)).toEqual(result);
    expect(calls).toBe(0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("sync rejects remote HTTP Supabase URLs before network activity", async () => {
  let calls = 0;
  const message = await rejectionMessage(syncIntelligenceData({
    input: createInput(),
    env: {
      SUPABASE_URL: "http://remote.example.test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
    },
    fetchImpl: async () => {
      calls += 1;
      return new Response();
    },
  }));

  expect(message).toBe(
    "Invalid server configuration: SUPABASE_URL must use HTTPS except for explicit loopback development hosts",
  );
  expect(calls).toBe(0);
});

const successfulFetch = ({
  failTableOnce,
  omitFromTable,
}: { failTableOnce?: string; omitFromTable?: string } = {}) => {
  const requests: Array<{ url: string; init: RequestInit; body: unknown }> = [];
  let nextId = 1;
  let nextReceiptId = 1000;
  let didFailTable = false;
  const ids = new Map<string, number>();

  const fetchImpl = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    const body = init.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url, init, body });

    if (url.includes("/rpc/start_")) {
      nextReceiptId += 1;
      return Response.json(nextReceiptId);
    }
    if (url.includes("/rpc/finish_")) return Response.json(null);

    const table = url.match(/\/rest\/v1\/([^?]+)/u)?.[1] ?? "";
    const rows = Array.isArray(body) ? body : [];
    if (table === failTableOnce && !didFailTable) {
      didFailTable = true;
      return new Response(
        "service-role-secret https://project.example.test raw-model-payload",
        { status: 500 },
      );
    }
    const returned = rows.map((row: Record<string, unknown>) => {
      const naturalKey = String(
        row.source_key ?? row.canonical_key ?? row.benchmark_key ?? row.version_key ??
        row.observation_key ?? row.snapshot_key ?? row.source_model_key,
      );
      const key = `${table}:${naturalKey}:${String(row.intelligence_source_id ?? "")}:${String(row.benchmark_definition_id ?? "")}`;
      if (!ids.has(key)) ids.set(key, nextId++);
      return { ...row, id: ids.get(key) };
    });
    return Response.json(table === omitFromTable ? returned.slice(0, -1) : returned);
  };

  return { fetchImpl, requests };
};

test("sync allows HTTP only for explicit loopback development hosts", async () => {
  for (const url of [
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
  ]) {
    const { fetchImpl } = successfulFetch();
    const result = await syncIntelligenceData({
      input: createInput(),
      env: { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: "local-secret" },
      fetchImpl,
    });
    expect(result.status).toBe("succeeded");
  }
});

test("sync batches bounded REST upserts with atomic conflict keys and receipt RPCs", async () => {
  const { fetchImpl, requests } = successfulFetch();
  const result = await syncIntelligenceData({
    input: createInput(),
    env: {
      SUPABASE_URL: "https://project.example.test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
    },
    fetchImpl,
    batchSize: 2,
  });

  expect(result.status).toBe("succeeded");
  expect(result.counts.sources).toBe(4);
  expect(requests[0]?.url).toBe(
    "https://project.example.test/rest/v1/rpc/start_intelligence_ingestion",
  );
  expect(requests.at(-1)?.url).toBe(
    "https://project.example.test/rest/v1/rpc/finish_intelligence_ingestion",
  );
  const upserts = requests.filter((request) => !request.url.includes("/rpc/"));
  expect(upserts.every((request) => Array.isArray(request.body) && request.body.length <= 2)).toBe(true);
  expect(upserts.some((request) => request.url.includes(
    "/rest/v1/benchmark_observations?on_conflict=intelligence_source_id%2Cobservation_key",
  ))).toBe(true);
  expect(upserts.every((request) => request.init.headers &&
    new Headers(request.init.headers).get("Prefer") === "resolution=merge-duplicates,return=representation")).toBe(true);
  expect(requests.every((request) => !request.url.includes("service-role-secret"))).toBe(true);

  const sourceWrites = requests.filter((request) =>
    request.url.includes("/rest/v1/intelligence_sources?"));
  const identityRows = sourceWrites.flatMap((request) =>
    Array.isArray(request.body) ? request.body : []).filter((row) =>
    !(row as Record<string, unknown>).status);
  const healthyRows = sourceWrites.flatMap((request) =>
    Array.isArray(request.body) ? request.body : []).filter((row) =>
    (row as Record<string, unknown>).status === "healthy") as Array<Record<string, unknown>>;
  expect(identityRows).toHaveLength(4);
  expect(identityRows.every((row) => !("last_successful_run_at" in (row as Record<string, unknown>)))).toBe(true);
  expect(healthyRows).toHaveLength(4);
  expect(healthyRows.every((row) => typeof row.last_successful_run_at === "string")).toBe(true);
  const firstHealthyWrite = requests.findIndex((request) =>
    Array.isArray(request.body) && request.body.some((row) =>
      (row as Record<string, unknown>).status === "healthy"));
  const firstSourceSuccessReceipt = requests.findIndex((request) =>
    request.url.includes("/rpc/finish_intelligence_source_ingestion") &&
    (request.body as Record<string, unknown>)?.p_status === "succeeded");
  expect(firstSourceSuccessReceipt).toBeGreaterThan(-1);
  expect(firstHealthyWrite).toBeGreaterThan(firstSourceSuccessReceipt);
});

test("sync sanitizes upstream failures and never exposes URLs, keys, payloads, or response bodies", async () => {
  const { fetchImpl, requests } = successfulFetch({ failTableOnce: "benchmark_definitions" });

  const message = await rejectionMessage(syncIntelligenceData({
    input: createInput(),
    env: {
      SUPABASE_URL: "https://project.example.test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
    },
    fetchImpl,
  }));

  expect(message).toBe("Intelligence sync failed during benchmark_definitions upsert (HTTP 500)");
  expect(message).not.toContain("service-role-secret");
  expect(message).not.toContain("project.example.test");
  expect(message).not.toContain("raw-model-payload");

  const failureIndex = requests.findIndex((request) =>
    request.url.includes("/rest/v1/benchmark_definitions?"));
  const correctionRows = requests.slice(failureIndex + 1).flatMap((request) =>
    request.url.includes("/rest/v1/intelligence_sources?") && Array.isArray(request.body)
      ? request.body
      : []).filter((row) => ["failed", "partial"].includes(
        String((row as Record<string, unknown>).status),
      )) as Array<Record<string, unknown>>;
  expect(correctionRows).toHaveLength(4);
  expect(correctionRows.every((row) => !("last_successful_run_at" in row))).toBe(true);
});

test("sync fails locally when any dependent upsert representation omits a required ID", async () => {
  const cases = [
    {
      table: "intelligence_sources",
      message: "Intelligence sync failed during source identity resolution",
      forbiddenPath: "/rpc/start_intelligence_source_ingestion",
    },
    {
      table: "canonical_models",
      message: "Intelligence sync failed during canonical model identity resolution",
      forbiddenPath: "/rest/v1/benchmark_definitions?",
    },
    {
      table: "benchmark_definitions",
      message: "Intelligence sync failed during benchmark definition identity resolution",
      forbiddenPath: "/rest/v1/benchmark_versions?",
    },
    {
      table: "benchmark_versions",
      message: "Intelligence sync failed during benchmark version identity resolution",
      forbiddenPath: "/rest/v1/model_aliases?",
    },
  ];

  for (const testCase of cases) {
    const { fetchImpl, requests } = successfulFetch({ omitFromTable: testCase.table });
    const message = await rejectionMessage(syncIntelligenceData({
      input: createInput(),
      env: {
        SUPABASE_URL: "https://project.example.test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
      },
      fetchImpl,
    }));

    expect(message).toBe(testCase.message);
    const omittedResponseIndex = requests.findIndex((request) =>
      request.url.includes(`/rest/v1/${testCase.table}?`));
    expect(omittedResponseIndex).toBeGreaterThan(-1);
    expect(requests.slice(omittedResponseIndex + 1).some((request) =>
      request.url.includes(testCase.forbiddenPath))).toBe(false);
  }
});
