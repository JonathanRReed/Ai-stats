import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { formatChartNumber, plotGeometry } from '../../lib/compare-geometry';
import { AXIS_LABELS, type GameAxis, type GamePoint } from '../../lib/daily-game';

export type ChartMark = {
  id: string;
  x: number;
  y: number;
  label?: string;
  /** mystery: copper target; guess: a wrong guess; answer: the revealed model; pending: the player's placement. */
  tone: 'mystery' | 'guess' | 'answer' | 'pending';
};

type Props = {
  /** Every record in the game, so both modes and every round share one pair of axes. */
  domain: GamePoint[];
  /** Grey, unlabelled records actually drawn. */
  background: GamePoint[];
  marks: ChartMark[];
  axis: GameAxis;
  indexVersion: string | null;
  label: string;
  /** Vertical guide at a known cost (Place the release). */
  guideX?: number | null;
  /** Clicking the plot reports an Index value (Place the release). */
  onPickY?: (value: number) => void;
  /** Line from the player's placement to the true point. */
  link?: { x: number; y1: number; y2: number } | null;
  onScale?: (scale: { yMax: number }) => void;
};

const money = (value: number) => '$' + formatChartNumber(value);
/** Rounded so server and browser floating-point math render identical attributes (no hydration mismatch). */
const r = (value: number) => Math.round(value * 100) / 100;

