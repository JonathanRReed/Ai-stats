/**
 * Pure builders for the /market page. Every join here is an exact identity match on
 * keys the sources themselves publish; nothing is matched by name.
 *
 * - Usage versus score joins an AA model page record to OpenRouter only through the
 *   reviewed OpenRouter binding the record already carries (catalog.openRouterId), then
 *   to the daily usage dataset through that OpenRouter model's own permaslug.
 * - Route prices compare two OpenRouter observations of the same OpenRouter model id.
 * - Latency versus speed uses two Artificial Analysis medians from the same record.
 */
import type {ModelPageRecord} from './model-pages';
import type {UsageSnapshot} from './openrouter-usage';
import {modelDisplayFacets} from './compare-catalog';
import {CHANGES_PATH, MARKET_PATH} from './site-routes';

/** The routes this lane adds. The lead wires nav, sitemap and cross-links from this list. */
export const marketLaneRoutes = (): {path: string; title: string; kind: 'page' | 'feed'}[] => [
  {path: MARKET_PATH, title: 'Market signals', kind: 'page'},
  {path: CHANGES_PATH, title: 'What changed', kind: 'page'},
  {path: `${CHANGES_PATH}.xml`, title: 'What changed (Atom feed)', kind: 'feed'},
];

export type MarketRecord = Pick<ModelPageRecord, 'id' | 'name' | 'provider' | 'path' | 'aaSlug' | 'lastSeen' | 'aaEvidenceNote' | 'indexes' | 'speed'> & {
  catalog: Pick<ModelPageRecord['catalog'], 'openRouterId'>;
};

const metricValue = (group: {key: string; value: number | null}[], key: string): number | null => {
  const value = group.find((metric) => metric.key === key)?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const aaSourceUrl = (record: Pick<MarketRecord, 'aaSlug'>): string =>
  record.aaSlug ? `https://artificialanalysis.ai/models/${encodeURIComponent(record.aaSlug)}` : 'https://artificialanalysis.ai/';

// ---------------------------------------------------------------------------
// 1. Usage versus score
// ---------------------------------------------------------------------------

export type UsageTotal = {permaslug: string; tokens: number; daysListed: number};

/** Sum each model's daily token buckets across the snapshot window. "other" is not a model. */
export function usageTotals(snapshot: Pick<UsageSnapshot, 'rows'>): Map<string, UsageTotal> {
  const totals = new Map<string, {tokens: bigint; days: Set<string>}>();
  for (const row of snapshot.rows) {
    if (row.modelPermaslug === 'other') continue;
    const entry = totals.get(row.modelPermaslug) ?? {tokens: 0n, days: new Set<string>()};
    entry.tokens += BigInt(row.totalTokens);
    entry.days.add(row.date);
    totals.set(row.modelPermaslug, entry);
  }
  return new Map([...totals].map(([permaslug, entry]) => [permaslug, {permaslug, tokens: Number(entry.tokens), daysListed: entry.days.size}]));
}

export type OpenRouterCatalogRow = {openrouter_id: string; canonical_slug?: string | null; name?: string | null};

export type UsageScorePoint = {
  id: string; name: string; provider: string; path: string; family: string; reasoning: string;
  openRouterId: string; permaslug: string; tokens: number; daysListed: number;
  intelligenceIndex: number; observedAt: string | null; sourceUrl: string;
};

export type UsageScoreExclusion = 'no-openrouter-binding' | 'not-in-usage-dataset';

export type UsageScoreResult = {
  points: UsageScorePoint[];
  scoredModels: number;
  usageModels: number;
  excluded: Record<UsageScoreExclusion, number>;
  window: {startDate: string; endDate: string; asOf: string; missingDays: number} | null;
};

/**
 * Exact joins only. A record joins usage when its reviewed OpenRouter id, or that
 * OpenRouter model's canonical permaslug, is literally a key in the usage dataset.
 */
export function buildUsageScore(records: MarketRecord[], snapshot: UsageSnapshot | null, catalog: OpenRouterCatalogRow[]): UsageScoreResult {
  const scored = records.filter((record) => metricValue(record.indexes, 'aa_intelligence_index') !== null);
  const totals = snapshot ? usageTotals(snapshot) : new Map<string, UsageTotal>();
  const permaslugs = new Map(catalog.filter((row) => row.canonical_slug).map((row) => [row.openrouter_id, row.canonical_slug as string]));
  const excluded: Record<UsageScoreExclusion, number> = {'no-openrouter-binding': 0, 'not-in-usage-dataset': 0};
  const points: UsageScorePoint[] = [];
  for (const record of scored) {
    const openRouterId = record.catalog.openRouterId;
    if (!openRouterId) { excluded['no-openrouter-binding']++; continue; }
    const candidates = [permaslugs.get(openRouterId), openRouterId].filter((key): key is string => Boolean(key));
    const usage = candidates.map((key) => totals.get(key)).find((value): value is UsageTotal => value !== undefined);
    if (!usage || usage.tokens <= 0) { excluded['not-in-usage-dataset']++; continue; }
    const facets = modelDisplayFacets(record.name);
    points.push({
      id: record.id, name: record.name, provider: record.provider, path: record.path, family: facets.family, reasoning: facets.reasoning,
      openRouterId, permaslug: usage.permaslug, tokens: usage.tokens, daysListed: usage.daysListed,
      intelligenceIndex: metricValue(record.indexes, 'aa_intelligence_index') as number,
      observedAt: record.lastSeen, sourceUrl: aaSourceUrl(record),
    });
  }
  points.sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name));
  return {
    points, scoredModels: scored.length, usageModels: totals.size, excluded,
    window: snapshot ? {startDate: snapshot.startDate, endDate: snapshot.endDate, asOf: snapshot.asOf, missingDays: snapshot.missingDays.length} : null,
  };
}

