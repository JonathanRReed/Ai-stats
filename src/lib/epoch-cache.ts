export type DecodedEpochSnapshot = {
  fetched_at: string;
  models: Array<Record<string, unknown>>;
  benchmarks: Array<Record<string, unknown>>;
  runs: Array<Record<string, unknown>>;
};
