import { expect, test } from "bun:test";
import {
  buildVisitPayload,
  parseVisitTimestamp,
  resolveVisitStorage,
  updatesSinceLastVisit,
  visitReason,
  type VisitCandidate,
} from "./last-visit";

const NOW = Date.parse("2026-11-18T12:00:00Z");
const at = (iso: string) => Date.parse(iso);
const candidate = (id: string, family: string, releaseDate: string | null, firstSeen: string | null, provider = "Lab"): VisitCandidate => ({
  id, name: `${family} (${id})`, family, provider, href: `/models/${id}`, releaseDate, firstSeen,
});
const payload = (candidates: VisitCandidate[], windowStart = "2026-07-21T00:00:00.000Z") => ({ windowStart, candidates });

test("stored timestamps are accepted only when plausible", () => {
  expect(parseVisitTimestamp(String(at("2026-11-01T08:00:00Z")), NOW)).toBe(at("2026-11-01T08:00:00Z"));
  expect(parseVisitTimestamp(null, NOW)).toBeNull();
  expect(parseVisitTimestamp("", NOW)).toBeNull();
  expect(parseVisitTimestamp("not a date", NOW)).toBeNull();
  expect(parseVisitTimestamp("2026-11-01", NOW)).toBeNull();
  expect(parseVisitTimestamp("1000", NOW)).toBeNull();
  // A clock far in the future would hide every update forever.
  expect(parseVisitTimestamp(String(NOW + 86_400_000), NOW)).toBeNull();
  expect(parseVisitTimestamp(String(NOW + 60_000), NOW)).toBe(NOW + 60_000);
});

test("a first visit has no baseline and records this view", () => {
  expect(resolveVisitStorage(null, null, NOW)).toEqual({ baseline: null, session: "", stored: String(NOW) });
  // A reload in the same tab stays a first visit even though a timestamp is now stored.
  expect(resolveVisitStorage(String(NOW - 1000), "", NOW)).toEqual({ baseline: null, session: "", stored: String(NOW) });
});

test("a returning visit pins its baseline for the tab session and records each view", () => {
  const previous = at("2026-11-01T08:00:00Z");
  const first = resolveVisitStorage(String(previous), null, NOW);
  expect(first).toEqual({ baseline: previous, session: String(previous), stored: String(NOW) });
  const reload = resolveVisitStorage(first.stored, first.session, NOW + 5000);
  expect(reload.baseline).toBe(previous);
  expect(reload.stored).toBe(String(NOW + 5000));
  // A corrupted session value falls back to showing nothing rather than guessing.
  expect(resolveVisitStorage(String(previous), "garbage", NOW).baseline).toBeNull();
});

test("release days count only when after the visit's UTC day; first observation compares exactly", () => {
  const visit = at("2026-10-26T15:00:00Z");
  expect(visitReason(candidate("a", "A", "2026-10-26", null), visit)).toBeNull();
  expect(visitReason(candidate("a", "A", "2026-10-27", null), visit)).toEqual({ reason: "released", date: "2026-10-27" });
  expect(visitReason(candidate("a", "A", "2026-10-20", "2026-10-26T16:00:00Z"), visit)).toEqual({ reason: "observed", date: "2026-10-26T16:00:00Z" });
  expect(visitReason(candidate("a", "A", "2026-10-20", "2026-10-26T14:00:00Z"), visit)).toBeNull();
  // A release day wins over the first-observed time when both qualify.
  expect(visitReason(candidate("a", "A", "2026-10-28", "2026-10-28T21:00:00Z"), visit)?.reason).toBe("released");
});

test("missing or malformed dates are never treated as new", () => {
  const visit = at("2026-10-01T00:00:00Z");
  expect(visitReason(candidate("a", "A", null, null), visit)).toBeNull();
  expect(visitReason(candidate("a", "A", "2026-13-40", "soon"), visit)).toBeNull();
});

test("updates are grouped per provider and family, newest first, with an exact total inside the window", () => {
  const result = updatesSinceLastVisit(payload([
    candidate("terra-low", "Terra", "2026-10-26", "2026-10-26T21:00:00Z", "OpenAI"),
    candidate("terra-max", "Terra", "2026-10-26", "2026-10-26T21:00:00Z", "OpenAI"),
    candidate("carbon", "Carbon", "2026-10-28", "2026-10-28T21:00:00Z", "Google"),
    candidate("flash", "Flash", "2026-10-17", "2026-10-30T17:00:00Z", "DeepSeek"),
    candidate("other-terra", "Terra", "2026-10-25", null, "Other lab"),
    candidate("old", "Old", "2026-09-01", "2026-09-02T00:00:00Z"),
  ]), at("2026-10-20T00:00:00Z"));
  expect(result.items.map((item) => item.id)).toEqual(["flash", "carbon", "terra-low", "other-terra"]);
  expect(result.items[0]).toMatchObject({ reason: "observed", date: "2026-10-30T17:00:00Z" });
  expect(result.total).toBe(4);
  expect(result.complete).toBe(true);
});

test("nothing new means an empty result, and the display limit keeps the true total", () => {
  const many = Array.from({ length: 9 }, (_, index) => candidate(`m${index}`, `F${index}`, `2026-11-0${index + 1}`, null));
  expect(updatesSinceLastVisit(payload(many), NOW).items).toEqual([]);
  const limited = updatesSinceLastVisit(payload(many), at("2026-10-01T00:00:00Z"), 3);
  expect(limited.items.map((item) => item.id)).toEqual(["m8", "m7", "m6"]);
  expect(limited.total).toBe(9);
});

test("a visit older than the shipped window reports an incomplete count", () => {
  const result = updatesSinceLastVisit(payload([candidate("a", "A", "2026-10-01", null)], "2026-07-21T00:00:00.000Z"), at("2026-05-01T00:00:00Z"));
  expect(result.total).toBe(1);
  expect(result.complete).toBe(false);
});

test("the server payload keeps only recent records with real dates", () => {
  const built = buildVisitPayload([
    { id: "new", name: "New", family: "New", provider: "Lab", href: "/models/new", releaseDate: "2026-11-01", firstSeen: "2026-11-01T10:00:00Z" },
    { id: "late-seen", name: "Late", family: "Late", provider: "Lab", href: "/models/late", releaseDate: "2025-01-01", firstSeen: "2026-10-30T00:00:00Z" },
    { id: "stale", name: "Stale", family: "Stale", provider: "Lab", href: "/models/stale", releaseDate: "2025-01-01", firstSeen: "2025-01-02T00:00:00Z" },
    { id: "undated", name: "Undated", family: "Undated", provider: "Lab", href: "/models/undated", releaseDate: null, firstSeen: null },
    { id: "bad", name: "Bad", family: "Bad", provider: "Lab", href: "/models/bad", releaseDate: "soon", firstSeen: "" },
    { id: "nameless", name: null, family: "", provider: "Lab", href: "/models/x", releaseDate: "2026-11-01", firstSeen: null },
  ], NOW, 120);
  expect(built.candidates.map((item) => item.id)).toEqual(["new", "late-seen"]);
  expect(built.candidates[1]).toMatchObject({ releaseDate: "2025-01-01", firstSeen: "2026-10-30T00:00:00Z" });
  expect(built.windowStart).toBe("2026-07-21T00:00:00.000Z");
});
