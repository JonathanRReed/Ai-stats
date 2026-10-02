import {parseCatalogCache} from '../src/lib/catalog-cache.ts';
import {prepareSourceSnapshot} from './source-snapshots.mjs';
#!/usr/bin/env bun
import { selectAaCurrentMembership } from './aa-membership.mjs';

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_SUPABASE_HOST = "bgbqdzmgxkwstjihgeef.supabase.co";
const DEFAULT_OUTPUT = path.join(process.cwd(), ".tmp", "intelligence-input.json");
const REST_PAGE_SIZE = 1000;
/** @typedef {(input: string | URL | Request, init?: RequestInit) => Promise<Response>} FetchLike */
/** @type {FetchLike} */
const defaultFetch = (input, init) => globalThis.fetch(input, init);

const readArgument = (name, argv) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};

const requiredText = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
};

const normalizeProjectUrl = (value) => {
  const url = new URL(requiredText(value, "SUPABASE_URL"));
  if (url.protocol !== "https:" || url.hostname !== PRODUCTION_SUPABASE_HOST ||
    url.username || url.password || (url.pathname && url.pathname !== "/") ||
    url.search || url.hash) {
    throw new Error(`SUPABASE_URL must be the production project origin at ${PRODUCTION_SUPABASE_HOST}`);
  }
  return url.origin;
};

