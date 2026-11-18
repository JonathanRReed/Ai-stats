/** Axis scales for the market scatter, log or linear per axis. Kept apart so the browser island stays small. */
export type AxisScale = {log: boolean; domain: [number, number]; fraction: (value: number) => number | null; ticks: {value: number; fraction: number}[]};

/**
 * Value to 0..1 position. Log axes take only positive values (a nonpositive value gets
 * no position, never a clamp) and tick at 1-2-5 steps when they span three decades or fewer.
 */
export function axisScale(values: number[], log: boolean): AxisScale {
  const usable = values.filter((value) => Number.isFinite(value) && (!log || value > 0));
  if (log) {
    let low = usable.length ? Math.floor(Math.log10(Math.min(...usable))) : 0;
    let high = usable.length ? Math.ceil(Math.log10(Math.max(...usable))) : 1;
    if (low === high) { low -= 1; high += 1; }
    // Tighten the decade bounds to the nearest 1-2-5 value around the data.
    if (usable.length) {
      const candidates: number[] = [];
      for (let exponent = low; exponent <= high; exponent++) for (const step of [1, 2, 5]) candidates.push(exponent + Math.log10(step));
      const min = Math.log10(Math.min(...usable)), max = Math.log10(Math.max(...usable));
      const tightLow = Math.max(...candidates.filter((value) => value <= min + 1e-12));
      const tightHigh = Math.min(...candidates.filter((value) => value >= max - 1e-12));
      if (tightHigh > tightLow) { low = tightLow; high = tightHigh; }
    }
    const steps = high - low <= 3 ? [1, 2, 5] : [1];
    const fraction = (value: number) => value > 0 && Number.isFinite(value) ? (Math.log10(value) - low) / (high - low) : null;
    const ticks: {value: number; fraction: number}[] = [];
    for (let exponent = Math.floor(low); exponent <= Math.ceil(high); exponent++) for (const step of steps) {
      const value = Number((step * 10 ** exponent).toPrecision(12));
      const position = fraction(value);
      if (position !== null && position >= -1e-6 && position <= 1 + 1e-6) ticks.push({value, fraction: position});
    }
    const bound = (exponent: number) => Number((10 ** exponent).toPrecision(12));
    return {log, domain: [bound(low), bound(high)], fraction, ticks};
  }
  const min = usable.length ? Math.min(0, ...usable) : 0;
  let max = usable.length ? Math.max(...usable) : 1;
  if (max <= min) max = min + 1;
  const rough = (max - min) / 5, power = 10 ** Math.floor(Math.log10(rough)), ratio = rough / power;
  const step = (ratio <= 1.5 ? 1 : ratio <= 3 ? 2 : ratio <= 7 ? 5 : 10) * power;
  const low = Math.floor(min / step) * step, high = Math.ceil(max / step) * step;
  const fraction = (value: number) => Number.isFinite(value) ? (value - low) / (high - low) : null;
  const ticks = [];
  for (let value = low; value <= high + step / 2; value += step) ticks.push({value: Number(value.toPrecision(12)), fraction: (value - low) / (high - low)});
  return {log, domain: [low, high], fraction, ticks};
}
