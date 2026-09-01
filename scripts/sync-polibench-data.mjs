#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const POLIBENCH_REPOSITORY = "https://github.com/JonathanRReed/Poli-bench";
export const POLIBENCH_COMMIT = "f49763cdbca9387d823ba19578992434b5ac04b0";
export const POLIBENCH_ARTIFACT_PATH = "src/data/liveBenchmark.generated.json";

const DEFAULT_SOURCE_PATH = path.resolve(process.cwd(), "../Poli-bench", POLIBENCH_ARTIFACT_PATH);
const DEFAULT_OUTPUT_PATH = path.resolve(process.cwd(), "public/data/polibench-snapshot.json");

const asRecord = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
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
  return value;
};

const asNumber = (value, label) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
};

const asOptionalNumber = (value, label) =>
  value === undefined || value === null ? null : asNumber(value, label);

const readRequiredText = (record, key, label) => asText(record[key], `${label}.${key}`);
const readRequiredNumber = (record, key, label) => asNumber(record[key], `${label}.${key}`);
const readOptionalNumber = (record, key, label) => asOptionalNumber(record[key], `${label}.${key}`);

const parseJson = (text, source) => {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`PoliBench source at ${source} is not valid JSON`);
  }
};

/**
 * Reads only an explicit local file or HTTPS URL. This keeps source selection
 * observable at the command boundary and avoids implicit model-source lookups.
 */
export async function loadPoliBenchArtifact(source) {
  const descriptor = asRecord(source, "PoliBench source");
  if (descriptor.kind === "file") {
    const sourcePath = asText(descriptor.path, "PoliBench source.path");
    return parseJson(await readFile(sourcePath, "utf8"), sourcePath);
  }

  if (descriptor.kind === "url") {
    const sourceUrl = asText(descriptor.url, "PoliBench source.url");
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:") {
      throw new Error("PoliBench URL sources must use HTTPS; use { kind: 'file', path } for local files.");
    }
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`PoliBench source download failed with HTTP ${response.status}`);
    }
    return parseJson(await response.text(), sourceUrl);
  }

  throw new Error("Unsupported PoliBench source. Use { kind: 'file', path } or { kind: 'url', url }.");
}

const normalizeAxisScores = (value, label) => {
  const axes = asArray(value, `${label}.axisScores`);
  if (!axes.length) throw new Error(`${label}.axisScores must not be empty`);
  return axes.map((axis, index) => {
    const axisRecord = asRecord(axis, `${label}.axisScores[${index}]`);
    return {
      axis: readRequiredText(axisRecord, "axis", `${label}.axisScores[${index}]`),
      score: readRequiredNumber(axisRecord, "score", `${label}.axisScores[${index}]`),
      answeredItems: readRequiredNumber(axisRecord, "answeredItems", `${label}.axisScores[${index}]`),
    };
  });
};

const artifactLinkKeys = [
  "canonicalResponses",
  "axisIntervals",
  "responseStyleControls",
  "exclusions",
  "duplicateResolution",
  "rawResponses",
];

const normalizeInternalPath = (value, label) => {
  const internalPath = asText(value, label);
  if (!internalPath.startsWith("/") || internalPath.startsWith("//") ||
    internalPath.includes("\\") || internalPath.includes("..")) {
    throw new Error(`${label} must be a safe internal path`);
  }
  return internalPath;
};

const normalizeArtifactLinks = (value, label) => {
  const links = asRecord(value, `${label}.artifactLinks`);
  return Object.fromEntries(
    artifactLinkKeys.map((key) => [key, normalizeInternalPath(links[key], `${label}.artifactLinks.${key}`)]),
  );
};

const normalizeSourceModel = (value, index) => {
  const label = `models[${index}]`;
  const model = asRecord(value, label);
  return {
    modelSlug: readRequiredText(model, "modelSlug", label),
    provider: readRequiredText(model, "provider", label),
    label: readRequiredText(model, "label", label),
    note: readRequiredText(model, "note", label),
    releases: {
      release: readRequiredText(model, "release", label),
      benchmarkRelease: readRequiredText(model, "benchmarkRelease", label),
      paperReleaseVersion: readRequiredText(model, "paperReleaseVersion", label),
    },
  };
};