const asFiniteNumberOrNull = (value) => {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const pricePerMillion = (value) => {
  const price = asFiniteNumberOrNull(value);
  return price === null || price < 0 ? null : price * 1_000_000;
};

const jsonArray = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

const timestampValue = (value) => {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

const isFresherAaModel = (candidate, current) => {
  const lastSeenDifference = timestampValue(candidate.last_seen) - timestampValue(current.last_seen);
  if (lastSeenDifference !== 0) return lastSeenDifference > 0;
  const firstSeenDifference = timestampValue(candidate.first_seen) - timestampValue(current.first_seen);
  if (firstSeenDifference !== 0) return firstSeenDifference > 0;
  return String(candidate.id ?? "").localeCompare(String(current.id ?? "")) < 0;
};

const freshestAaModels = (models) => {
  const bySlug = new Map();
  for (const model of models) {
    const slug = typeof model?.slug === "string" ? model.slug.trim() : "";
    if (!slug) continue;
    const current = bySlug.get(slug);
    if (!current || isFresherAaModel(model, current)) bySlug.set(slug, model);
  }
  return [...bySlug.values()];
};

export const normalizeOpenRouterModel = (model) => {
  if (!model || typeof model !== "object" || Array.isArray(model) ||
    typeof model.id !== "string" || !model.id.trim()) {
    throw new Error("OpenRouter returned a model without an id");
  }
  const architecture = model.architecture && typeof model.architecture === "object"
    ? model.architecture
    : {};
  const pricing = model.pricing && typeof model.pricing === "object" ? model.pricing : {};
  return {
    ...model,
    openrouter_id: model.id.trim(),
    name: typeof model.name === "string" && model.name.trim() ? model.name.trim() : model.id.trim(),
    author_slug: model.id.split("/")[0] || null,
    context_length: asFiniteNumberOrNull(model.context_length),
    prompt_price_1m: pricePerMillion(pricing.prompt),
    completion_price_1m: pricePerMillion(pricing.completion),
    input_modalities: jsonArray(architecture.input_modalities),
    output_modalities: jsonArray(architecture.output_modalities),
  };
};

/**
 * @param {{fetchImpl: FetchLike, baseUrl: string, serviceKey: string, table: string}} options
 */
export async function fetchSupabaseRows({ fetchImpl, baseUrl, serviceKey, table }) {
  const rows = [];
  for (let offset = 0; ; offset += REST_PAGE_SIZE) {
    const url = new URL(`/rest/v1/${table}`, baseUrl);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "id.asc");
    url.searchParams.set("limit", String(REST_PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    const response = await fetchImpl(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`Unable to read ${table} from Supabase (${response.status})`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Supabase ${table} response must be an array`);
    rows.push(...page);
    if (page.length < REST_PAGE_SIZE) return rows;
  }
}


/** Read validated durable catalogs; prepared candidates take precedence for this release only. */
export async function readCatalogInputs({fetchImpl,baseUrl,serviceKey,candidates=[]}) {
  const query=new URLSearchParams({source_key:'in.(openrouter,huggingface,litellm)',
    select:'source_key,snapshot_id,content_hash,payload,fetched_at,published_at,record_count,refresh_status,refresh_message'});
  const response=await fetchImpl(baseUrl+'/rest/v1/source_snapshot_cache?'+query,{
    headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,Accept:'application/json'},
  });
  const rows=response.ok?await response.json():[];
  if(!Array.isArray(rows))throw new Error('Catalog cache returned invalid data');
  const selected={};
  for(const row of rows){
    if(!['openrouter','huggingface','litellm'].includes(row.source_key)||!parseCatalogCache(row,row.source_key))continue;
    const input={sourceKey:row.source_key,observedAt:row.payload.observedAt??null,fetchedAt:row.fetched_at,records:row.payload.records};
    const prepared=prepareSourceSnapshot(input);
    if(prepared.contentHash!==row.content_hash)continue;
    selected[row.source_key]={...prepared,snapshotId:String(row.snapshot_id)};
  }
  for(const candidate of candidates){
    if(!['prepared','unchanged'].includes(candidate.status))continue;
    if(!['openrouter','huggingface','litellm'].includes(candidate.sourceKey)||candidate.input?.sourceKey!==candidate.sourceKey)
      throw new Error('Invalid release catalog candidate');
    selected[candidate.sourceKey]={...prepareSourceSnapshot(candidate.input),snapshotId:null};
  }
  return selected;
}

/**
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   fetchImpl?: FetchLike,
 *   readJson?: (filePath: string) => Promise<unknown>,
 * }} options
 */
export async function buildIntelligenceInput({
  env = process.env,
  fetchImpl = defaultFetch,
  readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8")),
} = {}) {
  const baseUrl = normalizeProjectUrl(env.SUPABASE_URL);
  const serviceKey = requiredText(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");
  let candidates=[];
  try {const batch=await readJson(path.join(process.cwd(),'.tmp/public-catalog-candidates.json'));
    if(batch?.schemaVersion===1&&Array.isArray(batch.candidates))candidates=batch.candidates;
  } catch { /* An ordinary build can use the published durable catalogs. */ }
  const [rawAaModels, epoch, polibench, catalogInputs, aaReceiptResponse] = await Promise.all([
    fetchSupabaseRows({ fetchImpl, baseUrl, serviceKey, table: "aa_models" }),
    readJson(path.join(process.cwd(), "public/data/epoch-benchmark-snapshot.json")),
    readJson(path.join(process.cwd(), "public/data/polibench-snapshot.json")),
    readCatalogInputs({fetchImpl,baseUrl,serviceKey,candidates}),
    fetchImpl(`${baseUrl}/rest/v1/aa_fetches?select=id,fetched_at,endpoint,status,data&status=eq.200&endpoint=like.language%2F*&order=fetched_at.desc&limit=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/json" },
    }),
  ]);
  if (!aaReceiptResponse.ok) throw new Error('Unable to read AA source membership receipt');
  const receipts = await aaReceiptResponse.json();
  if (!Array.isArray(receipts) || receipts.length !== 1) throw new Error('AA source membership receipt unavailable');
  const membership = selectAaCurrentMembership(rawAaModels, receipts[0]);
  const aaModels = freshestAaModels(membership.models);
  if (!aaModels.length) throw new Error("Artificial Analysis source returned no models");
  const openrouterModels=catalogInputs.openrouter?.records??[];
  if(!openrouterModels.length)throw new Error('OpenRouter catalog is unavailable; retaining the deployed evidence');
  const observedAt = aaModels.reduce((latest, model) => {
    const candidate = Date.parse(model.last_seen ?? model.updated_at ?? "");
    return Number.isFinite(candidate) && candidate > Date.parse(latest)
      ? new Date(candidate).toISOString()
      : latest;
  }, "1970-01-01T00:00:00.000Z");
  if (observedAt.startsWith("1970-")) throw new Error("Artificial Analysis rows have no valid freshness timestamp");
  return {
    aa: { observedAt, fetchedAt: membership.fetchedAt, snapshotId: membership.snapshotId, models: aaModels },
    epoch,
    openrouter: { fetchedAt: catalogInputs.openrouter.fetchedAt, models: openrouterModels },
    catalogs:Object.fromEntries(Object.entries(catalogInputs).map(([key,value])=>[key,{contentHash:value.contentHash,fetchedAt:value.fetchedAt,recordCount:value.recordCount,snapshotId:value.snapshotId}])),
    polibench,
    explicitAliases: [],
  };
}

/**
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   argv?: string[],
 *   fetchImpl?: FetchLike,
 *   writeOutput?: (value: string) => unknown,
 * }} options
 */
export async function runCli({
  env = process.env,
  argv = process.argv,
  fetchImpl = defaultFetch,
  writeOutput = (value) => process.stdout.write(value),
} = {}) {
  const outputPath = path.resolve(readArgument("--output", argv) ?? DEFAULT_OUTPUT);
  const input = await buildIntelligenceInput({ env, fetchImpl });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(input)}\n`, { mode: 0o600 });
  const result = {
    outputPath,
    counts: {
      artificialAnalysisModels: input.aa.models.length,
      epochModels: input.epoch.models.length,
      epochRuns: input.epoch.runs.length,
      openrouterModels: input.openrouter.models.length,
      polibenchModels: input.polibench.models.length,
      polibenchRuns: input.polibench.runs.length,
    },
  };
  writeOutput(`${JSON.stringify(result)}\n`);
  return result;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  runCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Input build failed"}\n`);
    process.exitCode = 1;
  });
}
