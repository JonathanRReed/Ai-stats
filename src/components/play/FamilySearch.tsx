import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { exactCandidate, searchCandidates, type GameCandidate } from '../../lib/daily-game';

type Props = {
  candidates: GameCandidate[];
  exclude: string[];
  disabled: boolean;
  onGuess: (candidate: GameCandidate) => void;
  onProblem: (message: string) => void;
};

/** ARIA 1.2 combobox: type, arrow through suggestions, Enter to guess, Escape to close. */
export default function FamilySearch({ candidates, exclude, disabled, onGuess, onProblem }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = useMemo(() => searchCandidates(candidates, query, exclude, 8), [candidates, query, exclude]);
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const submit = (candidate: GameCandidate | null) => {
    const chosen = candidate ?? (active >= 0 ? options[active] : null) ?? exactCandidate(candidates, query) ?? (options.length === 1 ? options[0] : null);
    if (!chosen) {
      onProblem(query.trim() ? `No single match for “${query.trim()}”. Pick a model from the list.` : 'Type a model name first.');
      setOpen(Boolean(query.trim()));
      return;
    }
    if (exclude.includes(chosen.key)) { onProblem(`You already guessed ${chosen.family}.`); return; }
    onGuess(chosen);
    setQuery('');
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (options.length ? (current + 1) % options.length : -1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (options.length ? (current <= 0 ? options.length - 1 : current - 1) : -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      submit(null);
    } else if (event.key === 'Escape') {
      if (open) { event.preventDefault(); setOpen(false); setActive(-1); }
    }
  };
  const expanded = open && options.length > 0 && !disabled;

  return <form className="play-search" onSubmit={(event) => { event.preventDefault(); submit(null); }}>
    <label htmlFor={`${id}-input`}>Your guess</label>
    <div className="play-search-row">
      <div className="play-combo">
        <input ref={input} id={`${id}-input`} type="text" role="combobox" autoComplete="off" spellCheck={false}
          aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          placeholder={disabled ? 'Game over for today' : 'Type a model name'} value={query} disabled={disabled}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown} />
        <ul id={listId} role="listbox" aria-label="Matching models" className="play-options" hidden={!expanded}>
          {options.map((option, index) => <li key={option.key} id={optionId(index)} role="option" aria-selected={index === active}
            onMouseDown={(event) => { event.preventDefault(); submit(option); }} onMouseEnter={() => setActive(index)}>
            <span>{option.family}</span><small>{option.provider}</small>
          </li>)}
        </ul>
      </div>
      <button type="submit" className="eco-btn eco-btn-primary play-guess-button" disabled={disabled}>Guess</button>
    </div>
  </form>;
}
