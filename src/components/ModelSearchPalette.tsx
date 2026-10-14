import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { readModelSearchIndex, type ModelSearchEntry } from '@/lib/model-search-index';

const MAX_RESULTS = 40;

/**
 * Jump to any of the tracked model pages from anywhere on the site.
 *
 * The site has one page per model, but the only way to reach them was the
 * models index or a link. The index is fetched once, on first open, so the
 * document does not carry 677 rows it will usually not need.
 */
export default function ModelSearchPalette() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ModelSearchEntry[]>([]);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const requested = useRef(false);
  const isOpen = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const changeOpen = useCallback((next: boolean) => {
    if (next && !isOpen.current) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    isOpen.current = next;
    setOpen(next);
  }, []);

  const load = useCallback(async () => {
    if (requested.current) return;
    requested.current = true;
    setState('loading');
    try {
      const response = await fetch('/api/model-index.json');
      if (!response.ok) throw new Error(String(response.status));
      const data: unknown = await response.json();
      setEntries(readModelSearchIndex(data));
      setState('ready');
    } catch {
      requested.current = false;
      setState('error');
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        changeOpen(!isOpen.current);
      }
    };
    document.addEventListener('keydown', onKey);
    const onOpen = () => changeOpen(true);
    window.addEventListener('ai-stats:open-model-search', onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('ai-stats:open-model-search', onOpen);
    };
  }, [changeOpen]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pool = term
      ? entries.filter((entry) => entry.n.toLowerCase().includes(term) || entry.p.toLowerCase().includes(term))
      : entries;
    return pool.slice(0, MAX_RESULTS);
  }, [entries, query]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={changeOpen}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        const target = opener.current?.isConnected && opener.current !== document.body
          ? opener.current : document.getElementById('model-search-open');
        target?.focus();
      }}
      title="Find a model"
      description="Search models and providers."
    >
      {/* This CommandDialog supplies only the dialog shell, so the cmdk
          provider has to be added here. Filtering is done above and capped,
          so cmdk's own scoring is switched off. */}
      <Command shouldFilter={false}>
      <CommandInput
        aria-label="Search models or providers"
        placeholder="Search models or providers"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {state === 'loading' && <CommandEmpty>Loading the model list.</CommandEmpty>}
        {state === 'error' && <CommandEmpty>The model list could not be loaded. <button type="button" onClick={() => void load()}>Try again</button></CommandEmpty>}
        {state === 'ready' && results.length === 0 && <CommandEmpty>No model or provider matches that search.</CommandEmpty>}
        {results.length > 0 && (
          <CommandGroup heading={query.trim() ? `${results.length} shown` : `${entries.length} catalog entries`}>
            {results.map((entry) => (
              <CommandItem
                key={entry.u}
                value={`${entry.u} ${entry.n} ${entry.p}`}
                onSelect={() => {
                  window.location.href = entry.u;
                }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{entry.n}</span>
                  <span className="text-muted-foreground truncate text-xs">{entry.p}</span>
                </span>
                {entry.i !== null && (
                  <span className="text-muted-foreground ml-auto shrink-0 font-mono text-xs whitespace-nowrap">AA {entry.i.toFixed(1)}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