// ---------------------------------------------------------------------------
// 2. Route prices
// ---------------------------------------------------------------------------

export type RouteCatalogRow = OpenRouterCatalogRow & {
  prompt_price_1m?: number | null; completion_price_1m?: number | null; fetched_at?: string | null; author_slug?: string | null;
};
export type RouteSummaryRow = {
  openrouter_id: string; provider_count?: number | null; providers?: string[];
  min_prompt_price_1m?: number | null; min_completion_price_1m?: number | null; fetched_at?: string | null;
};

export type PricePair = {list: number | null; cheapest: number | null; gap: number | null};

export type RoutePriceRow = {
  openRouterId: string; name: string; lab: string; family: string;
  input: PricePair; output: PricePair;
  /** Larger of the two relative gaps; the sort key. */
  sortGap: number;
  providerCount: number | null; providers: string[];
  listFetchedAt: string | null; routeFetchedAt: string | null;
  path: string | null; openRouterUrl: string;
};

export type RoutePriceResult = {rows: RoutePriceRow[]; summaries: number; withoutPair: number};

const price = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** Relative saving of the cheapest route against the list price. Undefined for a missing or zero list price. */
export const relativeGap = (list: number | null, cheapest: number | null): number | null =>
  list === null || cheapest === null || list <= 0 ? null : (list - cheapest) / list;

const pair = (list: unknown, cheapest: unknown): PricePair => {
  const l = price(list), c = price(cheapest);
  return {list: l, cheapest: c, gap: relativeGap(l, c)};
};

const openRouterDisplayName = (name: string | null | undefined, id: string): string => {
  const value = (name ?? '').trim();
  return value ? value.replace(/^[^:]{1,40}:\s+/, '') : id;
};

/** One row per OpenRouter model with a list price and a cheapest-route price for the same token direction. */
export function buildRoutePrices(catalog: RouteCatalogRow[], summaries: RouteSummaryRow[], records: Pick<MarketRecord, 'path' | 'catalog'>[]): RoutePriceResult {
  const byId = new Map(catalog.map((row) => [row.openrouter_id, row]));
  const pages = new Map<string, string>();
  for (const record of records) if (record.catalog.openRouterId) pages.set(record.catalog.openRouterId, record.path);
  const rows: RoutePriceRow[] = [];
  let withoutPair = 0;
  for (const summary of summaries) {
    const listing = byId.get(summary.openrouter_id);
    const input = pair(listing?.prompt_price_1m, summary.min_prompt_price_1m);
    const output = pair(listing?.completion_price_1m, summary.min_completion_price_1m);
    const complete = (value: PricePair) => value.list !== null && value.cheapest !== null;
    if (!listing || (!complete(input) && !complete(output))) { withoutPair++; continue; }
    const name = openRouterDisplayName(listing.name, summary.openrouter_id);
    const gaps = [input.gap, output.gap].filter((gap): gap is number => gap !== null);
    rows.push({
      openRouterId: summary.openrouter_id, name,
      lab: listing.author_slug ?? summary.openrouter_id.split('/')[0] ?? 'Unknown',
      family: modelDisplayFacets(name).family,
      input, output, sortGap: gaps.length ? Math.max(...gaps) : Number.NEGATIVE_INFINITY,
      providerCount: typeof summary.provider_count === 'number' ? summary.provider_count : null,
      providers: summary.providers ?? [],
      listFetchedAt: listing.fetched_at ?? null, routeFetchedAt: summary.fetched_at ?? null,
      path: pages.get(summary.openrouter_id) ?? null,
      openRouterUrl: `https://openrouter.ai/${summary.openrouter_id}`,
    });
  }
  rows.sort((a, b) => b.sortGap - a.sortGap || a.name.localeCompare(b.name) || a.openRouterId.localeCompare(b.openRouterId));
  return {rows, summaries: summaries.length, withoutPair};
}

