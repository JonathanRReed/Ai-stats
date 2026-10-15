import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { EXPLORER_SOURCE_LABELS, type ExplorerModel } from '../../lib/compare-series';
import { compareCatalogScope, familySelectionState, groupCompareFamilies, type CompareFamily, type FamilyBrowseSort } from '../../lib/compare-families';
import { compareFamilyPage } from '../../lib/compare-family-pages';
import { familyColor } from '../../lib/family-color';
import type { ComparePreset } from '../../lib/compare-presets';

type Props = {
  models: ExplorerModel[];
  selected: string[];
  suggestedIds: string[];
  includeHistory: boolean;
  chart: string;
  metricId: string;
  onHistory: (value: boolean) => void;
  reasoningEfforts: string[];
  onReasoning: (value: string) => void;
  onToggle: (id: string) => void;
  onToggleFamily: (ids: string[], checked: boolean) => void;
  onReset: () => void;
  onSuggested: () => void;
  presets: ComparePreset[];
  onPreset: (preset: ComparePreset) => void;
  query: string;
  onQuery: (value: string) => void;
  selectionNotice?: string;
  browseOrder?: readonly string[];
};

const reasoningLevels = ['none', 'low', 'medium', 'high', 'xhigh', 'minimal', 'max', 'unknown'];