const normalizeSourceRow = (value, index, modelsBySlug) => {
  const label = `rows[${index}]`;
  const row = asRecord(value, label);
  const modelSlug = readRequiredText(row, "modelSlug", label);
  const model = modelsBySlug.get(modelSlug);
  if (!model) throw new Error(`${label}.modelSlug must exactly match a source model identity`);
  if (readRequiredText(row, "provider", label) !== model.provider) {
    throw new Error(`${label}.provider must match the source-native model provider`);
  }
  if (readRequiredText(row, "label", label) !== model.label) {
    throw new Error(`${label}.label must match the source-native model label`);
  }

  return {
    modelSlug,
    provider: model.provider,
    label: model.label,
    note: model.note,
    releases: model.releases,
    runId: readRequiredText(row, "runId", label),
    status: readRequiredText(row, "status", label),
    evidenceLevel: readRequiredNumber(row, "evidenceLevel", label),
    evidenceLabel: readRequiredText(row, "evidenceLabel", label),
    scoreStatus: readRequiredText(row, "scoreStatus", label),
    uncertaintySummary: readRequiredText(row, "uncertaintySummary", label),
    robustness: readRequiredNumber(row, "robustness", label),
    completionRate: readRequiredNumber(row, "completionRate", label),
    completedResponses: readRequiredNumber(row, "completedResponses", label),
    parseValidResponses: readRequiredNumber(row, "parseValidResponses", label),
    parseValidity: readRequiredNumber(row, "parseValidity", label),
    paraphraseStability: readRequiredNumber(row, "paraphraseStability", label),
    rerunStability: readRequiredNumber(row, "rerunStability", label),
    contradictionConsistency: readRequiredNumber(row, "contradictionConsistency", label),
    resolutionRate: readRequiredNumber(row, "resolutionRate", label),
    costPerCompletedResponse: readRequiredNumber(row, "costPerCompletedResponse", label),
    p95LatencyMs: readRequiredNumber(row, "p95LatencyMs", label),
    axisScores: normalizeAxisScores(row.axisScores, label),
    lastRunStartedAt: readRequiredNumber(row, "lastRunStartedAt", label),
    lastRunFinishedAt: readRequiredNumber(row, "lastRunFinishedAt", label),
    artifactLinks: normalizeArtifactLinks(row.artifactLinks, label),
  };
};

const normalizeSourceRun = (value, index, modelsBySlug) => {
  const label = `runs[${index}]`;
  const run = asRecord(value, label);
  const modelSlug = readRequiredText(run, "modelSlug", label);
  if (!modelsBySlug.has(modelSlug)) {
    throw new Error(`${label}.modelSlug must exactly match a source model identity`);
  }
  return {
    runId: readRequiredText(run, "runId", label),
    suite: readRequiredText(run, "suite", label),
    modelSlug,
    status: readRequiredText(run, "status", label),
    startedAt: readRequiredNumber(run, "startedAt", label),
    finishedAt: readOptionalNumber(run, "finishedAt", label),
    expectedResponses: readRequiredNumber(run, "expectedResponses", label),
    completedResponses: readRequiredNumber(run, "completedResponses", label),
    parseValidResponses: readRequiredNumber(run, "parseValidResponses", label),
    completionRate: readRequiredNumber(run, "completionRate", label),
    parseValidity: readRequiredNumber(run, "parseValidity", label),
    rerunStability: readRequiredNumber(run, "rerunStability", label),
    robustness: readRequiredNumber(run, "robustness", label),
    costPerCompletedResponse: readOptionalNumber(run, "costPerCompletedResponse", label),
    p95LatencyMs: readOptionalNumber(run, "p95LatencyMs", label),
    releases: {
      release: readRequiredText(run, "release", label),
      benchmarkRelease: readRequiredText(run, "benchmarkRelease", label),
      paperReleaseVersion: readRequiredText(run, "paperReleaseVersion", label),
    },
  };
};

