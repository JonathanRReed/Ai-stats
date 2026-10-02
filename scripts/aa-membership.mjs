/** Select current source membership from its complete fetch receipt, never global max(last_seen). */
export function selectAaCurrentMembership(rows, receipt) {
  const fetchedAt = Date.parse(receipt?.fetched_at ?? '');
  if (!receipt || typeof receipt.id !== 'string' || !receipt.id ||
    receipt.status !== 200 || !receipt.endpoint?.startsWith('language/') ||
    !Number.isFinite(fetchedAt) || !Array.isArray(receipt.data) || !receipt.data.length) {
    throw new Error('Invalid or empty AA membership receipt');
  }
  const ids = receipt.data.map(row => row?.id);
  if (ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error('Invalid or duplicate AA membership identities');
  }
  const byId = new Map(rows.map(row => [row.id, row]));
  const models = ids.map(id => byId.get(id));
  if (models.some(row => !row || !Number.isFinite(Date.parse(row.last_seen ?? '')) ||
    Date.parse(row.last_seen) < fetchedAt)) throw new Error('AA snapshot not fully imported');
  return { models, snapshotId: receipt.id, fetchedAt: new Date(fetchedAt).toISOString(),
    endpoint: receipt.endpoint };
}
