/** Server-side display helpers for the homepage model browser and catalog panel (moved from Dashboard.astro). */

export const formatContextLength = (value: number | null | undefined): string => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "-";
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (num >= 1_000) {
    return `${Math.round(num / 1_000)}K`;
  }
  return String(num);
};

// Helper for score coloring
export function getScoreClass(score: number | null | undefined): string {
  if (!score || score <= 0) return "score-none";
  const pct = score <= 1 ? score * 100 : score;
  if (pct >= 80) return "score-high";
  if (pct >= 60) return "score-mid";
  if (pct >= 40) return "score-low";
  return "score-poor";
}