export function transformPoliBenchSnapshot(input) {
  const artifact = asRecord(input, "PoliBench artifact");
  const generatedAt = readRequiredText(artifact, "generatedAt", "PoliBench artifact");
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error("PoliBench artifact.generatedAt must be an ISO timestamp");
  }
  const source = readRequiredText(artifact, "source", "PoliBench artifact");
  if (source !== "live-convex-snapshot") {
    throw new Error(`Unsupported PoliBench artifact source: ${source}`);
  }
  const suite = readRequiredText(artifact, "suite", "PoliBench artifact");
  if (suite !== "full") throw new Error(`Unsupported PoliBench suite: ${suite}`);

  const sourceModels = asArray(artifact.models, "PoliBench artifact.models").map(normalizeSourceModel);
  if (!sourceModels.length) throw new Error("PoliBench artifact.models must not be empty");
  const modelsBySlug = new Map();
  for (const model of sourceModels) {
    if (modelsBySlug.has(model.modelSlug)) {
      throw new Error(`Duplicate source-native modelSlug: ${model.modelSlug}`);
    }
    modelsBySlug.set(model.modelSlug, model);
  }

  const rows = asArray(artifact.rows, "PoliBench artifact.rows").map((row, index) =>
    normalizeSourceRow(row, index, modelsBySlug),
  );
  if (rows.length !== sourceModels.length) {
    throw new Error("PoliBench artifact.rows must contain one exact-identity row per source model");
  }
  const rowSlugs = new Set(rows.map((row) => row.modelSlug));
  if (rowSlugs.size !== rows.length || rowSlugs.size !== sourceModels.length) {
    throw new Error("PoliBench artifact.rows must contain one exact-identity row per source model");
  }

  const runs = asArray(artifact.runs, "PoliBench artifact.runs").map((run, index) =>
    normalizeSourceRun(run, index, modelsBySlug),
  );
  if (!runs.length) throw new Error("PoliBench artifact.runs must not be empty");
  const runIds = new Set(runs.map((run) => run.runId));
  if (runIds.size !== runs.length) throw new Error("PoliBench artifact.runs must have unique runId values");
  const runsById = new Map(runs.map((run) => [run.runId, run]));
  for (const [index, row] of rows.entries()) {
    const run = runsById.get(row.runId);
    if (!run || run.modelSlug !== row.modelSlug) {
      throw new Error(`rows[${index}].runId must resolve to a run receipt for the same modelSlug`);
    }
  }

  return {
    schemaVersion: "1.0",
    source: {
      repository: POLIBENCH_REPOSITORY,
      commit: POLIBENCH_COMMIT,
      artifactPath: POLIBENCH_ARTIFACT_PATH,
    },
    freshness: { generatedAt, suite, source },
    evidence: {
      kind: "live_operational_model_output",
      label: "Live operational model-output evidence",
      humanValidation: "not_collected",
      externalValidation: "not_externally_validated",
      paperRelease: "not_frozen",
      boundary: "Directional political axes are profiles, not higher-is-better quality scores.",
    },
    counts: { models: sourceModels.length, rows: rows.length, runs: runs.length },
    models: rows,
    runs,
  };
}

const readArgument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

export async function syncPoliBenchData({ sourcePath = DEFAULT_SOURCE_PATH, outputPath = DEFAULT_OUTPUT_PATH } = {}) {
  const source = await loadPoliBenchArtifact({ kind: "file", path: sourcePath });
  const snapshot = transformPoliBenchSnapshot(source);
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return snapshot;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const sourcePath = readArgument("--source") ?? DEFAULT_SOURCE_PATH;
  const outputPath = readArgument("--output") ?? DEFAULT_OUTPUT_PATH;
  syncPoliBenchData({ sourcePath, outputPath })
    .then((snapshot) => {
      process.stdout.write(
        `Wrote ${snapshot.counts.models} models, ${snapshot.counts.rows} rows, and ${snapshot.counts.runs} runs to ${outputPath}\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
