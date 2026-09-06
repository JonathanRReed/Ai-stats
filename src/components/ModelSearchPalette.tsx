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

type IndexEntry = { n: string; p: string; u: string; i: number | null };

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
  const [entries, setEntries] = useState<IndexEntry[]>([]);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const requested = useRef(false);

  const load = useCallback(async () => {
    if (requested.current) return;
    requested.current = true;
    setState('loading');
    try {
      const response = await fetch('/api/model-index.json');
      if (!response.ok) throw new Error(String(response.status));
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('unexpected shape');
      setEntries(data as IndexEntry[]);
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
        setOpen((value) => !value);
      }
    };
    document.addEventListener('keydown', onKey);
    const onOpen = () => setOpen(true);
    window.addEventListener('ai-stats:open-model-search', onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('ai-stats:open-model-search', onOpen);
    };
  }, []);

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
      onOpenChange={setOpen}
      title="Find a model"
      description="Search every tracked model and open its receipt page."
    >
      {/* This CommandDialog supplies only the dialog shell, so the cmdk
          provider has to be added here. Filtering is done above and capped,
          so cmdk's own scoring is switched off. */}
      <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search models or providers"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {state === 'loading' && <CommandEmpty>Loading the model list.</CommandEmpty>}
        {state === 'error' && <CommandEmpty>The model list could not be loaded. Close this and try again.</CommandEmpty>}
        {state === 'ready' && results.length === 0 && <CommandEmpty>No model or provider matches that search.</CommandEmpty>}
        {results.length > 0 && (
          <CommandGroup heading={query.trim() ? `${results.length} shown` : `${entries.length} models`}>
            {results.map((entry) => (
              <CommandItem
                key={entry.u}
                value={`${entry.n} ${entry.p}`}
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
