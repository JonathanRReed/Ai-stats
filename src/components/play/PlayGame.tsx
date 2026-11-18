import { useEffect, useState } from 'react';
import { AXIS_LABELS, dailyPick, puzzleNumber, utcDayIndex, type GameData } from '../../lib/daily-game';
import GameChart from './GameChart';
import GuessGame from './GuessGame';
import PlaceGame from './PlaceGame';
import { formatIndex, formatMoney, recalledAnswer } from './play-utils';

import '../../styles/play.css';

type Mode = 'guess' | 'place';
type Props = { data: GameData; url: string };

/** The /play island. Everything that depends on today's date renders only after mount, so server HTML never disagrees with the client. */
export default function PlayGame({ data, url }: Props) {
  const [day, setDay] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('guess');
  const placeAvailable = data.placeable.length > 0;

  useEffect(() => {
    setDay(utcDayIndex(new Date()));
    if (placeAvailable && window.location.hash === '#place') setMode('place');
  }, [placeAvailable]);
  const choose = (next: Mode) => {
    setMode(next);
    try { window.history.replaceState(null, '', next === 'place' ? '#place' : window.location.pathname + window.location.search); } catch { /* history unavailable */ }
  };

  const candidatesByKey = new Map(data.candidates.map((candidate) => [candidate.key, candidate]));
  const yesterday = day === null || day < 1 ? null : recalledAnswer(`answer:guess:${day - 1}`, dailyPick(data.candidates, day - 1, 'guess'), candidatesByKey);
  const yesterdayPlace = day === null || day < 1 ? null : recalledAnswer(`answer:place:${day - 1}`, dailyPick(data.candidates.filter((candidate) => data.placeable.includes(candidate.key)), day - 1, 'place'), candidatesByKey);
  const axis = AXIS_LABELS[data.axis];

  return <div className="play-root">
    <div className="play-toolbar">
      {placeAvailable ? <div className="play-modes" role="group" aria-label="Game mode">
        <button type="button" aria-pressed={mode === 'guess'} onClick={() => choose('guess')}>Guess the model</button>
        <button type="button" aria-pressed={mode === 'place'} onClick={() => choose('place')}>Place the release</button>
      </div> : null}
      <p className="play-puzzle-number">{day === null ? 'Puzzle' : `Puzzle #${puzzleNumber(day)}`}</p>
    </div>

    {day === null ? <div className="play-game" aria-busy="true">
      <div className="play-stage">
        <GameChart domain={data.points} background={data.points} marks={[]} axis={data.axis} indexVersion={data.indexVersion}
          label={`${data.points.length} models plotted by ${axis.short} and AA Intelligence Index. Today's puzzle loads with JavaScript.`} />
      </div>
      <div className="play-side"><p className="play-loading">Loading today’s puzzle…</p></div>
    </div> : mode === 'place' && placeAvailable ? <PlaceGame data={data} day={day} url={url} /> : <GuessGame data={data} day={day} url={url} />}

    {yesterday ? <aside className="play-yesterday" aria-label="Yesterday's answers">
      <p><span>Yesterday’s model</span>{' '}
        {yesterday.path ? <a href={yesterday.path}>{yesterday.family}</a> : <strong>{yesterday.family}</strong>}
        <span className="play-num"> · Index {formatIndex(yesterday.index)} · {formatMoney(yesterday.cost)} {axis.unit}</span></p>
      {yesterdayPlace ? <p><span>Yesterday’s release</span>{' '}
        {yesterdayPlace.path ? <a href={yesterdayPlace.path}>{yesterdayPlace.family}</a> : <strong>{yesterdayPlace.family}</strong>}
        <span className="play-num"> · landed at Index {formatIndex(yesterdayPlace.index)}</span></p> : null}
    </aside> : null}
  </div>;
}
