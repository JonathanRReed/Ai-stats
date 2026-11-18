/**
 * Rules for the AI Stats daily game at /play. Pure functions only, so the
 * page, the React island and the tests share one definition of "today's
 * puzzle" and of every piece of feedback. Nothing here reads the clock,
 * storage or the network; callers pass dates and values in.
 */

/** Puzzle #1 is this UTC day. Changing it renumbers every puzzle. */
export const GAME_EPOCH = '2026-11-01';
export const MAX_GUESSES = 6;
const DAY_MS = 86_400_000;

/** A plotted record: one AA observation on the cost-versus-Intelligence chart. */
export type GamePoint = {
  id: string;
  /** Candidate key of the family this record belongs to (null if the family is not in the pool). */
  family: string;
  x: number;
  y: number;
  /** YYYY-MM-DD release date as recorded by Artificial Analysis, or null. */
  release: string | null;
};

/** One model family the player can guess. Values come from the family's highest-Index record. */
export type GameCandidate = {
  key: string;
  family: string;
  name: string;
  provider: string;
  index: number;
  /** Horizontal-axis value (cost per task or blended price, per GameData.axis). */
  cost: number;
  /** Blended 3:1 price per 1M tokens, used for the price-band clue. */
  blendedPrice: number | null;
  speed: number | null;
  release: string | null;
  reasoningLevels: number;
  path: string | null;
  pointId: string;
};

export type GameAxis = 'task-cost' | 'blended-price';
export type GameData = {
  axis: GameAxis;
  indexVersion: string | null;
  /** Latest AA observation date among plotted records (YYYY-MM-DD), or null. */
  dataDate: string | null;
  points: GamePoint[];
  candidates: GameCandidate[];
  /** Candidate keys eligible for "Place the release". */
  placeable: string[];
};

export const AXIS_LABELS: Record<GameAxis, { axis: string; short: string; unit: string }> = {
  'task-cost': { axis: 'Cost per task (USD, log scale)', short: 'cost per task', unit: 'per task' },
  'blended-price': { axis: 'Blended price (USD per 1M tokens, log scale)', short: 'blended price', unit: 'per 1M tokens' },
};

// --------------------------------------------------------------------------
// Days
// --------------------------------------------------------------------------

const epochMs = Date.parse(GAME_EPOCH + 'T00:00:00Z');

