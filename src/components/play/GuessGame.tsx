import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AXIS_LABELS, MAX_GUESSES, cluesFor, compareGuess, costRange, dailyPick, guessResultText, indexRange, parseStats,
  puzzleNumber, recordResult, revealedClueCount, type GameCandidate, type GameData, type GameStats, type GuessFeedback,
} from '../../lib/daily-game';
import GameChart, { type ChartMark } from './GameChart';
import FamilySearch from './FamilySearch';
import ResultActions from './ResultActions';
import { formatDay, formatIndex, formatMoney, pinnedAnswer, readJson, readStore, writeStore } from './play-utils';

type Props = { data: GameData; day: number; url: string };

const isKeyList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

const FEEDBACK_TEXT = {
  index: { higher: ['↑', 'Scores higher'], lower: ['↓', 'Scores lower'], same: ['=', 'Same Index'] },
  cost: { more: ['→', 'Costs more'], less: ['←', 'Costs less'], same: ['=', 'Same cost'] },
  speed: { faster: ['', 'Faster'], slower: ['', 'Slower'], same: ['', 'Same speed'] },
  lab: { same: ['', 'Same lab'], different: ['', 'Different lab'] },
  release: { earlier: ['', 'Released earlier'], later: ['', 'Released later'], same: ['', 'Same release day'] },
} as const;
const MISSING_TEXT = { index: 'Index not recorded', cost: 'Cost not recorded', speed: 'Speed not recorded', lab: 'Lab not recorded', release: 'Release date not recorded' };
type FeedbackKey = keyof typeof FEEDBACK_TEXT;
const FEEDBACK_KEYS: FeedbackKey[] = ['index', 'cost', 'speed', 'lab', 'release'];
const chip = (feedback: GuessFeedback, key: FeedbackKey): { arrow: string; text: string; known: boolean } => {
  const value = feedback[key];
  if (value === null) return { arrow: '', text: MISSING_TEXT[key], known: false };
  const [arrow, text] = (FEEDBACK_TEXT[key] as Record<string, readonly [string, string]>)[value];
  return { arrow, text, known: true };
};
/** One sentence for the live region, in the same words as the chips. */
const sentence = (guess: GameCandidate, feedback: GuessFeedback) => {
  const parts = FEEDBACK_KEYS.map((key) => chip(feedback, key)).filter((item) => item.known).map((item) => item.text.toLowerCase());
  return `Not ${guess.family}. The mystery model: ${parts.join(', ')}.`;
};

function winLine(count: number): string {
  if (count === 1) return 'First guess. Either you read charts for a living or that was a very good hunch.';
  if (count <= 3) return `Got it in ${count}. You know where the models sit.`;
  return `Got it in ${count}. The clues earned their keep.`;
}

