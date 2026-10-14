import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ModelSelector from '../components/compare/ModelSelector';
import type { ExplorerModel } from './compare-series';

const model = (id: string, name: string, family: string): ExplorerModel => ({
  id, name, family, provider: 'Anthropic', source: 'aa', sourceModelId: id,
  current: true, reasoning: 'low', intelligence: 50,
});

const props = (overrides: Partial<Parameters<typeof ModelSelector>[0]> = {}): Parameters<typeof ModelSelector>[0] => ({
  models: [model('match', 'Claude Opus 5.5 (Low)', 'Claude Opus 5.5'), model('match-high', 'Claude Opus 5.5 (High)', 'Claude Opus 5.5'), model('other', 'GPT example', 'GPT example')],
  selected: [], suggestedIds: [], includeHistory: false, chart: 'benchmark', metricId: 'aa_intelligence_index',
  onHistory: () => {}, reasoningEfforts: [], onReasoning: () => {}, onToggle: () => {}, onToggleFamily: () => {},
  onReset: () => {}, onSuggested: () => {}, presets: [], onPreset: () => {}, query: '', onQuery: () => {},
  ...overrides,
});

test('search-first picker renders only matching family results and preserves selected exact IDs', () => {
  const html = renderToStaticMarkup(createElement(ModelSelector, props({ query: 'Opus 5.5 (Low)', selected: ['match'] })));
  expect(html).toContain('Search results');
  expect(html).toContain('Claude Opus 5.5');
  expect(html).not.toContain('GPT example');
  expect(html).toContain('1 / 100 records');
  expect(html).toContain('checked=""');
  expect(html).toContain('Clear search');
});

test('unfiltered family picker bounds the result window and exposes page navigation', () => {
  const models = Array.from({ length: 14 }, (_, index) => model(`m${index}`, `Model ${index}`, `Family ${index}`));
  const html = renderToStaticMarkup(createElement(ModelSelector, props({ models })));
  expect(html).toContain('1 / 2');
  expect(html).toContain('Next</button>');
  expect(html).toContain('Family 0');
  expect(html).toContain('Family 11');
  expect(html).not.toContain('Family 12');
});
