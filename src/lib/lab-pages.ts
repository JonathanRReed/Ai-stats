/**
 * Build-time lab pages: one static URL per provider among the model pages.
 * Pure so it can be tested without a database; src/lib/lab-pages-data.ts loads it.
 */
import { modelDisplayFacets } from './compare-catalog';
import { reasoningRank } from './compare-family-lines';
import { labPath } from './site-routes';
import { SITE_ORIGIN, type ModelPageMetric, type ModelPageRecord } from './model-pages';
import { AUTHOR_REF } from './author';

export type LabModel = {
  id: string;
  name: string;
  path: string;
  family: string;
  reasoning: string;
  index: number | null;
  inputPrice: number | null;
  outputPrice: number | null;
  blendedPrice: number | null;
  taskCost: number | null;
  speed: number | null;
  context: number | null;
  releaseDate: string | null;
  indexVersion: string | null;
};

export type LabFamily = { family: string; models: LabModel[] };
export type CostAxis = 'task' | 'blended';
export type LabChartPoint = { id: string; name: string; reasoning: string; x: number; y: number };
export type LabChartLine = { family: string; points: LabChartPoint[] };
export type LabChart = {
  axis: CostAxis;
  lines: LabChartLine[];
  /** Models with an Index that are not on the chart, with the reason. */
  omitted: Array<{ model: LabModel; reason: string }>;
};
export type LabTimelineYear = { year: string; models: LabModel[] };

export type LabPage = {
  provider: string;
  slug: string;
  path: string;
  models: LabModel[];
  families: LabFamily[];
  indexRange: { min: number; max: number } | null;
  /** AA Index versions behind the recorded values; ranges are only shown within one version. */
  indexVersions: string[];
  newestRelease: string | null;
  chart: LabChart | null;
  timeline: LabTimelineYear[];
  undated: LabModel[];
  lastSeenDate: string | null;
};

export type LabExtras = { taskCost?: number | null; releaseDate?: string | null; indexVersion?: string | null };

const metric = (group: ModelPageMetric[], key: string): number | null => group.find((m) => m.key === key)?.value ?? null;
const validDate = (value: string | null | undefined): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const positive = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

export function labModel(record: ModelPageRecord, extras: LabExtras = {}): LabModel {
  const facets = modelDisplayFacets(record.name);
  return {
    id: record.id,
    name: record.name,
    path: record.path,
    family: facets.family,
    reasoning: facets.reasoning,
    index: metric(record.indexes, 'aa_intelligence_index'),
    inputPrice: metric(record.pricing, 'price_1m_input_tokens'),
    outputPrice: metric(record.pricing, 'price_1m_output_tokens'),
    blendedPrice: metric(record.pricing, 'price_1m_blended_3_to_1'),
    taskCost: typeof extras.taskCost === 'number' && Number.isFinite(extras.taskCost) ? extras.taskCost : null,
    speed: metric(record.speed, 'median_output_tokens_per_second'),
    context: metric(record.context, 'openrouter_context_length'),
    releaseDate: validDate(extras.releaseDate) ? extras.releaseDate.slice(0, 10) : null,
    indexVersion: extras.indexVersion ?? null,
  };
}