export default function GuessGame({ data, day, url }: Props) {
  const byKey = useMemo(() => new Map(data.candidates.map((candidate) => [candidate.key, candidate])), [data.candidates]);
  // This component only renders in the browser once the day is known, so storage is safe to read here.
  const mystery = useMemo(() => pinnedAnswer(`answer:guess:${day}`, dailyPick(data.candidates, day, 'guess'), byKey), [data.candidates, day, byKey]);
  const [keys, setKeys] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<GameStats | null>(null);
  const [justEnded, setJustEnded] = useState(false);

  useEffect(() => {
    setKeys(readJson(`guess:${day}`, [], isKeyList).filter((key) => byKey.has(key)).slice(0, MAX_GUESSES));
    setStats(parseStats(readStore('stats:guess')));
    setLoaded(true);
  }, [day, byKey]);

  const guesses = keys.map((key) => byKey.get(key)!).filter(Boolean);
  const won = Boolean(mystery && keys.includes(mystery.key));
  const misses = guesses.filter((guess) => guess.key !== mystery?.key).length;
  const over = won || guesses.length >= MAX_GUESSES;
  const clues = mystery ? cluesFor(mystery) : [];
  const shown = over ? clues.length : revealedClueCount(misses, clues.length);

  useEffect(() => {
    if (!loaded || !over) return;
    const next = recordResult(parseStats(readStore('stats:guess')), day, won, guesses.length);
    writeStore('stats:guess', JSON.stringify(next));
    setStats(next);
  }, [loaded, over, won, day, guesses.length]);

  if (!mystery) return <p className="play-empty">No puzzle today: the build had no measured models to choose from.</p>;

  const guess = (candidate: GameCandidate) => {
    if (over || keys.includes(candidate.key)) return;
    const next = [...keys, candidate.key];
    setKeys(next);
    writeStore(`guess:${day}`, JSON.stringify(next));
    if (candidate.key === mystery.key || next.length >= MAX_GUESSES) setJustEnded(true);
    if (candidate.key === mystery.key) { setMessage(`Correct. It is ${mystery.family}. ${winLine(next.length)}`); return; }
    const missCount = next.filter((key) => key !== mystery.key).length;
    const clue = clues[missCount - 1];
    const lost = next.length >= MAX_GUESSES;
    setMessage(`${sentence(candidate, compareGuess(candidate, mystery))}${lost ? ` Out of guesses. It was ${mystery.family}.` : clue ? ` New clue. ${clue.label}: ${clue.value}.` : ''}`);
  };

  const axis = AXIS_LABELS[data.axis];
  const guessIds = new Set(guesses.map((item) => item.pointId));
  const marks: ChartMark[] = [
    ...guesses.filter((item) => item.key !== mystery.key).map((item): ChartMark => ({ id: item.pointId, x: item.cost, y: item.index, label: item.family, tone: 'guess' })),
    over ? { id: 'answer', x: mystery.cost, y: mystery.index, label: mystery.family, tone: 'answer' } : { id: 'mystery', x: mystery.cost, y: mystery.index, tone: 'mystery' },
  ];
  const background = data.points.filter((point) => point.id !== mystery.pointId && !guessIds.has(point.id));
  const where = `Index ${indexRange(mystery.index)}, ${axis.short} ${costRange(mystery.cost) ?? 'not recorded'}`;
  const chartLabel = over
    ? `${data.points.length} models plotted by ${axis.short} and AA Intelligence Index. The answer, ${mystery.family}, is highlighted at Index ${formatIndex(mystery.index)} and ${formatMoney(mystery.cost)} ${axis.unit}.`
    : `${data.points.length} models plotted by ${axis.short} and AA Intelligence Index, all unlabelled. The mystery model is the copper point: ${where}.${guesses.length ? ` Your guesses are labelled: ${guesses.map((item) => item.family).join(', ')}.` : ''}`;
  const outcomes = guesses.map((item) => item.key === mystery.key);

  return <div className="play-game">
    <div className="play-stage">
      <GameChart domain={data.points} background={background} marks={marks} axis={data.axis} indexVersion={data.indexVersion} label={chartLabel} />
      <p className="play-chart-note">{over ? <>The copper point is <strong>{mystery.family}</strong>.</> : <>Find the copper point. It sits at Index {indexRange(mystery.index)} and {costRange(mystery.cost)} {axis.unit}.</>}</p>
    </div>

    <div className="play-side">
      {over ? <Reveal focus={justEnded} mystery={mystery} won={won} count={guesses.length} axisUnit={axis.unit} stats={stats}
        result={guessResultText(puzzleNumber(day), outcomes, url)} /> : <>
        <FamilySearch candidates={data.candidates} exclude={keys} disabled={over || !loaded} onGuess={guess} onProblem={setMessage} />
        <p className="play-remaining"><span>{MAX_GUESSES - guesses.length}</span> of {MAX_GUESSES} guesses left</p>
      </>}
      <p className="sr-only" aria-live="polite" role="status">{message}</p>
      {!over && message ? <p className="play-message" aria-hidden="true">{message}</p> : null}

      <section className="play-clues" aria-labelledby="play-clues-heading">
        <h2 id="play-clues-heading">Clues</h2>
        <ol>
          {clues.map((clue, index) => index < shown
            ? <li key={clue.id} className="is-open"><span>{clue.label}</span><strong>{clue.value}</strong></li>
            : <li key={clue.id} className="is-locked"><span>Clue {index + 1}</span><em>Unlocks after miss {index + 1}</em></li>)}
        </ol>
      </section>

      {guesses.length ? <section className="play-guesses" aria-labelledby="play-guesses-heading">
        <h2 id="play-guesses-heading">Your guesses</h2>
        <ol>
          {guesses.map((item, index) => {
            const feedback = compareGuess(item, mystery);
            return <li key={item.key} className={feedback.correct ? 'is-correct' : undefined}>
              <div className="play-guess-head">
                <span className="play-guess-number">{index + 1}</span>
                <strong>{item.family}</strong>
                <span className="play-guess-values">{formatIndex(item.index)} · {formatMoney(item.cost)}</span>
              </div>
              {feedback.correct ? <p className="play-guess-correct">That’s the one.</p> :
                <ul className="play-chips" aria-label={`How the mystery compares with ${item.family}`}>
                  {FEEDBACK_KEYS.map((key) => {
                    const value = chip(feedback, key);
                    return <li key={key} className={value.known ? undefined : 'is-missing'}>{value.arrow ? <b aria-hidden="true">{value.arrow}</b> : null}{value.text}</li>;
                  })}
                </ul>}
            </li>;
          })}
        </ol>
        {misses ? <p className="play-legend">Arrows describe the mystery compared with your guess: ↑ ↓ on the Index, → ← on {axis.short}.</p> : null}
      </section> : null}
    </div>
  </div>;
}

