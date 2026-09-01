/// <reference types="bun" />

import { expect, mock, test } from "bun:test";

const queryState = {
  table: "",
  select: "",
  order: [] as unknown[],
  ilike: [] as unknown[],
  not: [] as unknown[],
};

const queryResult = [
  {
    id: "model-1",
    name: "GPT-4o Mini",
    slug: "gpt-4o-mini",
    creator_name: "OpenAI",
    aa_intelligence_index: 91.2,
    price_1m_input_tokens: 0.15,
    price_1m_output_tokens: 0.6,
  },
];

const publicCatalogs = {
  openRouterModels: [
    {
      openrouter_id: "openai/gpt-4o-mini",
      canonical_slug: "openai/gpt-4o-mini",
      author_slug: "openai",
      model_slug: "gpt-4o-mini",
      name: "GPT-4o Mini",
      context_length: 128000,
      prompt_price_1m: 0.15,
      completion_price_1m: 0.6,
      supported_parameters: ["tools"],
      input_modalities: ["text"],
      output_modalities: ["text"],
      is_free: false,
    },
  ],
  huggingFaceModels: [
    {
      model_id: "openai/gpt-4o-mini",
      author: "openai",
      downloads: 1234,
      likes: 42,
      pipeline_tag: "text-generation",
      library_name: "transformers",
      last_modified: "2025-05-01T00:00:00Z",
      tags: ["inference"],
    },
  ],
  liteLlmModels: [
    {
      model_id: "openai/gpt-4o-mini",
      provider: "openai",
      mode: "chat",
      max_input_tokens: 128000,
      max_output_tokens: 16384,
      input_price_1m: 0.15,
      output_price_1m: 0.6,
      supports_vision: true,
      supports_function_calling: true,
      supports_reasoning: false,
      supports_prompt_caching: true,
      supports_system_messages: true,
      supports_web_search: false,
    },
  ],
  openRouterUsageRankings: [
    {
      model_permaslug: "openai/gpt-4o-mini",
      variant_permaslug: "openai/gpt-4o-mini/default",
      provider: "openai",
      variant: "default",
      rank: 1,
      total_tokens: 1000,
      request_count: 50,
      tool_calls: 7,
      tool_call_errors: 1,
      usage_share: 0.42,
      change: 0.01,
      date: "2025-05-01",
    },
  ],
  openRouterEndpointSummaries: [
    {
      openrouter_id: "openai/gpt-4o-mini",
      provider_count: 2,
      providers: ["openai", "azure"],
      quantizations: ["fp16"],
      max_context_length: 128000,
      min_prompt_price_1m: 0.15,
      min_completion_price_1m: 0.6,
    },
  ],
};

const query = {
  select(select: string) {
    queryState.select = select;
    return this;
  },
  order(...args: unknown[]) {
    queryState.order = args;
    return this;
  },
  ilike(...args: unknown[]) {
    queryState.ilike = args;
    return this;
  },
  not(...args: unknown[]) {
    queryState.not = args;
    return this;
  },
  then(onFulfilled: (value: { data: unknown[]; error: null }) => unknown) {
    return Promise.resolve({ data: queryResult, error: null }).then(onFulfilled);
  },
};

mock.module("../src/lib/supabase", () => ({
  AA_MODEL_SELECT_COLUMNS: ["id", "name", "slug"],
  supabase: {
    from(table: string) {
      queryState.table = table;
      return query;
    },
  },
  normalizeAaModelsForDisplay: (models: unknown[]) => models,
  enrichModelsWithPublicCatalogData: (models: unknown[]) => models,
  getPublicCatalogModels: async () => publicCatalogs,
}));

const [{ GET: getModels }, { GET: getPublicCatalogs }] = await Promise.all([
  import("../src/pages/api/models.json"),
  import("../src/pages/api/public-catalogs.json"),
]);

test("models endpoint filters search and benchmark params before returning public model data", async () => {
  const response = await getModels({
    url: new URL("https://example.test/api/models.json?search=GPT_*&benchmark=gpqa"),
  } as never);

  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  expect(queryState).toMatchObject({
    table: "aa_models",
    select: "id,name,slug",
    ilike: ["name", "%GPT%"],
    not: ["gpqa", "is", null],
  });

  expect(await response.json()).toEqual([
    {
      ...queryResult[0],
      company_name: "OpenAI",
    },
  ]);
});

test("public catalogs endpoint serializes the public contract and cache header", async () => {
  const response = await getPublicCatalogs({} as never);

  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
  expect(await response.json()).toMatchObject(publicCatalogs);
});