/** Families ordered by their best Index, each listed in ascending reasoning effort. */
export function groupFamilies(models: LabModel[]): LabFamily[] {
  const groups = new Map<string, LabModel[]>();
  for (const model of models) {
    const group = groups.get(model.family) ?? [];
    group.push(model);
    groups.set(model.family, group);
  }
  const best = (family: LabFamily) => Math.max(-1, ...family.models.map((model) => model.index ?? -1));
  return [...groups.entries()]
    .map(([family, group]) => ({
      family,
      models: [...group].sort((a, b) => reasoningRank(a.reasoning) - reasoningRank(b.reasoning) || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => best(b) - best(a) || a.family.localeCompare(b.family));
}

/**
 * Cost per AA Index task when most indexed models have one; otherwise blended token price.
 * One axis per chart, never a mix of the two.
 */
export function chooseCostAxis(models: LabModel[]): CostAxis | null {
  const indexed = models.filter((model) => model.index !== null);
  const task = indexed.filter((model) => positive(model.taskCost)).length;
  const blended = indexed.filter((model) => positive(model.blendedPrice)).length;
  if (task >= 2 && task * 2 >= indexed.length) return 'task';
  if (blended >= 1) return 'blended';
  return task >= 1 ? 'task' : null;
}

export function buildLabChart(families: LabFamily[]): LabChart | null {
  const models = families.flatMap((family) => family.models);
  const axis = chooseCostAxis(models);
  if (!axis) return null;
  const omitted: LabChart['omitted'] = [];
  const lines: LabChartLine[] = [];
  for (const family of families) {
    const points: LabChartPoint[] = [];
    for (const model of family.models) {
      if (model.index === null) continue;
      const x = axis === 'task' ? model.taskCost : model.blendedPrice;
      if (!positive(x)) {
        omitted.push({ model, reason: x === 0 ? (axis === 'task' ? 'Recorded cost per task is zero' : 'Recorded price is zero') : axis === 'task' ? 'No cost per task recorded' : 'No blended price recorded' });
        continue;
      }
      points.push({ id: model.id, name: model.name, reasoning: model.reasoning, x, y: model.index });
    }
    if (points.length) lines.push({ family: family.family, points });
  }
  return lines.length ? { axis, lines, omitted } : null;
}

/** Newest first, grouped by year; models without a recorded date are returned separately. */
export function buildTimeline(models: LabModel[]): { years: LabTimelineYear[]; undated: LabModel[] } {
  const dated = models.filter((model) => model.releaseDate !== null)
    .sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!) || a.name.localeCompare(b.name));
  const years: LabTimelineYear[] = [];
  for (const model of dated) {
    const year = model.releaseDate!.slice(0, 4);
    const last = years[years.length - 1];
    if (last?.year === year) last.models.push(model);
    else years.push({ year, models: [model] });
  }
  return { years, undated: models.filter((model) => model.releaseDate === null).sort((a, b) => a.name.localeCompare(b.name)) };
}

export function buildLabPage(provider: string, records: ModelPageRecord[], extras: ReadonlyMap<string, LabExtras> = new Map()): LabPage {
  const models = records.map((record) => labModel(record, extras.get(record.id)));
  const families = groupFamilies(models);
  const indexes = models.map((model) => model.index).filter((value): value is number => value !== null);
  const timeline = buildTimeline(models);
  const lastSeen = records.map((record) => record.lastSeenDate).filter((value): value is string => value !== null).sort();
  const path = labPath(provider);
  return {
    provider,
    slug: path.slice(path.lastIndexOf('/') + 1),
    path,
    models,
    families,
    indexRange: indexes.length ? { min: Math.min(...indexes), max: Math.max(...indexes) } : null,
    indexVersions: [...new Set(models.filter((model) => model.index !== null && model.indexVersion).map((model) => model.indexVersion!))].sort(),
    newestRelease: timeline.years[0]?.models[0]?.releaseDate ?? null,
    chart: buildLabChart(families),
    timeline: timeline.years,
    undated: timeline.undated,
    lastSeenDate: lastSeen[lastSeen.length - 1] ?? null,
  };
}

/** One page per distinct provider. Providers whose names share a slug would share a URL, so that fails the build. */
export function buildLabPages(records: ModelPageRecord[], extras: ReadonlyMap<string, LabExtras> = new Map()): LabPage[] {
  const byProvider = new Map<string, ModelPageRecord[]>();
  for (const record of records) {
    const group = byProvider.get(record.provider) ?? [];
    group.push(record);
    byProvider.set(record.provider, group);
  }
  const pages = [...byProvider.entries()].map(([provider, group]) => buildLabPage(provider, group, extras))
    .sort((a, b) => b.models.length - a.models.length || a.provider.localeCompare(b.provider));
  const seen = new Map<string, string>();
  for (const page of pages) {
    const other = seen.get(page.path);
    if (other !== undefined) throw new Error(`Labs ${other} and ${page.provider} share the path ${page.path}`);
    seen.set(page.path, page.provider);
  }
  return pages;
}

export const labPageTitle = (provider: string): string => {
  const detailed = `${provider} AI models: prices, speed and benchmarks | AI Stats`;
  if (detailed.length <= 70) return detailed;
  const short = `${provider} AI models | AI Stats`;
  return short.length <= 70 ? short : provider;
};

const indexText = (range: LabPage['indexRange']) =>
  !range ? null : range.min === range.max ? `AA Index ${range.min.toFixed(1)}` : `AA Index ${range.min.toFixed(1)} to ${range.max.toFixed(1)}`;

export function labPageDescription(page: LabPage): string {
  const facts = [
    `${page.models.length} ${page.models.length === 1 ? 'model' : 'models'} in ${page.families.length} ${page.families.length === 1 ? 'family' : 'families'}`,
    indexText(page.indexRange),
    page.newestRelease ? `newest release ${page.newestRelease}` : null,
  ].filter(Boolean).join(', ');
  return `${page.provider} models on AI Stats: ${facts}. Index against cost by family, a release timeline, and prices, speed and context with sources.`;
}

/** Nodes appended to the page graph. The Layout already emits WebSite, WebPage, and the author. */
export function buildLabJsonLd(page: LabPage): Record<string, unknown>[] {
  const url = `${SITE_ORIGIN}${page.path}`;
  return [
    { '@type': 'Organization', '@id': `${url}#lab`, name: page.provider, url },
    {
      '@type': 'ItemList',
      '@id': `${url}#models`,
      name: `${page.provider} models on AI Stats`,
      description: labPageDescription(page),
      about: { '@id': `${url}#lab` },
      creator: AUTHOR_REF,
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      numberOfItems: page.models.length,
      itemListElement: page.families.flatMap((family) => family.models).map((model, index) => ({
        '@type': 'ListItem', position: index + 1, name: model.name, url: `${SITE_ORIGIN}${model.path}`,
      })),
      ...(page.lastSeenDate ? { dateModified: page.lastSeenDate } : {}),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'AI Stats', item: `${SITE_ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Labs', item: `${SITE_ORIGIN}/labs` },
        { '@type': 'ListItem', position: 3, name: page.provider, item: url },
      ],
    },
  ];
}
