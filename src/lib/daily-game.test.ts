import { expect, test } from "bun:test";
import {
  GAME_EPOCH, MAX_GUESSES, costRange, indexRange, compareGuess, cluesFor, dailyPick, emptyStats, exactCandidate, formatCountdown,
  guessResultText, msUntilNextUtcDay, parseStats, placeResultText, placeablePool, placementBlocks, placementError,
  pointsBefore, repeatWindow, priceBand, puzzleNumber, recordResult, releaseQuarter, revealedClueCount, searchCandidates, utcDayIndex,
  type GameCandidate, type GamePoint,
} from "./daily-game";

const candidate = (key: string, overrides: Partial<GameCandidate> = {}): GameCandidate => ({
  key, family: key, name: key, provider: "Lab", index: 40, cost: 1, blendedPrice: 2, speed: 100,
  release: "2026-06-15", reasoningLevels: 3, path: `/models/${key}`, pointId: key + "-id", ...overrides,
});
const pool = Array.from({ length: 12 }, (_, index) => candidate(`model-${index}`));

test("day index counts whole UTC days from the epoch, whatever the time of day", () => {
  expect(utcDayIndex(new Date(GAME_EPOCH + "T00:00:00Z"))).toBe(0);
  expect(utcDayIndex(new Date(GAME_EPOCH + "T23:59:59Z"))).toBe(0);
  expect(utcDayIndex(new Date("2026-11-18T12:00:00Z"))).toBe(17);
  expect(utcDayIndex(new Date("2026-10-31T23:00:00Z"))).toBe(-1);
  // Across a DST change and a year boundary.
  expect(utcDayIndex(new Date("2027-03-29T01:00:00Z")) - utcDayIndex(new Date("2027-03-27T23:00:00Z"))).toBe(2);
  expect(utcDayIndex(new Date("2027-01-01T00:00:00Z"))).toBe(61);
  expect(puzzleNumber(0)).toBe(1);
});

test("countdown runs to the next UTC midnight", () => {
  expect(msUntilNextUtcDay(new Date("2026-11-18T23:59:00Z"))).toBe(60_000);
  expect(formatCountdown(msUntilNextUtcDay(new Date("2026-11-18T16:47:27Z")))).toBe("07:12:33");
  expect(formatCountdown(-5)).toBe("00:00:00");
});

test("the daily pick is deterministic and the same for every caller", () => {
  expect(dailyPick(pool, 5)?.key).toBe(dailyPick([...pool].reverse(), 5)?.key);
  expect(dailyPick(pool, 5, "guess")?.key).toBe(dailyPick(pool, 5, "guess")?.key);
  expect(dailyPick([], 5)).toBeNull();
});

test("an answer does not return for a quarter of the pool's length, and never two days running", () => {
  const big = Array.from({ length: 60 }, (_, index) => candidate(`family-${index}`));
  const window = repeatWindow(big.length);
  expect(window).toBe(15);
  const picks = Array.from({ length: 400 }, (_, day) => dailyPick(big, day)!.key);
  for (let day = 1; day < picks.length; day++) {
    expect(picks.slice(Math.max(0, day - window), day)).not.toContain(picks[day]);
  }
  // Over a long run the whole pool gets used.
  expect(new Set(picks).size).toBe(big.length);
});

test("a day before the first puzzle has no answer, and the two modes draw different sequences", () => {
  expect(dailyPick(pool, -1)).toBeNull();
  expect(dailyPick(pool, 2.5)).toBeNull();
  const guess = Array.from({ length: 30 }, (_, day) => dailyPick(pool, day, "guess")!.key);
  const place = Array.from({ length: 30 }, (_, day) => dailyPick(pool, day, "place")!.key);
  expect(guess).not.toEqual(place);
});

test("a family entering or leaving the pool moves few answers, so a rebuild rarely changes today's puzzle", () => {
  const big = Array.from({ length: 60 }, (_, index) => candidate(`family-${index}`));
  const days = Array.from({ length: 120 }, (_, day) => day);
  const before = days.map((day) => dailyPick(big, day)!.key);
  let worst = 0;
  for (const leaving of [0, 17, 33, 59]) {
    const swapped = [...big.filter((_, index) => index !== leaving), candidate(`newcomer-${leaving}`)];
    const after = days.map((day) => dailyPick(swapped, day)!.key);
    worst = Math.max(worst, after.filter((key, day) => key !== before[day]).length);
  }
  // The old shuffle moved about two answers in three for one swap; this must stay under one in ten.
  expect(worst).toBeLessThan(12);
});

test("feedback describes the mystery relative to the guess", () => {
  const mystery = candidate("m", { index: 50, cost: 2, speed: 80, provider: "A", release: "2026-09-01" });
  const guess = candidate("g", { index: 40, cost: 3, speed: 120, provider: "B", release: "2026-05-01" });
  expect(compareGuess(guess, mystery)).toEqual({ correct: false, index: "higher", cost: "less", speed: "slower", lab: "different", release: "later" });
  expect(compareGuess(mystery, mystery)).toEqual({ correct: true, index: "same", cost: "same", speed: "same", lab: "same", release: "same" });
});

test("feedback is withheld when either side is not recorded", () => {
  const mystery = candidate("m", { speed: null, release: null });
  const guess = candidate("g", { speed: 50, release: "2026-01-01" });
  const feedback = compareGuess(guess, mystery);
  expect(feedback.speed).toBeNull();
  expect(feedback.release).toBeNull();
  expect(compareGuess(candidate("g", { release: "not a date" }), candidate("m")).release).toBeNull();
});

