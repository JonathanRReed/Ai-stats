#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BATCH_SIZE = 250;
const MAX_BATCH_SIZE = 500;
const PRODUCTION_SUPABASE_HOST = "bgbqdzmgxkwstjihgeef.supabase.co";
/** @typedef {(input: string | URL | Request, init?: RequestInit) => Promise<Response>} FetchLike */
/** @type {FetchLike} */
const defaultFetch = (input, init) => globalThis.fetch(input, init);

const SOURCE_CATALOG = [
  {
    source_key: "artificial-analysis",
    display_name: "Artificial Analysis",
    homepage_url: "https://artificialanalysis.ai/",
    description: "Independent model quality, price, speed, and latency measurements.",
  },
  {
    source_key: "epoch-ai",
    display_name: "Epoch AI",
    homepage_url: "https://epoch.ai/",
    description: "Source-native benchmark records from Epoch AI's public data export.",
  },
  {
    source_key: "openrouter",
    display_name: "OpenRouter",
    homepage_url: "https://openrouter.ai/",
    description: "Public model catalog, pricing, capabilities, and provider metadata.",
  },
  {
    source_key: "polibench",
    display_name: "PoliBench",
    homepage_url: "https://github.com/JonathanRReed/Poli-bench",
    description: "Live operational model-output evidence with directional political profiles.",
  },
];

const AA_METRICS = [
  ["aa_intelligence_index", "Artificial Analysis Intelligence Index", "quality", "index_points", true],
  ["aa_coding_index", "Artificial Analysis Coding Index", "coding", "index_points", true],
  ["aa_agentic_index", "Artificial Analysis Agentic Index", "agentic", "index_points", true],
  ["aa_math_index", "Artificial Analysis Math Index", "math", "index_points", true],
  ["mmlu_pro", "MMLU-Pro", "knowledge", "score", true],
  ["gpqa", "GPQA", "reasoning", "score", true],
  ["hle", "Humanity's Last Exam", "reasoning", "score", true],
  ["livecodebench", "LiveCodeBench", "coding", "score", true],
  ["scicode", "SciCode", "coding", "score", true],
  ["math_500", "MATH-500", "math", "score", true],
  ["aime", "AIME", "math", "score", true],
  ["price_1m_blended_3_to_1", "Blended token price", "cost", "usd_per_million_tokens", false],
  ["price_1m_input_tokens", "Input token price", "cost", "usd_per_million_tokens", false],
  ["price_1m_output_tokens", "Output token price", "cost", "usd_per_million_tokens", false],
  ["median_output_tokens_per_second", "Median output speed", "speed", "tokens_per_second", true],
  ["median_time_to_first_token_seconds", "Median time to first token", "latency", "seconds", false],
  ["median_time_to_first_answer_token", "Median time to first answer token", "latency", "seconds", false],
];

const POLIBENCH_METRICS = [
  ["robustness", "Robustness", "robustness", "percent", true],
  ["completionRate", "Completion rate", "completion_rate", "percent", true],
  ["parseValidity", "Parse validity", "parse_validity", "percent", true],
  ["paraphraseStability", "Paraphrase stability", "paraphrase_stability", "percent", true],
  ["rerunStability", "Rerun stability", "rerun_stability", "percent", true],
  ["contradictionConsistency", "Contradiction consistency", "contradiction_consistency", "percent", true],
  ["resolutionRate", "Resolution rate", "resolution_rate", "percent", true],
  ["costPerCompletedResponse", "Cost per completed response", "cost_per_completed_response", "usd", false],
  ["p95LatencyMs", "P95 latency", "p95_latency_ms", "milliseconds", false],
];

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asRecord = (value, label) => {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
};

const asArray = (value, label) => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
};

const asText = (value, label) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
};

const asOptionalText = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const asFiniteNumber = (value, label) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
};

const asOptionalFiniteNumber = (value, label) =>
  value === null ? null : asFiniteNumber(value, label);

const asInternalPath = (value, label) => {
  const internalPath = asText(value, label);
  if (!internalPath.startsWith("/") || internalPath.startsWith("//") ||
    internalPath.includes("\\") || internalPath.includes("..")) {
    throw new Error(`${label} must be a safe internal path`);
  }
  return internalPath;
};

const normalizePoliBenchReleases = (value, label) => {
  const releases = asRecord(value, label);
  return {
    release: asText(releases.release, `${label}.release`),
    benchmarkRelease: asText(releases.benchmarkRelease, `${label}.benchmarkRelease`),
    paperReleaseVersion: asText(releases.paperReleaseVersion, `${label}.paperReleaseVersion`),
  };
};

const asTimestamp = (value, label) => {
  const timestamp = asText(value, label);
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error(`${label} must be an ISO timestamp`);
  return new Date(timestamp).toISOString();
};

const timestampFromMilliseconds = (value, label) =>
  new Date(asFiniteNumber(value, label)).toISOString();

