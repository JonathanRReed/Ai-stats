/**
 * Shared utility functions for formatting and validation
 */

/**
 * Format a benchmark score as a percentage string
 * @param score - Score value (can be decimal 0-1 or already a percentage)
 * @returns Formatted score string with % symbol, or 'N/A' if invalid
 */
export function formatScore(score: string | number | null): string {
  if (score === null || score === undefined) return 'N/A';
  const num = Number(score);
  if (!isFinite(num) || num <= 0) return 'N/A';
  const pct = num <= 1 ? num * 100 : num;
  return `${pct.toFixed(1)}%`;
}

/**
 * Format a price value with specified decimal places (truncates, doesn't round)
 * @param price - Price value to format
 * @param decimals - Number of decimal places (default: 3)
 * @returns Formatted price string with $ symbol, or '—' if invalid
 */
export function formatPrice(price: number | null | undefined, decimals = 3): string {
  if (price === null || price === undefined) return '—';
  if (!price && price !== 0) return '—';
  const factor = Math.pow(10, decimals);
  const truncated = Math.trunc(price * factor) / factor;
  return `$${truncated.toFixed(decimals)}`;
}

/**
 * Format tokens per second value
 * @param tps - Tokens per second value
 * @returns Formatted TPS string, or '—' if invalid
 */
export function formatTPS(tps: number | null | undefined): string {
  return tps && Number(tps) > 0 ? `${Number(tps).toFixed(1)}` : '—';
}

/**
 * Format time to first token value
 * @param ttft - Time to first token in seconds
 * @returns Formatted TTFT string with 's' suffix, or '—' if invalid
 */
export function formatTTFT(ttft: number | null | undefined): string {
  return ttft && Number(ttft) > 0 ? `${Number(ttft).toFixed(2)}s` : '—';
}

/**
 * Sanitize HTML string to prevent XSS attacks
 * @param str - String to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHTML(str: string): string {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/**
 * Truncate a number to specified decimal places without rounding
 * @param num - Number to truncate
 * @param decimals - Number of decimal places (default: 3)
 * @returns Truncated number
 */
export function truncateTo(num: number, decimals = 3): number {
  const n = Number(num);
  if (!isFinite(n)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.trunc(n * factor) / factor;
}

/**
 * Conditional logging that only logs in development mode
 */
export const log = import.meta.env.DEV ? console.log.bind(console) : (() => {}) as typeof console.log;
export const warn = import.meta.env.DEV ? console.warn.bind(console) : (() => {}) as typeof console.warn;
export const error = console.error.bind(console); // Always log errors