test("index differences below the displayed precision count as the same", () => {
  expect(compareGuess(candidate("g", { index: 40.04 }), candidate("m", { index: 40.01 })).index).toBe("same");
});

test("clues go from vague to specific and skip facts that are not recorded", () => {
  expect(cluesFor(candidate("m", { provider: "Google", blendedPrice: 4, speed: 82, release: "2026-08-02" })).map((clue) => clue.id))
    .toEqual(["release", "price", "speed", "reasoning", "lab"]);
  const sparse = cluesFor(candidate("m", { blendedPrice: null, speed: null, release: null }));
  expect(sparse.map((clue) => clue.id)).toEqual(["reasoning", "lab"]);
  expect(releaseQuarter("2026-08-02")).toBe("Q3 2026");
  expect(releaseQuarter("2026-12-31")).toBe("Q4 2026");
  expect(releaseQuarter(null)).toBeNull();
  expect(priceBand(0)).toBeNull();
  expect(priceBand(12)).toContain("$10 or more");
  expect(revealedClueCount(3, 2)).toBe(2);
  expect(indexRange(36.5)).toBe("35 to 40");
  expect(costRange(0.411)).toBe("$0.2 to $0.5");
  expect(costRange(10.03)).toBe("$10 to $20");
  expect(costRange(1)).toBe("$1 to $2");
  expect(costRange(0)).toBeNull();
  expect(revealedClueCount(0, 5)).toBe(0);
});

test("search ranks exact and prefix matches first and hides guessed families", () => {
  const list = [candidate("gpt-6-sol", { family: "GPT-6 Sol", provider: "OpenAI" }), candidate("gpt-6-1-sol", { family: "GPT-6.1 Sol", provider: "OpenAI" }),
    candidate("claude-opus-5", { family: "Claude Opus 5", provider: "Anthropic" }), candidate("gemini-4", { family: "Gemini 4 Carbon", provider: "Google" })];
  expect(searchCandidates(list, "gpt6").map((item) => item.key)).toEqual(["gpt-6-sol", "gpt-6-1-sol"]);
  expect(searchCandidates(list, "opus")[0].key).toBe("claude-opus-5");
  expect(searchCandidates(list, "sol", ["gpt-6-sol"]).map((item) => item.key)).toEqual(["gpt-6-1-sol"]);
  expect(searchCandidates(list, "anthro").map((item) => item.key)).toEqual(["claude-opus-5"]);
  expect(searchCandidates(list, "  ")).toEqual([]);
  expect(exactCandidate(list, "gpt-6 SOL")?.key).toBe("gpt-6-sol");
  expect(exactCandidate(list, "gpt")).toBeNull();
});

test("placement rounds only show records released before the target", () => {
  const target = candidate("t", { release: "2026-06-01" });
  const points: GamePoint[] = [
    { id: "a", family: "a", x: 1, y: 10, release: "2026-01-01" },
    { id: "b", family: "b", x: 1, y: 10, release: "2026-06-01" },
    { id: "c", family: "c", x: 1, y: 10, release: null },
    { id: "t-old", family: "t", x: 1, y: 10, release: "2025-01-01" },
  ];
  expect(pointsBefore(points, target).map((point) => point.id)).toEqual(["a"]);
  expect(placeablePool([target], points, 1)).toHaveLength(1);
  expect(placeablePool([target], points, 2)).toHaveLength(0);
  expect(placeablePool([candidate("u", { release: null })], points, 0)).toHaveLength(0);
});

test("placement is scored by distance in Index points", () => {
  expect(placementError(42.3, 40)).toBe(2.3);
  expect(placementError(30, 40)).toBe(10);
  expect([0.5, 2, 5, 9, 14, 30].map(placementBlocks)).toEqual([5, 4, 3, 2, 1, 0]);
});

test("streaks grow on consecutive wins, reset on a loss or a gap, and a day counts once", () => {
  let stats = recordResult(emptyStats(), 10, true, 3);
  stats = recordResult(stats, 11, true, 1);
  expect(stats).toMatchObject({ played: 2, wins: 2, currentStreak: 2, maxStreak: 2 });
  expect(stats.distribution).toEqual([1, 0, 1, 0, 0, 0]);
  expect(recordResult(stats, 11, true, 2)).toBe(stats);
  stats = recordResult(stats, 13, true, 2);
  expect(stats.currentStreak).toBe(1);
  stats = recordResult(stats, 14, false, MAX_GUESSES);
  expect(stats).toMatchObject({ played: 4, wins: 3, currentStreak: 0, maxStreak: 2 });
});

test("stored stats are parsed defensively", () => {
  expect(parseStats(null)).toEqual(emptyStats());
  expect(parseStats("{not json")).toEqual(emptyStats());
  expect(parseStats(JSON.stringify({ played: 3, wins: -1, distribution: [1, "x"], lastDay: 4 }))).toMatchObject({ played: 3, wins: 0, distribution: [1, 0, 0, 0, 0, 0], lastDay: 4 });
});

test("result text has the puzzle number, a block row and the URL, and never the answer", () => {
  const text = guessResultText(18, [false, false, true], "https://example.test/play");
  expect(text).toBe("AI Stats daily #18 · Guess the model · 3/6\n□□■\nhttps://example.test/play");
  expect(guessResultText(18, Array(6).fill(false), "u").split("\n")[0]).toEndWith("X/6");
  expect(placeResultText(4, 2.25, "u")).toBe("AI Stats daily #4 · Place the release · 2.3 Index points off\n■■■■□\nu");
  // No emoji anywhere.
  expect(/\p{Extended_Pictographic}/u.test(text)).toBe(false);
});