const httpsUrlOrNull = (value) => {
  const text = asOptionalText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

const dedupeBy = (rows, getKey, label) => {
  const byKey = new Map();
  for (const row of rows) {
    const key = getKey(row);
    if (byKey.has(key)) throw new Error(`Duplicate ${label}: ${key}`);
    byKey.set(key, row);
  }
  return [...byKey.values()];
};

const sortBy = (rows, getKey) => [...rows].sort((left, right) =>
  getKey(left).localeCompare(getKey(right)));

const sourceNativeKey = (sourceKey, sourceModelKey) => `${sourceKey}:${sourceModelKey}`;

const validateExplicitAliases = (value) => {
  const aliases = asArray(value ?? [], "explicitAliases");
  const normalized = aliases.map((entry, index) => {
    const alias = asRecord(entry, `explicitAliases[${index}]`);
    const confidence = asFiniteNumber(alias.confidence, `explicitAliases[${index}].confidence`);
    if (confidence < 0 || confidence > 1) {
      throw new Error(`explicitAliases[${index}].confidence must be between 0 and 1`);
    }
    return {
      sourceKey: asText(alias.sourceKey, `explicitAliases[${index}].sourceKey`),
      sourceModelKey: asText(alias.sourceModelKey, `explicitAliases[${index}].sourceModelKey`),
      canonicalKey: asText(alias.canonicalKey, `explicitAliases[${index}].canonicalKey`),
      provenance: asText(alias.provenance, `explicitAliases[${index}].provenance`),
      confidence,
    };
  });
  return dedupeBy(
    normalized,
    (alias) => `${alias.sourceKey}:${alias.sourceModelKey}`,
    "explicit source alias",
  );
};

const buildValidatedInput = (value) => {
  const input = asRecord(value, "input");
  const aa = asRecord(input.aa, "input.aa");
  const epoch = asRecord(input.epoch, "input.epoch");
  const openrouter = asRecord(input.openrouter, "input.openrouter");
  const polibench = asRecord(input.polibench, "input.polibench");

  const aaObservedAt = asTimestamp(aa.observedAt, "input.aa.observedAt");
  const aaModels = asArray(aa.models, "input.aa.models").map((value, index) => {
    const model = asRecord(value, `input.aa.models[${index}]`);
    // A retained legacy column is not a new observation from a Free-tier response.
    const current = { ...model };
    if (model.source_metadata?.endpoint?.startsWith('language/')) {
      for (const key of ['aa_intelligence_index', 'aa_coding_index', 'aa_math_index', 'aa_agentic_index', 'mmlu_pro', 'gpqa', 'hle', 'livecodebench', 'scicode', 'math_500', 'aime']) {
        const sourceKey = key.startsWith('aa_') ? key.replace('aa_', 'artificial_analysis_') : key === 'gpqa' ? 'gpqa_diamond' : key;
        current[key] = model.evaluations?.[sourceKey] ?? null;
      }
    }
    return {
      ...current,
      slug: asText(model.slug, `input.aa.models[${index}].slug`),
      name: asText(model.name, `input.aa.models[${index}].name`),
      last_seen: model.last_seen ? asTimestamp(model.last_seen, `input.aa.models[${index}].last_seen`) : aaObservedAt,
    };
  });

  const epochFetchedAt = asTimestamp(
    epoch.fetched_at ?? epoch.fetchedAt,
    "input.epoch.fetched_at",
  );
  const epochBenchmarks = asArray(epoch.benchmarks, "input.epoch.benchmarks").map((value, index) => {
    const benchmark = asRecord(value, `input.epoch.benchmarks[${index}]`);
    return {
      ...benchmark,
      slug: asText(benchmark.slug, `input.epoch.benchmarks[${index}].slug`),
      name: asText(benchmark.name, `input.epoch.benchmarks[${index}].name`),
    };
  });
  const epochModels = asArray(epoch.models, "input.epoch.models").map((value, index) => {
    const model = asRecord(value, `input.epoch.models[${index}]`);
    return {
      ...model,
      model_version: asText(model.model_version, `input.epoch.models[${index}].model_version`),
    };
  });
  const epochRuns = asArray(epoch.runs, "input.epoch.runs").map((value, index) => {
    const run = asRecord(value, `input.epoch.runs[${index}]`);
    const score = run.score === null || run.score === undefined
      ? null
      : asFiniteNumber(run.score, `input.epoch.runs[${index}].score`);
    return {
      ...run,
      id: asText(run.id ?? run.epoch_run_id, `input.epoch.runs[${index}].id`),
      model_version: asText(run.model_version, `input.epoch.runs[${index}].model_version`),
      benchmark_slug: asText(
        run.benchmark_slug ?? run.benchmark_id,
        `input.epoch.runs[${index}].benchmark_slug`,
      ),
      score,
    };
  });

  const openrouterFetchedAt = asTimestamp(
    openrouter.fetchedAt ?? openrouter.fetched_at,
    "input.openrouter.fetchedAt",
  );
  const openrouterModels = asArray(openrouter.models, "input.openrouter.models").map((value, index) => {
    const model = asRecord(value, `input.openrouter.models[${index}]`);
    return {
      ...model,
      openrouter_id: asText(model.openrouter_id ?? model.id, `input.openrouter.models[${index}].openrouter_id`),
      name: asText(model.name, `input.openrouter.models[${index}].name`),
    };
  });

  const source = asRecord(polibench.source, "input.polibench.source");
  const freshness = asRecord(polibench.freshness, "input.polibench.freshness");
  const evidence = asRecord(polibench.evidence, "input.polibench.evidence");
  const counts = asRecord(polibench.counts, "input.polibench.counts");
  if (polibench.schemaVersion !== "1.0") throw new Error("input.polibench.schemaVersion must be 1.0");
  if (freshness.suite !== "full") throw new Error("input.polibench.freshness.suite must be full");
  if (freshness.source !== "live-convex-snapshot") {
    throw new Error("input.polibench.freshness.source must be live-convex-snapshot");
  }
  const evidenceContract = {
    kind: "live_operational_model_output",
    label: "Live operational model-output evidence",
    humanValidation: "not_collected",
    externalValidation: "not_externally_validated",
    paperRelease: "not_frozen",
  };
  for (const [key, expected] of Object.entries(evidenceContract)) {
    if (evidence[key] !== expected) {
      throw new Error(`input.polibench.evidence.${key} must be ${expected}`);
    }
  }
  asText(evidence.boundary, "input.polibench.evidence.boundary");
  const polibenchModels = asArray(polibench.models, "input.polibench.models").map((value, index) => {
    const model = asRecord(value, `input.polibench.models[${index}]`);
    const modelLabel = `input.polibench.models[${index}]`;
    const axes = asArray(model.axisScores, `input.polibench.models[${index}].axisScores`).map(
      (value, axisIndex) => {
        const axis = asRecord(value, `input.polibench.models[${index}].axisScores[${axisIndex}]`);
        return {
          axis: asText(axis.axis, `input.polibench.models[${index}].axisScores[${axisIndex}].axis`),
          score: asFiniteNumber(axis.score, `input.polibench.models[${index}].axisScores[${axisIndex}].score`),
          answeredItems: asFiniteNumber(
            axis.answeredItems,
            `input.polibench.models[${index}].axisScores[${axisIndex}].answeredItems`,
          ),
        };
      },
    );
    if (!axes.length) throw new Error(`${modelLabel}.axisScores must not be empty`);
    return {
      ...model,
      modelSlug: asText(model.modelSlug, `${modelLabel}.modelSlug`),
      provider: asText(model.provider, `${modelLabel}.provider`),
      label: asText(model.label, `${modelLabel}.label`),
      note: asText(model.note, `${modelLabel}.note`),
      runId: asText(model.runId, `${modelLabel}.runId`),
      status: asText(model.status, `${modelLabel}.status`),
      evidenceLevel: asFiniteNumber(model.evidenceLevel, `${modelLabel}.evidenceLevel`),
      evidenceLabel: asText(model.evidenceLabel, `${modelLabel}.evidenceLabel`),
      scoreStatus: asText(model.scoreStatus, `${modelLabel}.scoreStatus`),
      uncertaintySummary: asText(model.uncertaintySummary, `${modelLabel}.uncertaintySummary`),
      robustness: asFiniteNumber(model.robustness, `${modelLabel}.robustness`),
      completionRate: asFiniteNumber(model.completionRate, `${modelLabel}.completionRate`),
      completedResponses: asFiniteNumber(model.completedResponses, `${modelLabel}.completedResponses`),
      parseValidResponses: asFiniteNumber(model.parseValidResponses, `${modelLabel}.parseValidResponses`),
      parseValidity: asFiniteNumber(model.parseValidity, `${modelLabel}.parseValidity`),
      paraphraseStability: asFiniteNumber(model.paraphraseStability, `${modelLabel}.paraphraseStability`),
      rerunStability: asFiniteNumber(model.rerunStability, `${modelLabel}.rerunStability`),
      contradictionConsistency: asFiniteNumber(
        model.contradictionConsistency,
        `${modelLabel}.contradictionConsistency`,
      ),
      resolutionRate: asFiniteNumber(model.resolutionRate, `${modelLabel}.resolutionRate`),
      costPerCompletedResponse: asFiniteNumber(
        model.costPerCompletedResponse,
        `${modelLabel}.costPerCompletedResponse`,
      ),
      p95LatencyMs: asFiniteNumber(model.p95LatencyMs, `${modelLabel}.p95LatencyMs`),
      lastRunStartedAt: asFiniteNumber(model.lastRunStartedAt, `${modelLabel}.lastRunStartedAt`),
      lastRunFinishedAt: asFiniteNumber(model.lastRunFinishedAt, `${modelLabel}.lastRunFinishedAt`),
      releases: normalizePoliBenchReleases(model.releases, `${modelLabel}.releases`),
      axisScores: axes,
      artifactLinks: Object.fromEntries([
        "canonicalResponses",
        "axisIntervals",
        "responseStyleControls",
        "exclusions",
        "duplicateResolution",
        "rawResponses",
      ].map((key) => [
        key,
        asInternalPath(
          asRecord(model.artifactLinks, `${modelLabel}.artifactLinks`)[key],
          `${modelLabel}.artifactLinks.${key}`,
        ),
      ])),
    };
  });
  if (!polibenchModels.length) throw new Error("input.polibench.models must not be empty");
  const polibenchModelSlugs = new Set();
  for (const model of polibenchModels) {
    if (polibenchModelSlugs.has(model.modelSlug)) {
      throw new Error(`Duplicate PoliBench modelSlug: ${model.modelSlug}`);
    }
    polibenchModelSlugs.add(model.modelSlug);
  }
  const polibenchRuns = asArray(polibench.runs, "input.polibench.runs").map((value, index) => {
    const runLabel = `input.polibench.runs[${index}]`;
    const run = asRecord(value, runLabel);
    const suite = asText(run.suite, `${runLabel}.suite`);
    if (suite !== "full") throw new Error(`${runLabel}.suite must be full`);
    const modelSlug = asText(run.modelSlug, `${runLabel}.modelSlug`);
    if (!polibenchModelSlugs.has(modelSlug)) {
      throw new Error(`${runLabel}.modelSlug must exactly match a PoliBench model identity`);
    }
    return {
      ...run,
      runId: asText(run.runId, `${runLabel}.runId`),
      suite,
      modelSlug,
      status: asText(run.status, `${runLabel}.status`),
      startedAt: asFiniteNumber(run.startedAt, `${runLabel}.startedAt`),
      finishedAt: asOptionalFiniteNumber(run.finishedAt, `${runLabel}.finishedAt`),
      expectedResponses: asFiniteNumber(run.expectedResponses, `${runLabel}.expectedResponses`),
      completedResponses: asFiniteNumber(run.completedResponses, `${runLabel}.completedResponses`),
      parseValidResponses: asFiniteNumber(run.parseValidResponses, `${runLabel}.parseValidResponses`),
      completionRate: asFiniteNumber(run.completionRate, `${runLabel}.completionRate`),
      parseValidity: asFiniteNumber(run.parseValidity, `${runLabel}.parseValidity`),
      rerunStability: asFiniteNumber(run.rerunStability, `${runLabel}.rerunStability`),
      robustness: asFiniteNumber(run.robustness, `${runLabel}.robustness`),
      costPerCompletedResponse: asOptionalFiniteNumber(
        run.costPerCompletedResponse,
        `${runLabel}.costPerCompletedResponse`,
      ),
      p95LatencyMs: asOptionalFiniteNumber(run.p95LatencyMs, `${runLabel}.p95LatencyMs`),
      releases: normalizePoliBenchReleases(run.releases, `${runLabel}.releases`),
    };
  });
  if (!polibenchRuns.length) throw new Error("input.polibench.runs must not be empty");
  const polibenchRunsById = new Map();
  for (const run of polibenchRuns) {
    if (polibenchRunsById.has(run.runId)) {
      throw new Error(`Duplicate PoliBench runId: ${run.runId}`);
    }
    polibenchRunsById.set(run.runId, run);
  }
  for (const [index, model] of polibenchModels.entries()) {
    const run = polibenchRunsById.get(model.runId);
    if (!run || run.modelSlug !== model.modelSlug) {
      throw new Error(
        `input.polibench.models[${index}].runId must resolve to a run receipt for the same modelSlug`,
      );
    }
  }
  if (counts.models !== polibenchModels.length || counts.rows !== polibenchModels.length ||
    counts.runs !== polibenchRuns.length) {
    throw new Error("input.polibench counts must match its model and run arrays");
  }

  return {
    aa: { observedAt: aaObservedAt, models: aaModels },
    epoch: {
      fetchedAt: epochFetchedAt,
      benchmarks: epochBenchmarks,
      models: epochModels,
      runs: epochRuns,
    },
    openrouter: { fetchedAt: openrouterFetchedAt, models: openrouterModels },
    polibench: {
      ...polibench,
      source: {
        repository: asText(source.repository, "input.polibench.source.repository"),
        commit: asText(source.commit, "input.polibench.source.commit"),
        artifactPath: asText(source.artifactPath, "input.polibench.source.artifactPath"),
      },
      freshness: {
        generatedAt: asTimestamp(freshness.generatedAt, "input.polibench.freshness.generatedAt"),
        suite: asText(freshness.suite, "input.polibench.freshness.suite"),
        source: asText(freshness.source, "input.polibench.freshness.source"),
      },
      evidence: {
        ...evidence,
        kind: asText(evidence.kind, "input.polibench.evidence.kind"),
        label: asText(evidence.label, "input.polibench.evidence.label"),
      },
      counts: {
        models: asFiniteNumber(counts.models, "input.polibench.counts.models"),
        rows: asFiniteNumber(counts.rows, "input.polibench.counts.rows"),
        runs: asFiniteNumber(counts.runs, "input.polibench.counts.runs"),
      },
      models: polibenchModels,
      runs: polibenchRuns,
    },
    explicitAliases: validateExplicitAliases(input.explicitAliases),
  };
};

const canonicalModelInputs = (input) => [
  ...input.aa.models.map((model) => ({
    sourceKey: "artificial-analysis",
    sourceModelKey: model.slug,
    displayName: model.name,
    providerName: asOptionalText(model.creator_name),
    releaseDate: null,
    metadata: { creatorSlug: asOptionalText(model.creator_slug) },
    updatedAt: model.last_seen,
  })),
  ...input.epoch.models.map((model) => ({
    sourceKey: "epoch-ai",
    sourceModelKey: model.model_version,
    displayName: asOptionalText(model.display_name) ?? asOptionalText(model.model_name) ?? model.model_version,
    providerName: asOptionalText(model.organization),
    releaseDate: asOptionalText(model.release_date),
    metadata: {
      country: asOptionalText(model.country),
      accessibility: asOptionalText(model.model_accessibility),
    },
    updatedAt: input.epoch.fetchedAt,
  })),
  ...input.openrouter.models.map((model) => ({
    sourceKey: "openrouter",
    sourceModelKey: model.openrouter_id,
    displayName: model.name,
    providerName: asOptionalText(model.author_slug) ?? model.openrouter_id.split("/")[0] ?? null,
    releaseDate: null,
    metadata: {
      contextLength: typeof model.context_length === "number" ? model.context_length : null,
      promptPrice1m: typeof model.prompt_price_1m === "number" ? model.prompt_price_1m : null,
      completionPrice1m: typeof model.completion_price_1m === "number" ? model.completion_price_1m : null,
      inputModalities: Array.isArray(model.input_modalities) ? model.input_modalities : [],
      outputModalities: Array.isArray(model.output_modalities) ? model.output_modalities : [],
    },
    updatedAt: input.openrouter.fetchedAt,
  })),
  ...input.polibench.models.map((model) => ({
    sourceKey: "polibench",
    sourceModelKey: model.modelSlug,
    displayName: model.label,
    providerName: model.provider,
    releaseDate: null,
    metadata: {
      release: asOptionalText(model.releases.release),
      benchmarkRelease: asOptionalText(model.releases.benchmarkRelease),
      paperReleaseVersion: asOptionalText(model.releases.paperReleaseVersion),
    },
    updatedAt: input.polibench.freshness.generatedAt,
  })),
];

export function buildIntelligencePayloads(value) {
  const input = buildValidatedInput(value);
  const explicitBySourceIdentity = new Map(input.explicitAliases.map((alias) => [
    `${alias.sourceKey}:${alias.sourceModelKey}`,
    alias,
  ]));
  const nativeInputs = canonicalModelInputs(input);
  const sourceIdentitySet = new Set(nativeInputs.map((model) =>
    `${model.sourceKey}:${model.sourceModelKey}`));
  for (const alias of input.explicitAliases) {
    if (!sourceIdentitySet.has(`${alias.sourceKey}:${alias.sourceModelKey}`)) {
      throw new Error("An explicit alias references an unknown source identity");
    }
  }

  const canonicalModels = [];
  const aliases = [];
  const canonicalKeyBySourceIdentity = new Map();
  for (const model of nativeInputs) {
    const identity = `${model.sourceKey}:${model.sourceModelKey}`;
    const explicitAlias = explicitBySourceIdentity.get(identity);
    const canonicalKey = explicitAlias?.canonicalKey ?? sourceNativeKey(model.sourceKey, model.sourceModelKey);
    canonicalKeyBySourceIdentity.set(identity, canonicalKey);
    if (!explicitAlias) {
      canonicalModels.push({
        canonical_key: canonicalKey,
        display_name: model.displayName,
        provider_name: model.providerName,
        model_family: null,
        release_date: model.releaseDate,
        metadata: model.metadata,
        updated_at: model.updatedAt,
      });
    }
    aliases.push({
      canonical_key: canonicalKey,
      source_key: model.sourceKey,
      source_model_key: model.sourceModelKey,
      source_model_name: model.displayName,
      match_method: explicitAlias ? "explicit_cross_source" : "source_native",
      provenance: explicitAlias?.provenance ?? `${model.sourceKey} source-native identity`,
      confidence: explicitAlias?.confidence ?? 1,
      updated_at: model.updatedAt,
    });
  }
  const dedupedCanonicalModels = dedupeBy(
    canonicalModels,
    (model) => model.canonical_key,
    "canonical model key",
  );
  const knownCanonicalKeys = new Set(dedupedCanonicalModels.map((model) => model.canonical_key));
  for (const alias of input.explicitAliases) {
    if (!knownCanonicalKeys.has(alias.canonicalKey)) {
      throw new Error("An explicit alias target must resolve to a native canonical model in this payload");
    }
  }

  const sourceFreshness = {
    "artificial-analysis": input.aa.observedAt,
    "epoch-ai": input.epoch.fetchedAt,
    openrouter: input.openrouter.fetchedAt,
    polibench: input.polibench.freshness.generatedAt,
  };
  const sourceCoverage = {
    "artificial-analysis": `${input.aa.models.length} models`,
    "epoch-ai": `${input.epoch.models.length} models, ${input.epoch.runs.length} observations`,
    openrouter: `${input.openrouter.models.length} models`,
    polibench: `${input.polibench.counts.models} models, ${input.polibench.counts.runs} runs`,
  };
  const sources = SOURCE_CATALOG.map((source) => ({
    ...source,
    license_name: null,
    is_enabled: true,
    metadata: {},
  }));
  const sourceStates = SOURCE_CATALOG.map((source) => ({
    source_key: source.source_key,
    observed_at: sourceFreshness[source.source_key],
    coverage_label: sourceCoverage[source.source_key],
  }));

  const benchmarkDefinitions = [];
  const benchmarkVersions = [];
  const observations = [];

  for (const [property, name, domain, unit, higherIsBetter] of AA_METRICS) {
    const metricModels = input.aa.models.filter((model) =>
      typeof model[property] === "number" && Number.isFinite(model[property]));
    if (!metricModels.length) continue;
    benchmarkDefinitions.push({
      source_key: "artificial-analysis",
      benchmark_key: property,
      display_name: name,
      domain,
      unit,
      higher_is_better: higherIsBetter,
      description: null,
      metadata: { evidenceType: domain === "cost" ? "price" : domain },
      updated_at: input.aa.observedAt,
    });
    const versionFor = (model) => {
      const metadata = model.source_metadata;
      if (domain === 'speed' || domain === 'latency') return `prompt-${metadata?.performance_prompt ?? 'unknown'}`;
      if (domain === 'cost') return 'source-native-current';
      return metadata?.intelligence_index_version == null ? 'source-native-unversioned' : `aa-index-${metadata.intelligence_index_version}`;
    };
    for (const version of new Set(metricModels.map(versionFor))) benchmarkVersions.push({
      source_key: "artificial-analysis",
      benchmark_key: property,
      version_key: version,
      methodology_url: "https://artificialanalysis.ai/methodology/intelligence-benchmarking",
      published_at: null,
      metadata: {},
      updated_at: input.aa.observedAt,
    });
    for (const model of metricModels) {
      observations.push({
        source_key: "artificial-analysis",
        canonical_key: canonicalKeyBySourceIdentity.get(`artificial-analysis:${model.slug}`),
        benchmark_key: property,
        version_key: versionFor(model),
        observation_key: `artificial-analysis:${model.slug}:${property}:${model.last_seen}`,
        source_model_key: model.slug,
        value: model[property],
        observed_at: model.last_seen,
        source_url: null,
        metadata: model.source_metadata ?? {},
        updated_at: model.last_seen,
      });
    }
  }

  const epochBenchmarkKeys = new Set(input.epoch.benchmarks.map((benchmark) => benchmark.slug));
  const epochModelKeys = new Set(input.epoch.models.map((model) => model.model_version));
  for (const benchmark of input.epoch.benchmarks) {
    benchmarkDefinitions.push({
      source_key: "epoch-ai",
      benchmark_key: benchmark.slug,
      display_name: benchmark.name,
      domain: "source_native_benchmark",
      unit: "source_native_score",
      higher_is_better: true,
      description: asOptionalText(benchmark.description),
      metadata: {},
      updated_at: input.epoch.fetchedAt,
    });
    benchmarkVersions.push({
      source_key: "epoch-ai",
      benchmark_key: benchmark.slug,
      version_key: "source-native-current",
      methodology_url: null,
      published_at: null,
      metadata: {},
      updated_at: input.epoch.fetchedAt,
    });
  }
  for (const run of input.epoch.runs) {
    if (run.score === null) continue;
    if (!epochBenchmarkKeys.has(run.benchmark_slug) || !epochModelKeys.has(run.model_version)) {
      throw new Error("An Epoch run must resolve to a validated model and benchmark identity");
    }
    observations.push({
      source_key: "epoch-ai",
      canonical_key: canonicalKeyBySourceIdentity.get(`epoch-ai:${run.model_version}`),
      benchmark_key: run.benchmark_slug,
      version_key: "source-native-current",
      observation_key: `epoch-ai:${run.id}`,
      source_model_key: run.model_version,
      value: run.score,
      observed_at: input.epoch.fetchedAt,
      source_url: httpsUrlOrNull(run.source_link),
      metadata: { scoreMetric: asOptionalText(run.score_metric) },
      updated_at: input.epoch.fetchedAt,
    });
  }

  const polibenchVersionKeys = new Set();
  for (const [property, name, benchmarkKey, unit, higherIsBetter] of POLIBENCH_METRICS) {
    benchmarkDefinitions.push({
      source_key: "polibench",
      benchmark_key: benchmarkKey,
      display_name: name,
      domain: property.includes("cost") ? "cost" : property.includes("Latency") ? "latency" : "robustness",
      unit,
      higher_is_better: higherIsBetter,
      description: "PoliBench live operational model-output evidence.",
      metadata: { evidenceType: "live_operational_model_output" },
      updated_at: input.polibench.freshness.generatedAt,
    });
    for (const model of input.polibench.models) {
      const versionKey = asText(model.releases.benchmarkRelease, "PoliBench benchmark release");
      const versionIdentity = `${benchmarkKey}:${versionKey}`;
      if (!polibenchVersionKeys.has(versionIdentity)) {
        polibenchVersionKeys.add(versionIdentity);
        benchmarkVersions.push({
          source_key: "polibench",
          benchmark_key: benchmarkKey,
          version_key: versionKey,
          methodology_url: `${input.polibench.source.repository}/tree/${input.polibench.source.commit}`,
          published_at: input.polibench.freshness.generatedAt,
          metadata: { paperReleaseVersion: asOptionalText(model.releases.paperReleaseVersion) },
          updated_at: input.polibench.freshness.generatedAt,
        });
      }
      const metricValue = asFiniteNumber(model[property], `PoliBench ${property}`);
      const modelObservedAt = timestampFromMilliseconds(
        model.lastRunFinishedAt,
        `PoliBench ${model.modelSlug} lastRunFinishedAt`,
      );
      observations.push({
        source_key: "polibench",
        canonical_key: canonicalKeyBySourceIdentity.get(`polibench:${model.modelSlug}`),
        benchmark_key: benchmarkKey,
        version_key: versionKey,
        observation_key: `polibench:${model.runId}:${benchmarkKey}`,
        source_model_key: model.modelSlug,
        value: metricValue,
        observed_at: modelObservedAt,
        source_url: `${input.polibench.source.repository}/tree/${input.polibench.source.commit}`,
        metadata: { evidenceLevel: model.evidenceLevel, evidenceLabel: model.evidenceLabel },
        updated_at: input.polibench.freshness.generatedAt,
      });
    }
  }

  const axisNames = new Set(input.polibench.models.flatMap((model) =>
    model.axisScores.map((axis) => axis.axis)));
  for (const axisName of [...axisNames].sort()) {
    const benchmarkKey = `axis:${axisName}`;
    benchmarkDefinitions.push({
      source_key: "polibench",
      benchmark_key: benchmarkKey,
      display_name: `${axisName[0]?.toUpperCase() ?? ""}${axisName.slice(1)} profile`,
      domain: "political_profile",
      unit: "directional_profile_score",
      higher_is_better: null,
      description: "Directional profile axis. This is not a higher-is-better quality score.",
      metadata: { evidenceType: "directional_profile" },
      updated_at: input.polibench.freshness.generatedAt,
    });
    for (const model of input.polibench.models) {
      const axis = model.axisScores.find((candidate) => candidate.axis === axisName);
      if (!axis) continue;
      const versionKey = asText(model.releases.benchmarkRelease, "PoliBench benchmark release");
      const versionIdentity = `${benchmarkKey}:${versionKey}`;
      if (!polibenchVersionKeys.has(versionIdentity)) {
        polibenchVersionKeys.add(versionIdentity);
        benchmarkVersions.push({
          source_key: "polibench",
          benchmark_key: benchmarkKey,
          version_key: versionKey,
          methodology_url: `${input.polibench.source.repository}/tree/${input.polibench.source.commit}`,
          published_at: input.polibench.freshness.generatedAt,
          metadata: { evidenceType: "directional_profile" },
          updated_at: input.polibench.freshness.generatedAt,
        });
      }
      observations.push({
        source_key: "polibench",
        canonical_key: canonicalKeyBySourceIdentity.get(`polibench:${model.modelSlug}`),
        benchmark_key: benchmarkKey,
        version_key: versionKey,
        observation_key: `polibench:${model.runId}:${benchmarkKey}`,
        source_model_key: model.modelSlug,
        value: axis.score,
        observed_at: timestampFromMilliseconds(
          model.lastRunFinishedAt,
          `PoliBench ${model.modelSlug} lastRunFinishedAt`,
        ),
        source_url: `${input.polibench.source.repository}/tree/${input.polibench.source.commit}`,
        metadata: { answeredItems: axis.answeredItems, evidenceType: "directional_profile" },
        updated_at: input.polibench.freshness.generatedAt,
      });
    }
  }

  const polibenchSnapshots = [{
    source_key: "polibench",
    snapshot_key: `${input.polibench.source.commit}:${input.polibench.freshness.generatedAt}`,
    generated_at: input.polibench.freshness.generatedAt,
    suite: input.polibench.freshness.suite,
    source_kind: input.polibench.freshness.source,
    model_count: input.polibench.counts.models,
    row_count: input.polibench.counts.rows,
    run_count: input.polibench.counts.runs,
    evidence_kind: input.polibench.evidence.kind,
    evidence_label: input.polibench.evidence.label,
    source_repository: input.polibench.source.repository,
    source_commit: input.polibench.source.commit,
    source_artifact_path: input.polibench.source.artifactPath,
    payload: input.polibench,
    updated_at: input.polibench.freshness.generatedAt,
  }];

  return {
    sources,
    sourceStates,
    canonicalModels: sortBy(dedupedCanonicalModels, (row) => row.canonical_key),
    aliases: sortBy(aliases, (row) => `${row.source_key}:${row.source_model_key}`),
    benchmarkDefinitions: sortBy(
      dedupeBy(benchmarkDefinitions, (row) => `${row.source_key}:${row.benchmark_key}`, "benchmark definition"),
      (row) => `${row.source_key}:${row.benchmark_key}`,
    ),
    benchmarkVersions: sortBy(
      dedupeBy(
        benchmarkVersions,
        (row) => `${row.source_key}:${row.benchmark_key}:${row.version_key}`,
        "benchmark version",
      ),
      (row) => `${row.source_key}:${row.benchmark_key}:${row.version_key}`,
    ),
    observations: sortBy(
      dedupeBy(observations, (row) => `${row.source_key}:${row.observation_key}`, "observation"),
      (row) => `${row.source_key}:${row.observation_key}`,
    ),
    polibenchSnapshots,
  };
}

const validateServerConfig = (env) => {
  const urlValue = typeof env?.SUPABASE_URL === "string" ? env.SUPABASE_URL.trim() : "";
  const keyValue = typeof env?.SUPABASE_SERVICE_ROLE_KEY === "string"
    ? env.SUPABASE_SERVICE_ROLE_KEY.trim()
    : "";
  if (!urlValue || !keyValue) {
    throw new Error(
      "Missing server configuration: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  let url;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error("Invalid server configuration: SUPABASE_URL must be a valid URL");
  }
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  const isLoopback = loopbackHosts.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error(
      "Invalid server configuration: SUPABASE_URL must use HTTPS except for explicit loopback development hosts",
    );
  }
  if (
    url.username ||
    url.password ||
    (url.pathname && url.pathname !== "/") ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Invalid server configuration: SUPABASE_URL must be a project origin without credentials, paths, query parameters, or fragments",
    );
  }
  if (!isLoopback && url.hostname !== PRODUCTION_SUPABASE_HOST) {
    throw new Error(
      "Invalid server configuration: SUPABASE_URL must target the AI Stats Supabase project or an explicit loopback development host",
    );
  }
  return { baseUrl: url.href.replace(/\/$/u, ""), serviceKey: keyValue };
};