export default function GameChart({ domain, background, marks, axis, indexVersion, label, guideX, onPickY, link, onScale }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(960);
  useEffect(() => {
    const element = wrap.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(300, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const narrow = width < 560;
  const height = Math.round(Math.min(520, Math.max(320, width * 0.58)));
  const geometry = plotGeometry(domain.map((point) => ({ id: point.id, x: point.x, y: point.y })), 'scatter', 'log', width, height, 16, narrow ? 14 : 24, narrow ? 40 : 56);
  const { left, right, top, bottom } = geometry;
  const xTicks = geometry.xTicks.map((tick) => ({ ...tick, position: r(tick.position) }));
  const yTicks = geometry.yTicks.map((tick) => ({ ...tick, position: r(tick.position) }));

  // Linear Y and log X mappings recovered from the tick positions, so marks at arbitrary values share the grid.
  const [y0, y1] = [yTicks[0], yTicks[yTicks.length - 1]];
  const [x0, x1] = [xTicks[0], xTicks[xTicks.length - 1]];
  const py = (value: number) => r(y0 && y1 && y1.value !== y0.value ? y0.position + ((value - y0.value) / (y1.value - y0.value)) * (y1.position - y0.position) : bottom);
  const px = (value: number) => r(x0 && x1 && x1.value !== x0.value ? x0.position + ((Math.log10(value) - Math.log10(x0.value)) / (Math.log10(x1.value) - Math.log10(x0.value))) * (x1.position - x0.position) : left);
  const yMax = y1?.value ?? 100;
  useEffect(() => { onScale?.({ yMax }); }, [onScale, yMax]);
  const valueAt = (svgY: number) => {
    if (!y0 || !y1 || y1.position === y0.position) return 0;
    const value = y0.value + ((svgY - y0.position) / (y1.position - y0.position)) * (y1.value - y0.value);
    return Math.min(yMax, Math.max(0, Math.round(value * 10) / 10));
  };
  const pick = (event: PointerEvent<SVGSVGElement>) => {
    if (!onPickY || !svg.current) return;
    const rect = svg.current.getBoundingClientRect();
    const y = ((event.clientY - rect.top) / rect.height) * height;
    if (y < top - 8 || y > bottom + 8) return;
    onPickY(valueAt(y));
  };

  // Greedy label placement: try a few offsets around each mark, keep the first that collides with nothing.
  const placed: Array<{ left: number; right: number; top: number; bottom: number }> = [];
  const labels = marks.filter((mark) => mark.label).map((mark) => {
    const cx = px(mark.x), cy = py(mark.y);
    const text = mark.label!;
    const textWidth = text.length * (narrow ? 6.2 : 6.8) + 4;
    const anchorEnd = cx + 10 + textWidth > right;
    let chosen = { dy: -10, box: { left: 0, right: 0, top: 0, bottom: 0 } };
    for (const dy of [-10, 18, -26, 34, -42, 50]) {
      const boxLeft = anchorEnd ? cx - 10 - textWidth : cx + 10;
      const box = { left: boxLeft, right: boxLeft + textWidth, top: cy + dy - 12, bottom: cy + dy + 3 };
      chosen = { dy, box };
      if (box.top >= 2 && !placed.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) break;
    }
    placed.push(chosen.box);
    return { mark, x: anchorEnd ? cx - 10 : cx + 10, y: cy + chosen.dy, anchor: anchorEnd ? 'end' : 'start', text };
  });
  const order = { guess: 0, pending: 1, answer: 2, mystery: 3 } as const;

  return <div className="play-chart" ref={wrap}>
    <svg ref={svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}
      className={onPickY ? 'is-pickable' : undefined} onPointerDown={pick}>
      <g aria-hidden="true">
        {yTicks.map((tick) => <g key={'y' + tick.value}>
          <line className="play-grid" x1={left} x2={right} y1={tick.position} y2={tick.position} />
          <text className="play-tick" x={left - 8} y={tick.position + 4} textAnchor="end">{formatChartNumber(tick.value)}</text>
        </g>)}
        {xTicks.map((tick) => <g key={'x' + tick.value}>
          <line className="play-grid" x1={tick.position} x2={tick.position} y1={top} y2={bottom} />
          <text className="play-tick" x={tick.position} y={bottom + 18} textAnchor="middle">{money(tick.value)}</text>
        </g>)}
        <line className="play-axis" x1={left} x2={right} y1={bottom} y2={bottom} />
        <line className="play-axis" x1={left} x2={left} y1={top} y2={bottom} />
        <text className="play-axis-label" x={(left + right) / 2} y={height - 18} textAnchor="middle">{AXIS_LABELS[axis].axis}</text>
        <text className="play-axis-label" transform={`translate(12 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">
          AA Intelligence Index{indexVersion ? ` v${indexVersion}` : ''}
        </text>
        {typeof guideX === 'number' ? <line className="play-guide" x1={px(guideX)} x2={px(guideX)} y1={top} y2={bottom} /> : null}
        {background.map((point) => <circle key={point.id} className="play-dot" cx={px(point.x)} cy={py(point.y)} r={narrow ? 3 : 3.5} />)}
        {link ? <line className="play-link" x1={px(link.x)} x2={px(link.x)} y1={py(link.y1)} y2={py(link.y2)} /> : null}
        {[...marks].sort((a, b) => order[a.tone] - order[b.tone]).map((mark) => {
          const cx = px(mark.x), cy = py(mark.y);
          if (mark.tone === 'mystery') return <g key={mark.id} className="play-mark is-mystery" transform={`translate(${cx} ${cy})`}>
            <circle className="play-mystery-halo" r="14" /><circle className="play-mystery-dot" r="7" />
          </g>;
          if (mark.tone === 'answer') return <g key={mark.id} className="play-mark is-answer" transform={`translate(${cx} ${cy})`}>
            <circle className="play-answer-ring" r="13" /><circle className="play-mystery-dot" r="7" />
          </g>;
          if (mark.tone === 'pending') return <g key={mark.id} className="play-mark is-pending" transform={`translate(${cx} ${cy})`}>
            <circle className="play-pending-dot" r="7" /><line className="play-pending-cross" x1="-12" x2="12" y1="0" y2="0" />
          </g>;
          return <circle key={mark.id} className="play-mark is-guess" cx={cx} cy={cy} r="5.5" />;
        })}
        {labels.map(({ mark, x, y, anchor, text }) =>
          <text key={'label' + mark.id} className={`play-mark-label is-${mark.tone}`} x={x} y={y} textAnchor={anchor as 'start' | 'end'}>{text}</text>)}
      </g>
    </svg>
  </div>;
}

