/// <reference types="bun" />

import { expect, test } from "bun:test";
import type { AaModel } from "./supabase";
import {
  buildModelJsonLd,
  buildModelPageRecords,
  matchEpochRuns,
  modelPageSlug,
  modelRecordToText,
} from "./model-pages";

const model = (overrides: Partial<AaModel>): AaModel =>
  ({
    id: "id-1",
    name: "Test Model 1",
    slug: "test-model-1",
    creator_id: null,
    creator_name: "Test Labs",
    creator_slug: "test-labs",
    evaluations: null,
    aa_intelligence_index: 42.5,
    aa_coding_index: 40,
    aa_math_index: 50,
    mmlu_pro: 0.81,
    gpqa: 0.7,
    hle: null,
    livecodebench: null,
    scicode: null,
    math_500: null,
    aime: null,
    pricing: null,
    price_1m_blended_3_to_1: 2.5,
    price_1m_input_tokens: 1,
    price_1m_output_tokens: 7,
    median_output_tokens_per_second: 88.4,
    median_time_to_first_token_seconds: 0.42,
    median_time_to_first_answer_token: null,
    first_seen: "2026-06-01T00:00:00+00:00",
    last_seen: "2026-09-04T00:00:06+00:00",
    ...overrides,
  }) as AaModel;

test("slugs come from the AA slug and fall back to the name", () => {
  expect(modelPageSlug({ slug: "gpt-6-astra", name: "GPT-6 Astra", id: "x" })).toBe("gpt-6-astra");
  expect(modelPageSlug({ slug: null, name: "Claude Fable 5.1 (Max Effort)", id: "x" })).toBe("claude-fable-5-1-max-effort");
  expect(modelPageSlug({ slug: null, name: null, id: "9b16-6bf3" })).toBe("9b16-6bf3");
});

test("colliding slugs get a numeric suffix instead of overwriting a page", () => {
  const records = buildModelPageRecords([
    model({ id: "a", slug: "same" }),
    model({ id: "b", slug: "same" }),
    model({ id: "c", slug: "Same" }),
  ]);
  expect(records.map((record) => record.slug)).toEqual(["same", "same-2", "same-3"]);
  expect(records[1].path).toBe("/models/same-2");
});

test("the record carries the receipt, the sibling routes, and only real values", () => {
  const [record] = buildModelPageRecords(
    [
      model({
        openrouter_id: "test-labs/test-model-1",
        openrouter_context_length: 200000,
        hf_model_id: "test-labs/test-model-1",
        litellm_model_id: "test-model-1",
        litellm_supports_function_calling: true,
      }),
    ],
    {
      poliBench: {
        models: [
          {
            modelSlug: "test-labs/test-model-1",
            label: "Test Model 1",
            status: "completed",
            evidenceLabel: "Live operational model-output evidence",
            completionRate: 99.1,
            robustness: 91.2,
            lastRunFinishedAt: Date.UTC(2026, 7, 30),
          },
        ],
      } as never,
    },
  );

  expect(record.url).toBe("https://aistats.jonathanrreed.com/models/test-model-1");
  expect(record.lastSeenDate).toBe("2026-09-04");
  expect(record.pricing.find((m) => m.key === "price_1m_input_tokens")?.value).toBe(1);
  expect(record.benchmarks.find((m) => m.key === "hle")?.value).toBeNull();
  expect(record.catalog.capabilities).toContain("Tool calls");
  expect(record.routes.promptInfo).toBe("https://prompt-info.helloworldfirm.com/?model=test-labs%2Ftest-model-1");
  expect(record.routes.poliBench).toBe("https://polibench.jonathanrreed.com/models/test-labs/test-model-1/");
  expect(record.routes.aiDragRace).toContain("provider=openrouter");
  expect(record.poliBench?.url).toBe("https://polibench.jonathanrreed.com/models/test-labs/test-model-1/");
  expect(record.aliases.map((alias) => alias.sourceKey)).toEqual([
    "artificial_analysis",
    "openrouter",
    "huggingface",
    "litellm",
    "polibench",
  ]);
});

test("Epoch runs join on the same normalized aliases the dashboard uses", () => {
  const runs = matchEpochRuns(
    { name: "Test Model 1", slug: "test-model-1" },
    [
      { id: "r1", model_version: "test-model-1", benchmark_id: "b1", score: 0.55, release_date: null, organization: null, country: null, stderr: 0.02, source_name: "Epoch AI", source_link: "https://epoch.ai/x" },
      { id: "r2", model_version: "Other", benchmark_id: "b1", score: 0.9, release_date: null, organization: null, country: null, stderr: null },
    ],
    [{ id: "b1", slug: "gpqa_diamond", name: "GPQA Diamond", description: null, source: null }],
  );
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({ benchmark: "GPQA Diamond", score: 0.55, stderr: 0.02, sourceLink: "https://epoch.ai/x" });
});

test("the JSON-LD graph exposes a Dataset with a download and measured variables", () => {
  const [record] = buildModelPageRecords([model({ openrouter_id: "test-labs/test-model-1" })]);
  const graph = buildModelJsonLd(record);
  const dataset = graph.find((node) => node["@type"] === "Dataset") as Record<string, unknown>;
  const application = graph.find((node) => node["@type"] === "SoftwareApplication") as Record<string, unknown>;

  expect(dataset.dateModified).toBe("2026-09-04");
  expect(dataset.temporalCoverage).toBe("2026-06-01/2026-09-04");
  expect(dataset.creator).toEqual({ "@id": "https://jonathanrreed.com/#person" });
  expect((dataset.distribution as Array<{ contentUrl: string }>)[0].contentUrl).toBe(
    "https://aistats.jonathanrreed.com/api/model-pages/test-model-1.json",
  );
  const measured = dataset.variableMeasured as Array<{ propertyID: string; value: number }>;
  expect(measured.some((entry) => entry.propertyID === "hle")).toBe(false);
  expect(measured.find((entry) => entry.propertyID === "median_output_tokens_per_second")?.value).toBe(88.4);
  expect(application.sameAs).toEqual(["https://openrouter.ai/test-labs/test-model-1"]);
  expect(graph.some((node) => node["@type"] === "BreadcrumbList")).toBe(true);
});

test("the text form is compact and names its sources", () => {
  const [record] = buildModelPageRecords([model({})]);
  const text = modelRecordToText(record);
  expect(text).toContain("### Test Model 1 (Test Labs)");
  expect(text).toContain("input $1.00, output $7.00");
  expect(text).toContain("MMLU-Pro 81.0%");
  expect(text).toContain("Observed: first 2026-06-01, last 2026-09-04");
});