const headersFor = (serviceKey, extra = {}) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
  ...extra,
});

const requestJson = async ({ fetchImpl, url, init, operation }) => {
  let response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    throw new Error(`Intelligence sync failed during ${operation} (network error)`);
  }
  if (!response?.ok) {
    const status = Number.isInteger(response?.status) ? `HTTP ${response.status}` : "remote error";
    throw new Error(`Intelligence sync failed during ${operation} (${status})`);
  }
  let text;
  try {
    text = await response.text();
  } catch {
    throw new Error(`Intelligence sync failed during ${operation} (unreadable response)`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Intelligence sync failed during ${operation} (invalid response)`);
  }
};

const callRpc = ({ fetchImpl, baseUrl, serviceKey, name, body }) =>
  requestJson({
    fetchImpl,
    url: `${baseUrl}/rest/v1/rpc/${name}`,
    init: {
      method: "POST",
      headers: headersFor(serviceKey),
      body: JSON.stringify(body),
    },
    operation: `${name} RPC`,
  });

export async function upsertRows({
  fetchImpl,
  baseUrl,
  serviceKey,
  table,
  rows,
  onConflict,
  batchSize = DEFAULT_BATCH_SIZE,
}) {
  const boundedBatchSize = Number.isInteger(batchSize) && batchSize > 0
    ? Math.min(batchSize, MAX_BATCH_SIZE)
    : DEFAULT_BATCH_SIZE;
  const returned = [];
  for (let index = 0; index < rows.length; index += boundedBatchSize) {
    const batch = rows.slice(index, index + boundedBatchSize);
    const data = await requestJson({
      fetchImpl,
      url: `${baseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}&select=*`,
      init: {
        method: "POST",
        headers: headersFor(serviceKey, {
          Prefer: "resolution=merge-duplicates,return=representation",
        }),
        body: JSON.stringify(batch),
      },
      operation: `${table} upsert`,
    });
    if (!Array.isArray(data)) {
      throw new Error(`Intelligence sync failed during ${table} upsert (invalid response)`);
    }
    returned.push(...data);
  }
  return returned;
}

const requireIdMap = (rows, getKey, label) => {
  const map = new Map();
  for (const row of rows) {
    if (!isRecord(row) || (typeof row.id !== "number" && typeof row.id !== "string")) {
      throw new Error(`Intelligence sync failed during ${label} identity resolution`);
    }
    map.set(getKey(row), row.id);
  }
  return map;
};

const requireId = (map, key, label) => {
  const id = map.get(key);
  if (typeof id !== "number" && typeof id !== "string") {
    throw new Error(`Intelligence sync failed during ${label} identity resolution`);
  }
  return id;
};

const stripKeys = (row, keys) => Object.fromEntries(
  Object.entries(row).filter(([key]) => !keys.includes(key)),
);

const countRowsForSource = (payloads, sourceKey) =>
  payloads.canonicalModels.filter((row) => row.canonical_key.startsWith(`${sourceKey}:`)).length +
  payloads.aliases.filter((row) => row.source_key === sourceKey).length +
  payloads.benchmarkDefinitions.filter((row) => row.source_key === sourceKey).length +
  payloads.benchmarkVersions.filter((row) => row.source_key === sourceKey).length +
  payloads.observations.filter((row) => row.source_key === sourceKey).length +
  payloads.polibenchSnapshots.filter((row) => row.source_key === sourceKey).length;

const sourceStatusRow = (payloads, sourceKey, status) => {
  const source = payloads.sources.find((candidate) => candidate.source_key === sourceKey);
  const state = payloads.sourceStates.find((candidate) => candidate.source_key === sourceKey);
  if (!source || !state) {
    throw new Error("Intelligence sync failed during source state resolution");
  }
  const updatedAt = new Date().toISOString();
  if (status === "healthy") {
    return {
      ...source,
      status,
      status_message: "Latest validated intelligence sync succeeded.",
      coverage_label: state.coverage_label,
      last_observed_at: state.observed_at,
      last_successful_run_at: updatedAt,
      updated_at: updatedAt,
    };
  }
  return {
    ...source,
    status,
    status_message: "Latest intelligence sync did not complete; previous successful data remains available.",
    updated_at: updatedAt,
  };
};

/**
 * @param {{
 *   input?: unknown,
 *   env?: Record<string, string | undefined>,
 *   fetchImpl?: FetchLike,
 *   batchSize?: number,
 * }} options
 */
export async function syncIntelligenceData({
  input,
  env = process.env,
  fetchImpl = defaultFetch,
  batchSize = DEFAULT_BATCH_SIZE,
} = {}) {
  const { baseUrl, serviceKey } = validateServerConfig(env);
  if (typeof fetchImpl !== "function") throw new Error("A server fetch implementation is required");
  const payloads = buildIntelligencePayloads(input);
  let runId = null;
  const sourceReceiptIds = new Map();
  const publishedSourceKeys = new Set();
  let dataWritesStarted = false;

  try {
    runId = await callRpc({
      fetchImpl,
      baseUrl,
      serviceKey,
      name: "start_intelligence_ingestion",
      body: { p_trigger_kind: "cli" },
    });
    if (typeof runId !== "number" && typeof runId !== "string") {
      throw new Error("Intelligence sync failed during ingestion receipt creation");
    }

    const sourceRows = await upsertRows({
      fetchImpl,
      baseUrl,
      serviceKey,
      table: "intelligence_sources",
      rows: payloads.sources,
      onConflict: "source_key",
      batchSize,
    });
    const sourceIdByKey = requireIdMap(sourceRows, (row) => row.source_key, "source");
    for (const source of payloads.sources) {
      requireId(sourceIdByKey, source.source_key, "source");
    }

    for (const source of payloads.sources) {
      const receiptId = await callRpc({
        fetchImpl,
        baseUrl,
        serviceKey,
        name: "start_intelligence_source_ingestion",
        body: { p_run_id: runId, p_source_key: source.source_key },
      });
      if (typeof receiptId !== "number" && typeof receiptId !== "string") {
        throw new Error("Intelligence sync failed during source receipt creation");
      }
      sourceReceiptIds.set(source.source_key, receiptId);
    }

    dataWritesStarted = true;
    const canonicalRows = await upsertRows({
      fetchImpl,
      baseUrl,
      serviceKey,
      table: "canonical_models",
      rows: payloads.canonicalModels,
      onConflict: "canonical_key",
      batchSize,
    });
    const canonicalIdByKey = requireIdMap(canonicalRows, (row) => row.canonical_key, "canonical model");
    for (const model of payloads.canonicalModels) {
      requireId(canonicalIdByKey, model.canonical_key, "canonical model");
    }

    const definitionRows = await upsertRows({
      fetchImpl,
      baseUrl,
      serviceKey,
      table: "benchmark_definitions",
      rows: payloads.benchmarkDefinitions.map((row) => ({
        ...stripKeys(row, ["source_key"]),
        intelligence_source_id: requireId(sourceIdByKey, row.source_key, "source"),
      })),
      onConflict: "intelligence_source_id,benchmark_key",
      batchSize,
    });
    const definitionIdByKey = requireIdMap(
      definitionRows,
      (row) => `${row.intelligence_source_id}:${row.benchmark_key}`,
      "benchmark definition",
    );
    for (const definition of payloads.benchmarkDefinitions) {
      const sourceId = requireId(sourceIdByKey, definition.source_key, "source");
      requireId(
        definitionIdByKey,
        `${sourceId}:${definition.benchmark_key}`,
        "benchmark definition",
      );
    }

    const versionRows = await upsertRows({
      fetchImpl,
      baseUrl,
      serviceKey,
      table: "benchmark_versions",
      rows: payloads.benchmarkVersions.map((row) => {
        const sourceId = requireId(sourceIdByKey, row.source_key, "source");
        return {
          ...stripKeys(row, ["source_key", "benchmark_key"]),
          benchmark_definition_id: requireId(
            definitionIdByKey,
            `${sourceId}:${row.benchmark_key}`,
            "benchmark definition",
          ),
        };
      }),
      onConflict: "benchmark_definition_id,version_key",
      batchSize,
    });
    const versionIdByKey = requireIdMap(
      versionRows,
      (row) => `${row.benchmark_definition_id}:${row.version_key}`,
      "benchmark version",
    );
    for (const version of payloads.benchmarkVersions) {
      const sourceId = requireId(sourceIdByKey, version.source_key, "source");
      const definitionId = requireId(
        definitionIdByKey,
        `${sourceId}:${version.benchmark_key}`,
        "benchmark definition",
      );
      requireId(
        versionIdByKey,
        `${definitionId}:${version.version_key}`,
        "benchmark version",
      );
    }

    await upsertRows({
      fetchImpl,
      baseUrl,
      serviceKey,
      table: "model_aliases",
      rows: payloads.aliases.map((row) => ({
        ...stripKeys(row, ["source_key", "canonical_key"]),
        intelligence_source_id: requireId(sourceIdByKey, row.source_key, "source"),
        canonical_model_id: requireId(canonicalIdByKey, row.canonical_key, "canonical model"),
      })),
      onConflict: "intelligence_source_id,source_model_key",
      batchSize,
    });

    await upsertRows({
      fetchImpl,
      baseUrl,
      serviceKey,
      table: "benchmark_observations",
      rows: payloads.observations.map((row) => {
        const sourceId = requireId(sourceIdByKey, row.source_key, "source");
        const definitionId = requireId(
          definitionIdByKey,
          `${sourceId}:${row.benchmark_key}`,
          "benchmark definition",
        );
        return {
          ...stripKeys(row, ["source_key", "canonical_key", "benchmark_key", "version_key"]),
          intelligence_source_id: sourceId,
          canonical_model_id: requireId(canonicalIdByKey, row.canonical_key, "canonical model"),
          benchmark_version_id: requireId(
            versionIdByKey,
            `${definitionId}:${row.version_key}`,
            "benchmark version",
          ),
        };
      }),
      onConflict: "intelligence_source_id,observation_key",
      batchSize,
    });

    await upsertRows({
      fetchImpl,
      baseUrl,
      serviceKey,
      table: "polibench_snapshots",
      rows: payloads.polibenchSnapshots.map((row) => ({
        ...stripKeys(row, ["source_key"]),
        intelligence_source_id: requireId(sourceIdByKey, row.source_key, "source"),
      })),
      onConflict: "snapshot_key",
      batchSize,
    });

    for (const source of payloads.sources) {
      const rowCount = countRowsForSource(payloads, source.source_key);
      const sourceReceiptId = requireId(
        sourceReceiptIds,
        source.source_key,
        "source receipt",
      );
      await callRpc({
        fetchImpl,
        baseUrl,
        serviceKey,
        name: "finish_intelligence_source_ingestion",
        body: {
          p_source_run_id: sourceReceiptId,
          p_status: "succeeded",
          p_rows_read: rowCount,
          p_rows_written: rowCount,
          p_error_summary: null,
        },
      });
      await upsertRows({
        fetchImpl,
        baseUrl,
        serviceKey,
        table: "intelligence_sources",
        rows: [sourceStatusRow(payloads, source.source_key, "healthy")],
        onConflict: "source_key",
        batchSize,
      });
      sourceReceiptIds.delete(source.source_key);
      publishedSourceKeys.add(source.source_key);
    }

    const counts = {
      sources: payloads.sources.length,
      canonicalModels: payloads.canonicalModels.length,
      aliases: payloads.aliases.length,
      benchmarkDefinitions: payloads.benchmarkDefinitions.length,
      benchmarkVersions: payloads.benchmarkVersions.length,
      observations: payloads.observations.length,
      polibenchSnapshots: payloads.polibenchSnapshots.length,
    };
    await callRpc({
      fetchImpl,
      baseUrl,
      serviceKey,
      name: "finish_intelligence_ingestion",
      body: { p_run_id: runId, p_status: "succeeded", p_summary: counts, p_error_summary: null },
    });
    return { status: "succeeded", counts };
  } catch (error) {
    for (const receiptId of sourceReceiptIds.values()) {
      try {
        await callRpc({
          fetchImpl,
          baseUrl,
          serviceKey,
          name: "finish_intelligence_source_ingestion",
          body: {
            p_source_run_id: receiptId,
            p_status: "failed",
            p_rows_read: 0,
            p_rows_written: 0,
            p_error_summary: "Sanitized upstream failure",
          },
        });
      } catch {
        // The original sanitized failure remains the only caller-visible error.
      }
    }
    const failedStatus = dataWritesStarted ? "partial" : "failed";
    const unpublishedSourceRows = payloads.sources
      .filter((source) => !publishedSourceKeys.has(source.source_key))
      .map((source) => sourceStatusRow(payloads, source.source_key, failedStatus));
    if (unpublishedSourceRows.length) {
      try {
        await upsertRows({
          fetchImpl,
          baseUrl,
          serviceKey,
          table: "intelligence_sources",
          rows: unpublishedSourceRows,
          onConflict: "source_key",
          batchSize,
        });
      } catch {
        // The original sanitized failure remains the only caller-visible error.
      }
    }
    if (runId !== null) {
      try {
        await callRpc({
          fetchImpl,
          baseUrl,
          serviceKey,
          name: "finish_intelligence_ingestion",
          body: {
            p_run_id: runId,
            p_status: "failed",
            p_summary: {},
            p_error_summary: "Sanitized upstream failure",
          },
        });
      } catch {
        // The original sanitized failure remains the only caller-visible error.
      }
    }
    throw error;
  }
}

const readArgument = (name, argv) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};

const summarizePayloads = (payloads) => ({
  sources: payloads.sources.length,
  canonicalModels: payloads.canonicalModels.length,
  aliases: payloads.aliases.length,
  benchmarkDefinitions: payloads.benchmarkDefinitions.length,
  benchmarkVersions: payloads.benchmarkVersions.length,
  observations: payloads.observations.length,
  polibenchSnapshots: payloads.polibenchSnapshots.length,
});

/**
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   fetchImpl?: FetchLike,
 *   argv?: string[],
 *   writeOutput?: (value: string) => unknown,
 * }} options
 */
export async function runCli({
  env = process.env,
  fetchImpl = defaultFetch,
  argv = process.argv,
  writeOutput = (value) => process.stdout.write(value),
} = {}) {
  const inputPath = readArgument("--input", argv);
  if (!inputPath) {
    throw new Error("Missing local input bundle: pass --input <path>");
  }
  let input;
  try {
    input = JSON.parse(await readFile(path.resolve(inputPath), "utf8"));
  } catch {
    throw new Error("Unable to read a valid local intelligence input bundle");
  }
  if (argv.includes("--dry-run")) {
    const result = {
      status: "dry-run",
      counts: summarizePayloads(buildIntelligencePayloads(input)),
    };
    writeOutput(`${JSON.stringify(result)}\n`);
    return result;
  }
  validateServerConfig(env);
  const result = await syncIntelligenceData({ input, env, fetchImpl });
  writeOutput(`${JSON.stringify(result)}\n`);
  return result;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  runCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Intelligence sync failed"}\n`);
    process.exitCode = 1;
  });
}