function Reveal({ focus, mystery, won, count, axisUnit, stats, result }: { focus: boolean; mystery: GameCandidate; won: boolean; count: number; axisUnit: string; stats: GameStats | null; result: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Keyboard users land on the answer when the game ends (the search box they were in is gone).
  useEffect(() => { if (focus) heading.current?.focus(); }, [focus]);
  const released = formatDay(mystery.release);
  const best = stats ? Math.max(1, ...stats.distribution) : 1;
  return <section className="play-reveal" aria-labelledby="play-reveal-heading">
    <p className="play-reveal-kicker">{won ? winLine(count) : 'Six misses. The dot keeps its secret no longer.'}</p>
    <h2 id="play-reveal-heading" ref={heading} tabIndex={-1}>{mystery.family}</h2>
    <p className="play-reveal-lab">{mystery.provider} · measured as {mystery.name}</p>
    <dl className="play-readouts">
      <div><dt>AA Index</dt><dd>{formatIndex(mystery.index)}</dd></div>
      <div><dt>Cost</dt><dd>{formatMoney(mystery.cost)} <span>{axisUnit}</span></dd></div>
      {mystery.blendedPrice !== null ? <div><dt>Blended price</dt><dd>{formatMoney(mystery.blendedPrice)} <span>per 1M</span></dd></div> : null}
      {mystery.speed !== null ? <div><dt>Speed</dt><dd>{mystery.speed.toFixed(0)} <span>tokens/s</span></dd></div> : null}
      {released ? <div><dt>Released</dt><dd>{released}</dd></div> : null}
    </dl>
    <ResultActions result={result} modelPath={mystery.path} modelName={mystery.family} />
    {stats && stats.played ? <div className="play-stats">
      <dl>
        <div><dt>Played</dt><dd>{stats.played}</dd></div>
        <div><dt>Won</dt><dd>{Math.round((stats.wins / stats.played) * 100)}%</dd></div>
        <div><dt>Streak</dt><dd>{stats.currentStreak}</dd></div>
        <div><dt>Best streak</dt><dd>{stats.maxStreak}</dd></div>
      </dl>
      <table className="play-distribution">
        <caption>Wins by guess number</caption>
        <tbody>{stats.distribution.map((value, index) => <tr key={index} className={won && index === count - 1 ? 'is-today' : undefined}>
          <th scope="row">{index + 1}</th>
          <td><span style={{ width: `${(value / best) * 100}%` }} /></td>
          <td className="num">{value}</td>
        </tr>)}</tbody>
      </table>
    </div> : null}
  </section>;
}
