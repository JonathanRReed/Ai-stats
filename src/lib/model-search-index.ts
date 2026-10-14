export type ModelSearchEntry = { n: string; p: string; u: string; i: number | null };

const invalid = () => new Error('Invalid model search index');
const nonemptyText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 2048;
const unsafePathText = (value:string) => [...value].some(character => {
  const code=character.charCodeAt(0);
  return character==='\\'||code<=0x20||code===0x7f;
});

function modelDestination(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 8192 || !value.startsWith('/') ||
      value.startsWith('//') || unsafePathText(value)) return false;
  try {
    const url = new URL(value, 'https://model-index.invalid');
    const decoded = decodeURIComponent(url.pathname);
    if (url.origin !== 'https://model-index.invalid' || unsafePathText(decoded)) return false;
    if (decoded === '/compare') return true;
    if (!/^\/models\/[^/]+\/?$/.test(decoded)) return false;
    return !decoded.split('/').some(part => part === '.' || part === '..');
  } catch { return false; }
}

export function readModelSearchIndex(payload: unknown): ModelSearchEntry[] {
  if (!Array.isArray(payload)) throw invalid();
  const seen = new Set<string>();
  const entries: ModelSearchEntry[] = [];
  for (const item of payload) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) throw invalid();
    const row = item as Record<string, unknown>;
    if (!nonemptyText(row.n) || !nonemptyText(row.p) || !modelDestination(row.u) ||
        !(row.i === null || (typeof row.i === 'number' && Number.isFinite(row.i)))) throw invalid();
    if (seen.has(row.u)) continue;
    seen.add(row.u);
    entries.push({ n: row.n, p: row.p, u: row.u, i: row.i });
  }
  return entries;
}