/** Log-scale positions in percent for a shared price axis. Zero and missing prices have no position. */
export function logAxis(values: (number | null)[]): {min: number; max: number; position: (value: number | null) => number | null; ticks: {value: number; position: number}[]} | null {
  const positive = values.filter((value): value is number => value !== null && value > 0);
  if (!positive.length) return null;
  let low = Math.floor(Math.log10(Math.min(...positive))), high = Math.ceil(Math.log10(Math.max(...positive)));
  if (low === high) { low -= 1; high += 1; }
  const position = (value: number | null) => value === null || value <= 0 ? null : ((Math.log10(value) - low) / (high - low)) * 100;
  const ticks = [];
  for (let exponent = low; exponent <= high; exponent++) ticks.push({value: 10 ** exponent, position: ((exponent - low) / (high - low)) * 100});
  return {min: 10 ** low, max: 10 ** high, position, ticks};
}

// ---------------------------------------------------------------------------
// 3. Latency versus speed
// ---------------------------------------------------------------------------

export type LatencySpeedPoint = {
  id: string; name: string; provider: string; path: string; family: string; reasoning: string;
  ttft: number; speed: number; observedAt: string | null; sourceUrl: string; note: string;
};

export type LatencySpeedResult = {points: LatencySpeedPoint[]; missing: number; notes: string[]};

export function buildLatencySpeed(records: MarketRecord[]): LatencySpeedResult {
  const points: LatencySpeedPoint[] = [];
  let missing = 0;
  for (const record of records) {
    const ttft = metricValue(record.speed, 'median_time_to_first_token_seconds');
    const speed = metricValue(record.speed, 'median_output_tokens_per_second');
    if (ttft === null || speed === null || ttft <= 0 || speed <= 0) { missing++; continue; }
    const facets = modelDisplayFacets(record.name);
    points.push({id: record.id, name: record.name, provider: record.provider, path: record.path, family: facets.family, reasoning: facets.reasoning,
      ttft, speed, observedAt: record.lastSeen, sourceUrl: aaSourceUrl(record), note: record.aaEvidenceNote});
  }
  points.sort((a, b) => a.ttft - b.ttft || b.speed - a.speed || a.name.localeCompare(b.name));
  return {points, missing, notes: [...new Set(points.map((point) => point.note))]};
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

export type PageDataset = {id: string; name: string; description: string; isBasedOn: string[]; dateModified: string | null; variables: string[]};

/** Dataset and breadcrumb nodes appended to the Layout's page graph, one Dataset per chart. */
export function pageJsonLd(page: {url: string; name: string; datasets: PageDataset[]}, origin: string, author: Record<string, unknown>): Record<string, unknown>[] {
  return [
    ...page.datasets.map((dataset) => ({
      '@type': 'Dataset',
      '@id': `${page.url}#${dataset.id}`,
      name: dataset.name,
      description: dataset.description,
      url: `${page.url}#${dataset.id}`,
      creator: author,
      isPartOf: {'@id': `${origin}/#website`},
      isBasedOn: dataset.isBasedOn,
      ...(dataset.dateModified ? {dateModified: dataset.dateModified} : {}),
      variableMeasured: dataset.variables.map((name) => ({'@type': 'PropertyValue', name})),
      inLanguage: 'en-US',
    })),
    {
      '@type': 'BreadcrumbList',
      '@id': `${page.url}#breadcrumb`,
      itemListElement: [
        {'@type': 'ListItem', position: 1, name: 'AI Stats', item: `${origin}/`},
        {'@type': 'ListItem', position: 2, name: page.name, item: page.url},
      ],
    },
  ];
}

export {axisScale, type AxisScale} from './market-axis';
