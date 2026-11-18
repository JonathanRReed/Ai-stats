import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { axisScale } from '../../lib/market-axis';
import { familyColor } from '../../lib/family-color';

import '../../styles/compare-explorer.css';
import '../../styles/market.css';

export type MarketPoint = {
  id: string; label: string; family: string; provider: string; x: number; y: number;
  /** Model page on AI Stats. */
  path: string;
  sourceUrl: string; source: string;
  /** Label and preformatted value, in display order. */
  facts: [string, string][];
};

type Props = {
  points: MarketPoint[];
  xLabel: string; yLabel: string;
  logX: boolean; logY: boolean;
  label: string;
};

const tickLabel = (value: number) => value >= 1000
  ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  : new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format(value);
const round = (value: number) => Math.round(value * 100) / 100;

/** Scatter with an independent log or linear scale per axis. Hover previews, click or Enter pins, the panel links to the model page. */
export default function MarketScatter({ points, xLabel, yLabel, logX, logY, label }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(300, Math.round(entry.contentRect.width))));
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const currentId = pinned ?? activeId;
  const active = points.find((point) => point.id === currentId) ?? null;

  const height = width < 600 ? 380 : 480;
  const margin = { top: 28, right: 20, bottom: 52, left: width < 600 ? 46 : 58 };
  const xScale = useMemo(() => axisScale(points.map((point) => point.x), logX), [points, logX]);
  const yScale = useMemo(() => axisScale(points.map((point) => point.y), logY), [points, logY]);
  const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
  const cx = (value: number) => margin.left + (xScale.fraction(value) ?? 0) * plotW;
  const cy = (value: number) => margin.top + plotH - (yScale.fraction(value) ?? 0) * plotH;
  const drawn = points.filter((point) => xScale.fraction(point.x) !== null && yScale.fraction(point.y) !== null);
  // Sparse tick labels on narrow screens so they never collide.
  const decade = (value: number) => Math.abs(Math.log10(value) - Math.round(Math.log10(value))) < 1e-9;
  const xTicks = xScale.ticks.filter((tick, _index, all) => width >= 600 || all.length <= 6 || (logX && decade(tick.value)));
  const families = useMemo(() => {
    const counts = new Map<string, number>();
    points.forEach((point) => counts.set(point.family, (counts.get(point.family) ?? 0) + 1));
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [points]);

  const move = (event: KeyboardEvent<SVGGElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPinned(pinned === id ? null : id); return; }
    if (event.key === 'Escape') { setPinned(null); setActiveId(null); return; }
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nodes = [...event.currentTarget.ownerSVGElement!.querySelectorAll<SVGGElement>('.market-point')];
    nodes[Math.max(0, Math.min(nodes.length - 1, nodes.indexOf(event.currentTarget) + (event.key === 'ArrowRight' ? 1 : -1)))]?.focus();
  };

  const labelX = active ? cx(active.x) : 0;
  const labelAnchor = labelX > width * 0.65 ? 'end' : 'start';

  return <div className="market-scatter compare-explorer">
    <div className="market-scatter-plot" ref={frame}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ height }} role="group" aria-label={label} data-inspecting={active ? 'true' : undefined}>
        <title>{label}</title>
        <text className="plot-label" x={8} y={14}>{yLabel}{logY ? ' · log scale' : ''}</text>
        {yScale.ticks.map((tick) => {
          const y = round(margin.top + plotH - tick.fraction * plotH);
          return <g key={'y' + tick.value}><line className="plot-grid" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
            <text className="plot-tick" x={margin.left - 8} y={y + 4} textAnchor="end">{tickLabel(tick.value)}</text></g>;
        })}
        {xScale.ticks.map((tick) => {
          const x = round(margin.left + tick.fraction * plotW);
          return <g key={'x' + tick.value}><line className="plot-grid market-grid-x" x1={x} x2={x} y1={margin.top} y2={margin.top + plotH} />
            {xTicks.includes(tick) ? <text className="plot-tick" x={x} y={margin.top + plotH + 18} textAnchor="middle">{tickLabel(tick.value)}</text> : null}</g>;
        })}
        <line className="plot-axis" x1={margin.left} x2={width - margin.right} y1={margin.top + plotH} y2={margin.top + plotH} />
        <text className="plot-label" x={margin.left + plotW / 2} y={height - 8} textAnchor="middle">{xLabel}{logX ? ' · log scale' : ''}</text>
        {active ? <g className="point-guide" aria-hidden="true">
          <line x1={round(cx(active.x))} x2={round(cx(active.x))} y1={round(cy(active.y) + 8)} y2={margin.top + plotH} />
          <line x1={margin.left} x2={round(cx(active.x) - 8)} y1={round(cy(active.y))} y2={round(cy(active.y))} />
        </g> : null}
        {drawn.map((point) => {
          const isActive = point.id === active?.id;
          return <g key={point.id} className={'market-point' + (isActive ? ' is-active' : '')} role="button" tabIndex={0}
            aria-label={`${point.label}, ${point.provider}. ${point.facts.map(([name, value]) => `${name} ${value}`).join(', ')}`}
            aria-pressed={pinned === point.id}
            data-dim={active && !isActive ? 'true' : undefined}
            onPointerEnter={() => setActiveId(point.id)} onPointerLeave={() => setActiveId(null)}
            onFocus={() => setActiveId(point.id)} onBlur={() => setActiveId(null)}
            onClick={() => setPinned(pinned === point.id ? null : point.id)} onKeyDown={(event) => move(event, point.id)}>
            <circle cx={round(cx(point.x))} cy={round(cy(point.y))} r="10" fill="transparent" />
            <circle className="point-mark" cx={round(cx(point.x))} cy={round(cy(point.y))} r={isActive ? 6.5 : 4} fill={familyColor(point.family)} />
          </g>;
        })}
        {active ? <text className="point-label" x={round(labelX + (labelAnchor === 'end' ? -12 : 12))} y={round(cy(active.y) - 10)} textAnchor={labelAnchor}>{active.label}</text> : null}
      </svg>
    </div>
    <aside className="market-point-panel" aria-live="polite">
      {active ? <section aria-label="Selected point">
        <div className="market-point-head">
          <strong>{active.label}</strong>
          <div className="market-point-actions">
            <button type="button" aria-pressed={Boolean(pinned)} onClick={() => setPinned(pinned ? null : active.id)}>{pinned ? 'Unpin' : 'Pin'}</button>
            <button type="button" onClick={() => { setPinned(null); setActiveId(null); }}>Clear</button>
          </div>
        </div>
        <p className="market-point-lab"><i style={{ background: familyColor(active.family) }} aria-hidden="true" />{active.provider} · {active.family}</p>
        <dl>{active.facts.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
        <p className="market-point-links">
          <a href={active.path}>Model page</a>
          <a href={active.sourceUrl} rel="noopener noreferrer">{active.source}</a>
        </p>
      </section> : <p className="market-point-hint">Hover or focus a point to read it. Click or press Enter to pin it; arrow keys move between points.</p>}
      <details className="market-family-key">
        <summary>Colour key ({families.length} families)</summary>
        <ul>{families.map(([family, count]) => <li key={family}><i style={{ background: familyColor(family) }} aria-hidden="true" />{family} <span>{count}</span></li>)}</ul>
      </details>
    </aside>
  </div>;
}
