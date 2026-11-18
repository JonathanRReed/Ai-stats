/** Browser-only helpers for the /play island. Every storage access survives blocked or missing storage. */
export const STORE_PREFIX = 'aistats-play:v1:';

export function readStore(key: string): string | null {
  try { return window.localStorage.getItem(STORE_PREFIX + key); } catch { return null; }
}
export function writeStore(key: string, value: string): void {
  try { window.localStorage.setItem(STORE_PREFIX + key, value); } catch { /* storage blocked: the game still works for this visit */ }
}
export function readJson<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const raw = readStore(key);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return valid(value) ? value : fallback;
  } catch { return fallback; }
}

/**
 * The answer a visitor was first shown for a day. The pool can shift when the site rebuilds, so a
 * game in progress, a finished game and "yesterday's answer" are all judged against what was played.
 */
export function pinnedAnswer<T extends { key: string }>(slot: string, computed: T | null, byKey: ReadonlyMap<string, T>): T | null {
  const stored = readStore(slot);
  const kept = stored ? byKey.get(stored) : undefined;
  if (kept) return kept;
  if (computed) writeStore(slot, computed.key);
  return computed;
}
/** A past day's answer as this visitor saw it, falling back to the current build's answer. */
export function recalledAnswer<T extends { key: string }>(slot: string, computed: T | null, byKey: ReadonlyMap<string, T>): T | null {
  const stored = readStore(slot);
  return (stored ? byKey.get(stored) : undefined) ?? computed;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch { return false; }
  }
}

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const formatDay = (value: string | null): string | null => (value && Number.isFinite(Date.parse(value)) ? dateFormat.format(new Date(value.slice(0, 10) + 'T00:00:00Z')) : null);
export const formatMoney = (value: number): string => '$' + (value < 0.01 ? value.toFixed(4) : value < 0.1 ? value.toFixed(3) : value.toFixed(2));
export const formatIndex = (value: number): string => value.toFixed(1);
