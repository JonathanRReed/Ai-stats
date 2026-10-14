/** Resolve a publisher display name without changing the source-native model identity. */
export function resolveEpochModelDisplayName(
  modelVersion: string,
  names: Readonly<Record<string, string>>,
): string {
  const resolved = names[modelVersion];
  const displayName = String(resolved ?? '').trim();
  return displayName || modelVersion.replace(/_/g, ' ').replace(/-/g, ' ');
}

/** Shared row projection for the initial and refreshed Epoch leaderboard renders. */
export function resolveEpochLeaderboardRunNames<T extends { model_version: string }>(
  runs: readonly T[],
  names: Readonly<Record<string, string>>,
): Array<T & { name: string }> {
  return runs.map(run => ({
    ...run,
    name: resolveEpochModelDisplayName(run.model_version, names),
  }));
}