/** Whole UTC days since GAME_EPOCH (0 on the epoch day, negative before it). */
export function utcDayIndex(date: Date): number {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((midnight - epochMs) / DAY_MS);
}
export const puzzleNumber = (day: number): number => day + 1;
/** Milliseconds from `now` to the next UTC midnight. */
export function msUntilNextUtcDay(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

// --------------------------------------------------------------------------
// Deterministic pick
// --------------------------------------------------------------------------

/** FNV-1a 32-bit with a final avalanche, so near-identical keys spread out. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** An answer cannot return until this many other days have passed: a quarter of the pool. */
export const repeatWindow = (size: number): number => Math.floor(size / 4);

const pickCache = new Map<string, string[]>();
/**
 * The answer for every day from 0 up to `day`.
 *
 * Each day goes to the key with the lowest hash of (salt, day, key) among the keys that were not
 * an answer in the last `repeatWindow` days. Because each key is scored on its own, a family
 * entering or leaving the pool only moves the days it would have won or lost. The site rebuilds
 * several times a day and the pool shifts with the rankings, so an order that depended on the
 * pool's size or on every key's position would change today's answer under a player's feet.
 * The window is kept to a quarter of the pool so one changed day rarely disturbs the days after it.
 */
function picksThrough(keys: string[], day: number, salt: string): string[] {
  const cacheKey = salt + '\u0000' + keys.join('\u0000');
  const picks = pickCache.get(cacheKey) ?? [];
  const window = repeatWindow(keys.length);
  for (let current = picks.length; current <= day; current++) {
    const recent = new Set(picks.slice(Math.max(0, current - window), current));
    let best: string | null = null;
    let bestHash = Infinity;
    for (const key of keys) {
      if (recent.has(key)) continue;
      const hash = hashString(`${salt}:${current}:${key}`);
      if (hash < bestHash || (hash === bestHash && best !== null && key < best)) { best = key; bestHash = hash; }
    }
    picks.push(best ?? keys[0]);
  }
  pickCache.set(cacheKey, picks);
  return picks;
}

/** Today's answer for a pool. Returns null for an empty pool or a day before the first puzzle. */
export function dailyPick<T extends { key: string }>(pool: T[], day: number, salt = 'guess'): T | null {
  if (!pool.length || !Number.isInteger(day) || day < 0) return null;
  const byKey = new Map(pool.map((item) => [item.key, item]));
  const keys = [...byKey.keys()].sort();
  return byKey.get(picksThrough(keys, day, salt)[day]) ?? null;
}

// --------------------------------------------------------------------------
// Feedback
// --------------------------------------------------------------------------

/** Each field describes the MYSTERY relative to the guess; null when either value is not recorded. */
export type GuessFeedback = {
  correct: boolean;
  index: 'higher' | 'lower' | 'same' | null;
  cost: 'more' | 'less' | 'same' | null;
  speed: 'faster' | 'slower' | 'same' | null;
  lab: 'same' | 'different' | null;
  release: 'earlier' | 'later' | 'same' | null;
};

const known = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const compareNumbers = <H extends string, L extends string>(mystery: number | null | undefined, guess: number | null | undefined, digits: number, higher: H, lower: L): H | L | 'same' | null => {
  if (!known(mystery) || !known(guess)) return null;
  const a = Number(mystery.toFixed(digits)), b = Number(guess.toFixed(digits));
  return a === b ? 'same' : a > b ? higher : lower;
};
const validDate = (value: string | null | undefined): string | null =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(Date.parse(value.slice(0, 10))) ? value.slice(0, 10) : null;

export function compareGuess(guess: GameCandidate, mystery: GameCandidate): GuessFeedback {
  const guessDate = validDate(guess.release), mysteryDate = validDate(mystery.release);
  return {
    correct: guess.key === mystery.key,
    index: compareNumbers(mystery.index, guess.index, 1, 'higher', 'lower'),
    cost: compareNumbers(mystery.cost, guess.cost, 4, 'more', 'less'),
    speed: compareNumbers(mystery.speed, guess.speed, 0, 'faster', 'slower'),
    lab: mystery.provider && guess.provider ? (mystery.provider === guess.provider ? 'same' : 'different') : null,
    release: guessDate && mysteryDate ? (guessDate === mysteryDate ? 'same' : mysteryDate > guessDate ? 'later' : 'earlier') : null,
  };
}

// --------------------------------------------------------------------------
// Clues
// --------------------------------------------------------------------------

export function releaseQuarter(date: string | null | undefined): string | null {
  const value = validDate(date);
  if (!value) return null;
  return `Q${Math.floor((Number(value.slice(5, 7)) - 1) / 3) + 1} ${value.slice(0, 4)}`;
}
const PRICE_BANDS: Array<[number, string]> = [[0.5, 'under $0.50'], [2, '$0.50 to $2'], [5, '$2 to $5'], [10, '$5 to $10']];
export function priceBand(blended: number | null | undefined): string | null {
  if (!known(blended) || blended <= 0) return null;
  return (PRICE_BANDS.find(([limit]) => blended < limit)?.[1] ?? '$10 or more') + ' per 1M tokens (blended 3:1)';
}
const SPEED_BANDS: Array<[number, string]> = [[50, 'under 50'], [100, '50 to 100'], [150, '100 to 150'], [250, '150 to 250']];
export function speedBand(speed: number | null | undefined): string | null {
  if (!known(speed) || speed <= 0) return null;
  return (SPEED_BANDS.find(([limit]) => speed < limit)?.[1] ?? '250 or more') + ' output tokens per second';
}

export type Clue = { id: 'release' | 'price' | 'speed' | 'reasoning' | 'lab'; label: string; value: string };
/** Clues from vaguest to most specific. A clue whose fact is not recorded is left out, never guessed. */
export function cluesFor(mystery: GameCandidate): Clue[] {
  const clues: Array<Clue | null> = [
    releaseQuarter(mystery.release) ? { id: 'release', label: 'Released', value: releaseQuarter(mystery.release)! } : null,
    priceBand(mystery.blendedPrice) ? { id: 'price', label: 'Price band', value: priceBand(mystery.blendedPrice)! } : null,
    speedBand(mystery.speed) ? { id: 'speed', label: 'Speed', value: speedBand(mystery.speed)! } : null,
    mystery.reasoningLevels > 0 ? { id: 'reasoning', label: 'Reasoning levels', value: mystery.reasoningLevels === 1 ? 'Measured at 1 setting' : `Measured at ${mystery.reasoningLevels} reasoning settings` } : null,
    mystery.provider ? { id: 'lab', label: 'Lab', value: mystery.provider } : null,
  ];
  return clues.filter((clue): clue is Clue => clue !== null);
}
/** Where the mystery point sits, in words, without reading out exact coordinates (the chart text equivalent). */
export function indexRange(value: number): string {
  const low = Math.floor(value / 5) * 5;
  return `${low} to ${low + 5}`;
}
export function costRange(value: number): string | null {
  if (!known(value) || value <= 0) return null;
  const steps = [1, 2, 5, 10];
  const power = 10 ** Math.floor(Math.log10(value));
  const index = steps.findIndex((step, position) => value >= step * power && value < steps[position + 1] * power);
  const low = steps[Math.max(0, index)] * power, high = steps[Math.max(0, index) + 1] * power;
  const format = (amount: number) => '$' + (amount < 1 ? amount.toPrecision(1) : String(amount));
  return `${format(low)} to ${format(high)}`;
}
/** After `misses` wrong guesses, this many clues are visible. */
export const revealedClueCount = (misses: number, available: number): number => Math.max(0, Math.min(misses, available));

// --------------------------------------------------------------------------
// Search
// --------------------------------------------------------------------------

const fold = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
/** Autocomplete ranking: exact, then prefix, then word-start, then substring; lab names match too. */
export function searchCandidates<T extends Pick<GameCandidate, 'key' | 'family' | 'provider'>>(candidates: T[], query: string, exclude: Iterable<string> = [], limit = 8): T[] {
  const q = fold(query);
  if (!q) return [];
  const skip = new Set(exclude);
  const compact = q.replace(/ /g, '');
  const scored: Array<[number, T]> = [];
  for (const candidate of candidates) {
    if (skip.has(candidate.key)) continue;
    const name = fold(candidate.family), lab = fold(candidate.provider);
    const nameCompact = name.replace(/ /g, '');
    const score = name === q ? 0 : name.startsWith(q) || nameCompact.startsWith(compact) ? 1 :
      (' ' + name).includes(' ' + q) ? 2 : name.includes(q) || nameCompact.includes(compact) ? 3 :
      lab.startsWith(q) ? 4 : -1;
    if (score >= 0) scored.push([score, candidate]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].family.localeCompare(b[1].family)).slice(0, limit).map(([, candidate]) => candidate);
}
/** Resolves typed text to a candidate only on an exact (case- and punctuation-insensitive) family match. */
export function exactCandidate<T extends Pick<GameCandidate, 'family'>>(candidates: T[], query: string): T | null {
  const q = fold(query);
  return q ? candidates.find((candidate) => fold(candidate.family) === q) ?? null : null;
}

// --------------------------------------------------------------------------
// Place the release
// --------------------------------------------------------------------------

/** Candidates whose release date is recorded and that have at least `minEarlier` plotted records released strictly before them. */
export function placeablePool(candidates: GameCandidate[], points: GamePoint[], minEarlier = 8): GameCandidate[] {
  return candidates.filter((candidate) => validDate(candidate.release) !== null && pointsBefore(points, candidate).length >= minEarlier);
}
/** Records plotted for a placement round: release recorded and strictly before the target's, never the target's own family. */
export function pointsBefore(points: GamePoint[], target: Pick<GameCandidate, 'key' | 'release'>): GamePoint[] {
  const date = validDate(target.release);
  if (!date) return [];
  return points.filter((point) => {
    const pointDate = validDate(point.release);
    return point.family !== target.key && pointDate !== null && pointDate < date;
  });
}
export const placementError = (guess: number, actual: number): number => Math.abs(Number((guess - actual).toFixed(1)));
/** 0 to 5 filled blocks for the result text: within 1, 3, 6, 10, 15 Index points. */
export function placementBlocks(error: number): number {
  return [1, 3, 6, 10, 15].filter((limit) => error <= limit).length;
}

// --------------------------------------------------------------------------
// Stats and sharing
// --------------------------------------------------------------------------

export type GameStats = {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  /** distribution[n-1] counts wins on guess n. */
  distribution: number[];
  lastDay: number | null;
  lastWinDay: number | null;
};
export const emptyStats = (): GameStats => ({ played: 0, wins: 0, currentStreak: 0, maxStreak: 0, distribution: Array(MAX_GUESSES).fill(0), lastDay: null, lastWinDay: null });

/** Records one finished puzzle. A day already recorded is never counted twice. */
export function recordResult(stats: GameStats, day: number, won: boolean, guesses: number): GameStats {
  if (stats.lastDay !== null && day <= stats.lastDay) return stats;
  const distribution = [...stats.distribution];
  while (distribution.length < MAX_GUESSES) distribution.push(0);
  if (won && guesses >= 1 && guesses <= MAX_GUESSES) distribution[guesses - 1]++;
  const currentStreak = won ? (stats.lastWinDay === day - 1 ? stats.currentStreak + 1 : 1) : 0;
  return {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    currentStreak,
    maxStreak: Math.max(stats.maxStreak, currentStreak),
    distribution,
    lastDay: day,
    lastWinDay: won ? day : stats.lastWinDay,
  };
}
/** Reads stored stats defensively; anything malformed becomes empty stats. */
export function parseStats(raw: string | null): GameStats {
  try {
    const value = raw ? JSON.parse(raw) : null;
    const base = emptyStats();
    if (!value || typeof value !== 'object') return base;
    const int = (input: unknown) => (Number.isInteger(input) && (input as number) >= 0 ? (input as number) : 0);
    const day = (input: unknown) => (Number.isInteger(input) ? (input as number) : null);
    return {
      played: int(value.played), wins: int(value.wins), currentStreak: int(value.currentStreak), maxStreak: int(value.maxStreak),
      distribution: Array.isArray(value.distribution) ? base.distribution.map((_, index) => int(value.distribution[index])) : base.distribution,
      lastDay: day(value.lastDay), lastWinDay: day(value.lastWinDay),
    };
  } catch {
    return emptyStats();
  }
}

export const FILLED = '■'; // ■
export const EMPTY = '□'; // □

/** Plain-text summary for "Copy result": no answer, no emoji. */
export function guessResultText(puzzle: number, outcomes: boolean[], url: string): string {
  const won = outcomes.includes(true);
  const used = won ? outcomes.indexOf(true) + 1 : outcomes.length;
  const row = outcomes.slice(0, used).map((hit) => (hit ? FILLED : EMPTY)).join('');
  return [`AI Stats daily #${puzzle} · Guess the model · ${won ? used : 'X'}/${MAX_GUESSES}`, row, url].join('\n');
}
export function placeResultText(puzzle: number, error: number, url: string): string {
  const filled = placementBlocks(error);
  return [`AI Stats daily #${puzzle} · Place the release · ${error.toFixed(1)} Index points off`,
    FILLED.repeat(filled) + EMPTY.repeat(5 - filled), url].join('\n');
}
