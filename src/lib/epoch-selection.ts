/** A dataset's size is not its freshness. Ties prefer the published artifact. */
export function preferPublishedEpoch<T extends { fetchedAt: string | null; epochRuns: unknown[] }>(
  published: T | null,
  databaseFetchedAt: string | null,
  databaseRunCount: number,
): boolean {
  if (!published?.epochRuns.length) return false;
  const publishedTime = Date.parse(published.fetchedAt ?? '');
  if (!Number.isFinite(publishedTime)) return false;
  const databaseTime = Date.parse(databaseFetchedAt ?? '');
  return !databaseRunCount || !Number.isFinite(databaseTime) || publishedTime >= databaseTime;
}

/** Once available, validated cache and artifact data outrank uncommitted legacy table updates. */
export function chooseValidatedEpoch<T extends { fetchedAt: string | null; epochRuns: unknown[] }>(
  published: T | null, cached: T | null,
): T | null {
  if (!cached?.epochRuns.length) return published;
  return published && preferPublishedEpoch(published, cached.fetchedAt, cached.epochRuns.length) ? published : cached;
}
