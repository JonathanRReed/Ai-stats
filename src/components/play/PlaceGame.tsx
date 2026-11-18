import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AXIS_LABELS, dailyPick, placeResultText, placementBlocks, placementError, pointsBefore, puzzleNumber, type GameData,
} from '../../lib/daily-game';
import GameChart, { type ChartMark } from './GameChart';
import ResultActions from './ResultActions';
import { formatDay, formatIndex, formatMoney, pinnedAnswer, readJson, writeStore } from './play-utils';

type Props = { data: GameData; day: number; url: string };
type PlaceStats = { played: number; totalError: number; best: number | null; lastDay: number | null };
const isPlaceStats = (value: unknown): value is PlaceStats => Boolean(value) && typeof value === 'object' &&
  Number.isInteger((value as PlaceStats).played) && typeof (value as PlaceStats).totalError === 'number';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function verdict(error: number): string {
  if (error <= 1) return 'Bullseye. Within one point.';
  if (error <= 3) return 'Very close.';
  if (error <= 6) return 'In the right neighbourhood.';
  if (error <= 10) return 'Right chart, wrong altitude.';
  return 'Way off. This one surprised you.';
}

export default function PlaceGame({ data, day, url }: Props) {
  const pool = useMemo(() => data.candidates.filter((candidate) => data.placeable.includes(candidate.key)), [data]);
  const target = useMemo(() => pinnedAnswer(`answer:place:${day}`, dailyPick(pool, day, 'place'), new Map(pool.map((candidate) => [candidate.key, candidate]))), [pool, day]);
  const earlier = useMemo(() => (target ? pointsBefore(data.points, target) : []), [data.points, target]);
  const [value, setValue] = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);
  const [yMax, setYMax] = useState(100);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<PlaceStats | null>(null);
  const onScale = useCallback(({ yMax: max }: { yMax: number }) => setYMax(max), []);

  useEffect(() => {
    const saved = readJson<number | null>(`place:${day}`, null, isNumber);
    setLocked(saved);
    setValue(saved);
    setStats(readJson<PlaceStats | null>('stats:place', null, isPlaceStats));
  }, [day]);

  if (!target) return <p className="play-empty">No placement round today: too few models have a recorded release date.</p>;

  const axis = AXIS_LABELS[data.axis];
  const released = formatDay(target.release) ?? 'an unrecorded date';
  const error = locked === null ? null : placementError(locked, target.index);
  const lock = () => {
    if (value === null || locked !== null) return;
    setLocked(value);
    writeStore(`place:${day}`, JSON.stringify(value));
    const off = placementError(value, target.index);
    const previous = readJson<PlaceStats>('stats:place', { played: 0, totalError: 0, best: null, lastDay: null }, isPlaceStats);
    if (previous.lastDay === null || day > previous.lastDay) {
      const next = { played: previous.played + 1, totalError: previous.totalError + off, best: previous.best === null ? off : Math.min(previous.best, off), lastDay: day };
      writeStore('stats:place', JSON.stringify(next));
      setStats(next);
    }
    setMessage(`Locked at ${formatIndex(value)}. ${target.family} landed at ${formatIndex(target.index)}: ${off.toFixed(1)} points off. ${verdict(off)}`);
  };
  const choose = (next: number) => { if (locked === null) setValue(Math.min(yMax, Math.max(0, Math.round(next * 10) / 10))); };

  const marks: ChartMark[] = locked === null
    ? value === null ? [] : [{ id: 'pending', x: target.cost, y: value, label: `Your pick ${formatIndex(value)}`, tone: 'pending' }]
    : [{ id: 'pending', x: target.cost, y: locked, label: `Your pick ${formatIndex(locked)}`, tone: 'pending' },
      { id: 'answer', x: target.cost, y: target.index, label: `${target.family} ${formatIndex(target.index)}`, tone: 'answer' }];
  const chartLabel = `${earlier.length} models released before ${released}, plotted by ${axis.short} and AA Intelligence Index. A dashed line marks ${target.family}'s ${axis.short}, ${formatMoney(target.cost)}.` +
    (locked === null ? '' : ` Your pick: Index ${formatIndex(locked)}. Actual: ${formatIndex(target.index)}.`);

  return <div className="play-game">
    <div className="play-stage">
      <GameChart domain={data.points} background={earlier} marks={marks} axis={data.axis} indexVersion={data.indexVersion}
        label={chartLabel} guideX={target.cost} onPickY={locked === null ? choose : undefined} onScale={onScale}
        link={locked === null ? null : { x: target.cost, y1: locked, y2: target.index }} />
      <p className="play-chart-note">Grey points are the {earlier.length} models released before {released}, shown with today’s measurements, not the numbers they had then.</p>
    </div>

    <div className="play-side">
      <section className="play-brief" aria-labelledby="play-place-heading">
        <h2 id="play-place-heading">{target.family}</h2>
        <p>{target.provider} released it on {released}. It costs <strong className="play-num">{formatMoney(target.cost)}</strong> {axis.unit}. Where on the Intelligence Index did it land?</p>
      </section>

      {locked === null ? <div className="play-place-controls">
        <label htmlFor="play-place-range">Your pick: <strong className="play-num">{value === null ? 'not placed' : formatIndex(value)}</strong></label>
        <input id="play-place-range" type="range" min={0} max={yMax} step={0.1} value={value ?? Math.round(yMax / 2)}
          aria-valuetext={value === null ? 'Not placed yet' : `Index ${formatIndex(value)}`}
          onChange={(event) => choose(Number(event.target.value))} />
        <p className="play-hint">Click the chart along the dashed line, or use the slider (arrow keys move 0.1).</p>
        <button type="button" className="eco-btn eco-btn-primary" disabled={value === null} onClick={lock}>Lock it in</button>
      </div> : null}
      <p className="sr-only" role="status" aria-live="polite">{message}</p>

      {locked !== null && error !== null ? <section className="play-reveal" aria-labelledby="play-place-result">
        <p className="play-reveal-kicker">{verdict(error)}</p>
        <h2 id="play-place-result"><span className="play-num">{error.toFixed(1)}</span> Index points off</h2>
        <dl className="play-readouts">
          <div><dt>Your pick</dt><dd>{formatIndex(locked)}</dd></div>
          <div><dt>Actual</dt><dd>{formatIndex(target.index)}</dd></div>
          <div><dt>Accuracy</dt><dd className="play-blocks"><span className="sr-only">{placementBlocks(error)} of 5</span><span aria-hidden="true">{'■'.repeat(placementBlocks(error))}<span className="play-blocks-empty">{'□'.repeat(5 - placementBlocks(error))}</span></span></dd></div>
        </dl>
        <ResultActions result={placeResultText(puzzleNumber(day), error, url)} modelPath={target.path} modelName={target.family} />
        {stats && stats.played ? <dl className="play-stats-inline">
          <div><dt>Played</dt><dd>{stats.played}</dd></div>
          <div><dt>Average miss</dt><dd>{(stats.totalError / stats.played).toFixed(1)}</dd></div>
          {stats.best !== null ? <div><dt>Best</dt><dd>{stats.best.toFixed(1)}</dd></div> : null}
        </dl> : null}
      </section> : null}
    </div>
  </div>;
}
