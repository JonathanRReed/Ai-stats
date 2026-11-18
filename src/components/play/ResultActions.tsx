import { useEffect, useState } from 'react';
import { formatCountdown, msUntilNextUtcDay } from '../../lib/daily-game';
import { copyText } from './play-utils';

type Props = { result: string; modelPath: string | null; modelName: string };

/** Copy result, model page link and the countdown to the next UTC puzzle. */
export default function ResultActions({ result, modelPath, modelName }: Props) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setRemaining(msUntilNextUtcDay(new Date()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const onCopy = async () => setCopy((await copyText(result)) ? 'copied' : 'failed');

  return <div className="play-result">
    <div className="play-result-actions">
      <button type="button" className="eco-btn eco-btn-primary" onClick={onCopy}>{copy === 'copied' ? 'Copied' : 'Copy result'}</button>
      {modelPath ? <a className="eco-btn eco-btn-secondary" href={modelPath}>Open the {modelName} page</a> : null}
    </div>
    <p className="sr-only" role="status" aria-live="polite">{copy === 'copied' ? 'Result copied to the clipboard.' : copy === 'failed' ? 'Copy did not work. The result text is shown below to copy by hand.' : ''}</p>
    {copy === 'failed' ? <textarea className="play-result-text" readOnly value={result} rows={3} aria-label="Result text" onFocus={(event) => event.currentTarget.select()} /> : null}
    <p className="play-result-preview">{result.split('\n')[0]}<span aria-hidden="true">{result.split('\n')[1]}</span></p>
    <p className="play-countdown">Next puzzle in <time>{remaining === null ? '--:--:--' : formatCountdown(remaining)}</time> <span>(00:00 UTC)</span></p>
  </div>;
}