export default function ModelSelector({
  models,
  selected,
  suggestedIds,
  includeHistory,
  chart,
  metricId,
  onHistory,
  reasoningEfforts,
  onReasoning,
  onToggle,
  onToggleFamily,
  onReset,
  onSuggested,
  presets,
  onPreset,
  query,
  onQuery,
  selectionNotice,
  browseOrder,
}: Props) {
  const resultsId = useId();
  const [page, setPage] = useState(0);
  const [browseSort, setBrowseSort] = useState<FamilyBrowseSort>('recommend');
  const resultsRef = useRef<HTMLDivElement>(null);
  const [allCatalog, setAllCatalog] = useState(false);
  const selectedKey = JSON.stringify(selected);
  const suggestedKey = JSON.stringify(suggestedIds);
  const stableSelected = useMemo(() => selected, [selectedKey]);
  const stableSuggestedIds = useMemo(() => suggestedIds, [suggestedKey]);
  const selectedSet = useMemo(() => new Set(stableSelected), [stableSelected]);
  const searchable = useMemo(
    () => compareCatalogScope(models, chart, metricId, stableSelected, allCatalog).filter(
      model => includeHistory || model.current !== false || selectedSet.has(model.id),
    ),
    [models, chart, metricId, stableSelected, allCatalog, includeHistory, selectedSet],
  );
  const orderOptions = useMemo(
    () => ({ sort: browseSort, browseOrder, chart, metricId }),
    [browseSort, browseOrder, chart, metricId],
  );
  const groups = useMemo(
    () => groupCompareFamilies(searchable, stableSelected, query, stableSuggestedIds, orderOptions),
    [searchable, stableSelected, query, stableSuggestedIds, orderOptions],
  );
  const allGroups = useMemo(
    () => groupCompareFamilies(searchable, stableSelected, '', stableSuggestedIds, orderOptions),
    [searchable, stableSelected, stableSuggestedIds, orderOptions],
  );
  const hasQuery = query.trim().length > 0;
  const chosen = allGroups.filter(group => group.selectedIds.length > 0);
  const suggested = groups.filter(group => group.selectedIds.length === 0 && group.suggested);
  const more = groups.filter(group => group.selectedIds.length === 0 && !group.suggested);
  const matches = hasQuery ? groups : more;
  const { page: currentPage, pageCount, items: shownMatches } = compareFamilyPage(matches, page, 12);
  const hasAa = searchable.some(model => model.source === 'aa');

  useEffect(() => {
    setPage(0);
    if (resultsRef.current) resultsRef.current.scrollTop = 0;
  }, [query, allCatalog, chart, metricId, browseSort]);

  const atLimit = selected.length >= 100;
  const groupRow = (group: CompareFamily) => {
    const addingCount = group.records.filter(model => !selectedSet.has(model.id)).length;
    const selectionState = familySelectionState(group);
    const wouldExceedLimit = selectionState !== true && selected.length + addingCount > 100;
    const nameCounts = new Map<string, number>();
    group.records.forEach(model => nameCounts.set(model.name, (nameCounts.get(model.name) ?? 0) + 1));

    return (
      <div className="family-entry" key={group.key}>
        <button
          type="button"
          role="checkbox"
          aria-checked={selectionState}
          className="family-row"
          disabled={selectionState !== true && wouldExceedLimit}
          title={wouldExceedLimit ? 'This family would exceed the 100-record selection limit' : undefined}
          data-selected={group.selectedIds.length > 0}
          onClick={() => onToggleFamily(group.records.map(model => model.id), selectionState !== true)}
        >
          <span
            className="family-color-dot"
            style={{ '--family-color': familyColor(group.family) } as React.CSSProperties}
            aria-hidden="true"
          />
          <span className="family-row-copy">
            <strong>{group.family}</strong>
            <small>{group.provider} · {EXPLORER_SOURCE_LABELS[group.source]}</small>
          </span>
          {group.selectedIds.length > 0 && group.selectedIds.length < group.records.length
            ? <span className="family-partial">{group.selectedIds.length}/{group.records.length}</span>
            : null}
        </button>
        {group.records.length > 1
          ? <details className="family-variants">
            <summary aria-label={`Choose exact ${group.family} variants`}>Variants · {group.records.length}</summary>
            <div className="family-variant-list">
              {group.records.map(model => (
                <label key={model.id} className="family-variant">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(model.id)}
                    disabled={!selectedSet.has(model.id) && atLimit}
                    aria-label={nameCounts.get(model.name)! > 1
                      ? `Select ${model.name}, ${group.provider}, ${EXPLORER_SOURCE_LABELS[group.source]}, record ${model.sourceModelId ?? model.id}`
                      : undefined}
                    onChange={() => onToggle(model.id)}
                  />
                  <span title={nameCounts.get(model.name)! > 1 ? `${model.name} · ${model.sourceModelId ?? model.id}` : undefined}>
                    {model.name}
                  </span>
                  <small>
                    {model.reasoning === 'unknown' ? 'Reasoning not recorded' : model.reasoning}
                    {model.current === false ? ' · Historical' : ''}
                  </small>
                </label>
              ))}
            </div>
          </details>
          : null}
      </div>
    );
  };

  return (
    <aside className="model-selector family-rail" aria-label="Model families">
      <header className="family-rail-heading">
        <h2>Models</h2>
        <span aria-live="polite">{selected.length} / 100 records{atLimit ? ' · limit reached' : ''}</span>
      </header>
      <label className="family-search-label" htmlFor={`${resultsId}-search`}>
        Search models
        <input
          id={`${resultsId}-search`}
          type="search"
          placeholder="Search GPT, OpenAI, or a model"
          value={query}
          onChange={event => onQuery(event.target.value)}
          aria-controls={resultsId}
        />
      </label>
      <div className="family-browser-toolbar">
        <label className="family-search-label" htmlFor={`${resultsId}-sort`}>
          Browse order
          <select
            id={`${resultsId}-sort`}
            value={browseSort}
            onChange={event => setBrowseSort(event.target.value as FamilyBrowseSort)}
          >
            <option value="recommend">Recommended</option>
            <option value="alpha">Alphabetical</option>
          </select>
        </label>
        <details className="family-filter-options">
          <summary>Filters{reasoningEfforts.length ? ` · ${reasoningEfforts.length}` : ''}</summary>
          <div>
            <label className="family-search-label" htmlFor={`${resultsId}-scope`}>
              Browse records
              <select
                id={`${resultsId}-scope`}
                value={allCatalog ? 'all' : 'chart'}
                onChange={event => setAllCatalog(event.target.value === 'all')}
              >
                <option value="chart">Chart data</option>
                <option value="all">All catalog sources</option>
              </select>
            </label>
            {hasAa
              ? <fieldset className="reasoning-filters">
                <legend>Reasoning levels</legend>
                <button type="button" aria-pressed={!reasoningEfforts.length} onClick={() => onReasoning('all')}>All</button>
                {reasoningLevels
                  .filter(level => level !== 'unknown' || searchable.some(model => model.source === 'aa' && (model.reasoning ?? 'unknown') === 'unknown'))
                  .map(level => (
                    <button
                      type="button"
                      key={level}
                      aria-pressed={reasoningEfforts.includes(level)}
                      onClick={() => onReasoning(level)}
                    >
                      {level === 'none' ? 'No reasoning' : level}
                    </button>
                  ))}
              </fieldset>
              : null}
            <label className="history-toggle">
              <input type="checkbox" checked={includeHistory} onChange={event => onHistory(event.target.checked)} />
              Include historical records
            </label>
          </div>
        </details>
        {hasQuery
          ? <button type="button" className="rail-action" onClick={() => onQuery('')}>Clear search</button>
          : suggestedIds.length
            ? <button type="button" className="rail-action" onClick={onSuggested}>Use suggestions</button>
            : null}
      </div>
      <div className="family-results-scroll" ref={resultsRef} id={resultsId}>
        {hasQuery
          ? <section className="family-section" aria-label="Search results">
            <h3 role="status">{groups.length} {groups.length === 1 ? 'family' : 'families'} matching “{query}”</h3>
            {shownMatches.length
              ? shownMatches.map(groupRow)
              : <p className="family-empty">No matching models in this view. Try another name or change the source filter.</p>}
          </section>
          : <>
            {chosen.length
              ? <section className="family-section" aria-label="Selected families">
                <h3>Selected families <span>{chosen.length}</span></h3>
                {chosen.map(groupRow)}
              </section>
              : null}
            {suggested.length
              ? <section className="family-section" aria-label="Suggested families">
                <h3>Suggested families <span>{suggested.length}</span></h3>
                {suggested.map(groupRow)}
              </section>
              : null}
            {shownMatches.length
              ? <section className="family-section" aria-label="Browse families">
                <h3>Browse families <span>{more.length}</span></h3>
                {shownMatches.map(groupRow)}
              </section>
              : null}
          </>}
      </div>
      {pageCount > 1
        ? <nav className="family-pagination" aria-label="Model result pages">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => { setPage(currentPage - 1); if (resultsRef.current) resultsRef.current.scrollTop = 0; }}
          >Previous</button>
          <span>{currentPage + 1} / {pageCount}</span>
          <button
            type="button"
            disabled={currentPage + 1 >= pageCount}
            onClick={() => { setPage(currentPage + 1); if (resultsRef.current) resultsRef.current.scrollTop = 0; }}
          >Next</button>
        </nav>
        : null}
      {atLimit
        ? <p className="family-cap-notice" role="status">Selection limit reached. Remove a record before adding another.</p>
        : null}
      <footer className="family-rail-footer">
        <button type="button" onClick={onReset} disabled={!selected.length}>Clear selection</button>
        {presets.length
          ? <details className="rail-presets">
            <summary>Other starting points</summary>
            <div>{presets.map(preset => (
              <button type="button" key={preset.id} title={preset.description} onClick={() => onPreset(preset)}>
                {preset.label}
              </button>
            ))}</div>
          </details>
          : null}
      </footer>
      {selectionNotice ? <p className="family-selection-notice" role="status">{selectionNotice}</p> : null}
    </aside>
  );
}
