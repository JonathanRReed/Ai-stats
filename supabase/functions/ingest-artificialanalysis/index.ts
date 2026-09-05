// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/**
 * Ai-dex :: ingest-artificialanalysis (v2)
 *
 * Migrated off the legacy endpoint `/api/v2/data/llms/models`, which is absent from the
 * Artificial Analysis OpenAPI contract (https://artificialanalysis.ai/api/v2/openapi) and is
 * therefore outside the supported surface. Every field path below is taken from that contract.
 *
 * Base URL and the `x-api-key` header are UNCHANGED. What changed is the path namespace,
 * the response envelope (pagination), and the model object shape.
 */

const AA_BASE = "https://artificialanalysis.ai/api/v2";

/** Pro+ endpoint. Returns 403 for Free keys ("Language models list requires a Pro subscription"). */
const PATH_PRO = "language/models";
/** Free-shape sibling. Accepts any valid key; only the `page` parameter. */
const PATH_FREE = "language/models/free";

/**
 * Pinned to `medium` (1,000 input tokens, 1 parallel query) to preserve continuity with the
 * historical speed/TTFT series in aa_models. The legacy API defaulted to medium; the V2 API
 * defaults to `long` (10,000 input tokens), which would silently re-baseline every latency number.
 * Only the Pro path accepts this parameter — `/free` takes `page` only.
 */
const PROMPT_TYPE = "medium";

/** Rate-limit safety: Free tier is 100 req/day, Pro 500. Cron runs twice daily. */
const MAX_PAGES = 6;

const USER_AGENT =
  "Ai-dex-ingest-artificialanalysis/2.0 (Supabase Edge Function; project Ai-dex)";

/**
 * Columns in aa_models whose source fields were REMOVED by the V2 language API:
 *   evaluations.artificial_analysis_math_index -> aa_math_index
 *   evaluations.mmlu_pro                       -> mmlu_pro
 *   evaluations.livecodebench                  -> livecodebench
 *   evaluations.math_500                       -> math_500
 *   evaluations.aime                           -> aime
 *   model_creator.slug                         -> creator_slug
 *
 * The columns are KEPT. By default these keys are omitted from the upsert payload entirely, so
 * `ON CONFLICT (id) DO UPDATE` never touches them and historical values survive; brand-new rows
 * get NULL from the column default. Flip the flag below to actively write NULL on every run
 * instead (destructive to history — only do that if a deliberate reset is wanted).
 */
const NULL_OUT_RETIRED_COLUMNS = false;

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function pageUrl(path: string, page: number): string {
  const url = new URL(`${AA_BASE}/${path}`);
  // `/free` rejects nothing but accepts nothing beyond `page`; do not send prompt_type there.
  if (path === PATH_PRO) url.searchParams.set("prompt_type", PROMPT_TYPE);
  url.searchParams.set("page", String(page));
  return url.toString();
}

async function fetchPage(path: string, page: number, apiKey: string) {
  const res = await fetch(pageUrl(path, page), {
    headers: {
      "x-api-key": apiKey,
      "User-Agent": USER_AGENT,
      accept: "application/json",
    },
  });
  const status = res.status;
  let body: any = null;
  try {
    body = await res.json();
  } catch (_) {
    // keep body null if not json
  }
  return { status, body, retryAfter: res.headers.get("retry-after") };
}

/**
 * Walks every page of a model list endpoint and returns the aggregated models plus the raw
 * page envelopes. Never returns a silently truncated first page.
 */
async function fetchAllPages(path: string, apiKey: string, first: { status: number; body: any }) {
  const pages: any[] = [first.body];
  if (!Array.isArray(first.body?.data) || first.body.data.length === 0) {
    throw new Error("AA returned no model data; refusing an empty snapshot");
  }
  const models: any[] = [...first.body.data];
  let pagination: any = first.body?.pagination ?? null;
  let page = Number(pagination?.page) || 1;

  while (pagination?.has_more === true) {
    if (pages.length >= MAX_PAGES) {
      throw new Error(
        `AA pagination exceeded MAX_PAGES=${MAX_PAGES} on ${path} (total_pages=${pagination?.total_pages}); refusing to keep spending rate limit`,
      );
    }

    page += 1;
    const next = await fetchPage(path, page, apiKey);

    if (next.status !== 200) {
      throw new Error(
        `AA API error on ${path} page ${page}: ${next.status} ${JSON.stringify(next.body)?.slice(0, 500)}${
          next.retryAfter ? ` (retry-after: ${next.retryAfter}s)` : ""
        }`,
      );
    }

    if (next.body?.intelligence_index_version !== first.body?.intelligence_index_version) {
      throw new Error("AA index version changed during pagination; refusing mixed scores");
    }
    const batch = Array.isArray(next.body?.data) ? next.body.data : [];
    pages.push(next.body);
    models.push(...batch);
    pagination = next.body?.pagination ?? null;

    // Defensive: a has_more that never flips would otherwise burn the daily quota.
    if (batch.length === 0) throw new Error("AA returned an empty continuation page; refusing a partial snapshot");
  }

  return { pages, models, pagination, pageCount: pages.length };
}

/**
 * Endpoint strategy: try the Pro list first, fall back to the Free-shape sibling when the key's
 * tier does not cover it. The contract documents 403 for that case; 402 is not documented but is
 * handled defensively as a payment/tier signal.
 */
async function fetchLLMs(apiKey: string) {
  let path = PATH_PRO;
  let fellBackToFree = false;

  let first = await fetchPage(path, 1, apiKey);

  if (first.status === 403 || first.status === 402) {
    path = PATH_FREE;
    fellBackToFree = true;
    first = await fetchPage(path, 1, apiKey);
  }

  if (first.status !== 200) {
    throw new Error(
      `AA API error: ${first.status} ${JSON.stringify(first.body)?.slice(0, 500)}${
        first.retryAfter ? ` (retry-after: ${first.retryAfter}s)` : ""
      }`,
    );
  }

  const { pages, models, pagination, pageCount } = await fetchAllPages(path, apiKey, first);

  return {
    status: first.status,
    path,
    fellBackToFree,
    promptType: path === PATH_PRO ? PROMPT_TYPE : null,
    tier: first.body?.tier ?? null,
    intelligenceIndexVersion: first.body?.intelligence_index_version ?? null,
    pagination,
    pageCount,
    pages,
    models,
  };
}

function mapModel(m: any, result: any, observedAt: string) {
  const evals = m.evaluations ?? {};
  const pricing = m.pricing ?? {};
  // Speed and latency moved from the top level into a nested `performance` object.
  const performance = m.performance ?? {};

  return {
    id: m.id,
    name: m.name ?? null,
    slug: m.slug ?? null,
    creator_id: m.model_creator?.id ?? null,
    creator_name: m.model_creator?.name ?? null,
    evaluations: m.evaluations ?? null,
    aa_intelligence_index: evals.artificial_analysis_intelligence_index ?? null,
    aa_coding_index: evals.artificial_analysis_coding_index ?? null,
    // `gpqa` was renamed to `gpqa_diamond`; the column keeps its name. Pro tier only.
    gpqa: evals.gpqa_diamond ?? null,
    hle: evals.hle ?? null,
    scicode: evals.scicode ?? null,
    pricing: m.pricing ?? null,
    price_1m_blended_3_to_1: pricing.price_1m_blended_3_to_1 ?? null,
    price_1m_input_tokens: pricing.price_1m_input_tokens ?? null,
    price_1m_output_tokens: pricing.price_1m_output_tokens ?? null,
    median_output_tokens_per_second: performance.median_output_tokens_per_second ?? null,
    median_time_to_first_token_seconds: performance.median_time_to_first_token_seconds ?? null,
    // Renamed: median_time_to_first_answer_token -> performance.median_time_to_first_answer_token_seconds
    median_time_to_first_answer_token: performance.median_time_to_first_answer_token_seconds ?? null,
    last_seen: observedAt,
    source_metadata: {
      endpoint: result.path,
      intelligence_index_version: result.intelligenceIndexVersion,
      performance_prompt: result.path === PATH_FREE ? "long" : PROMPT_TYPE,
      tier: result.tier,
      observed_at: observedAt,
      release_date: m.release_date ?? null,
      index_cost: m.artificial_analysis_intelligence_index_cost ?? null,
    },
    ...(NULL_OUT_RETIRED_COLUMNS
      ? {
          creator_slug: null,
          aa_math_index: null,
          mmlu_pro: null,
          livecodebench: null,
          math_500: null,
          aime: null,
        }
      : {}),
  };
}

/** A model can only appear once per upsert or Postgres rejects the whole statement. */
function dedupeById(rows: any[]) {
  const byId = new Map<string, any>();
  for (const row of rows) {
    if (!row?.id) continue;
    byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

Deno.serve(async (_req: Request) => {
  // A valid anonymous JWT must not be able to spend the shared AA quota.
  // verify_jwt MUST remain enabled: the gateway verifies this signature before this handler.
  const authorization = _req.headers.get("Authorization") ?? '';
  let serviceCaller = authorization === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (!serviceCaller && authorization.startsWith('Bearer ')) {
    try {
      const encoded = authorization.slice(7).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(encoded));
      serviceCaller = claims.role === 'service_role';
    } catch { /* Invalid tokens stay unauthorized. */ }
  }
  if (!serviceCaller) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const AA_API_KEY = requireEnv("AA_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { "X-Client-Info": "ingest-artificialanalysis" } },
    });

    const result = await fetchLLMs(AA_API_KEY);

    console.log(
      `[ingest-artificialanalysis] endpoint=${result.path} tier=${result.tier} pages=${result.pageCount} models=${result.models.length} prompt_type=${result.promptType ?? "n/a"} fell_back_to_free=${result.fellBackToFree}`,
    );

    // Insert raw fetch log FIRST, before any parsing/upsert work, exactly as the v1 function did.
    // The V2 API no longer echoes `prompt_options`, so this column now records the measurement
    // conditions we requested plus the envelope metadata that replaced it.
    const fetchPayload = {
      endpoint: result.path,
      status: result.status,
      prompt_options: result.promptType
        ? {
            prompt_type: result.promptType,
            prompt_length: "medium",
            parallel_queries: 1,
            source: "requested_by_client",
            note: "The V2 API does not echo prompt_options; these are the parameters this run sent.",
            tier: result.tier,
            intelligence_index_version: result.intelligenceIndexVersion,
            pages_fetched: result.pageCount,
            pagination: result.pagination,
            fell_back_to_free: result.fellBackToFree,
          }
        : {
            prompt_type: null,
            prompt_length: null,
            parallel_queries: null,
            source: "api_default",
            note: "/language/models/free accepts no prompt_type; performance reflects the API default (long, 10k input tokens) and is NOT comparable to the historical medium-prompt series.",
            tier: result.tier,
            intelligence_index_version: result.intelligenceIndexVersion,
            pages_fetched: result.pageCount,
            pagination: result.pagination,
            fell_back_to_free: result.fellBackToFree,
          },
      // `data` keeps its legacy meaning: the flat array of model objects, now across all pages.
      data: result.models,
      // `raw` now carries every page envelope, since one run is N HTTP responses.
      raw: {
        endpoint: result.path,
        base_url: AA_BASE,
        prompt_type: result.promptType,
        tier: result.tier,
        intelligence_index_version: result.intelligenceIndexVersion,
        page_count: result.pageCount,
        pagination: result.pagination,
        pages: result.pages,
      },
    };

    const { error: fetchInsertError } = await supabase
      .from("aa_fetches")
      .insert(fetchPayload);

    if (fetchInsertError) {
      throw new Error(`Insert aa_fetches failed: ${fetchInsertError.message}`);
    }

    // Upsert parsed models
    const models = Array.isArray(result.models) ? result.models : [];
    const observedAt = new Date().toISOString();
    const rows = dedupeById(models.map((model) => mapModel(model, result, observedAt)));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("aa_models")
        .upsert(rows, { onConflict: "id" });
      if (upsertError) {
        throw new Error(`Upsert aa_models failed: ${upsertError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        inserted_fetch: true,
        upserted_models: rows.length,
        endpoint: result.path,
        pages_fetched: result.pageCount,
        tier: result.tier,
        prompt_type: result.promptType,
        fell_back_to_free: result.fellBackToFree,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    );
  }
});
