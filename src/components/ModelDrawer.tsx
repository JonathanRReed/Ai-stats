import { useEffect, useState } from 'react';

interface ModelData {
  id: string;
  name: string;
  slug?: string | null;
  company_name: string;
  creator_name?: string | null;
  creator_slug?: string | null;
  price_1m_input_tokens: number;
  price_1m_output_tokens: number;
  price_1m_blended_3_to_1: number;
  median_output_tokens_per_second: number;
  median_time_to_first_token_seconds: number;
  median_time_to_first_answer_token: number;
  mmlu_pro: number;
  gpqa: number;
  hle: number;
  aime: number;
  livecodebench: number;
  scicode: number;
  math_500: number;
  aa_intelligence_index: number;
  aa_coding_index: number;
  aa_math_index: number;
  context_window: number;
  max_output_tokens: number;
  first_seen?: string | null;
  last_seen?: string | null;
  openrouter_id?: string | null;
  openrouter_name?: string | null;
  openrouter_context_length?: number | null;
  openrouter_prompt_price_1m?: number | null;
  openrouter_completion_price_1m?: number | null;
  openrouter_supported_parameters?: string[];
  openrouter_input_modalities?: string[];
  openrouter_output_modalities?: string[];
  openrouter_is_free?: boolean;
}

function formatScore(value: number | null | undefined): string {
  if (!value || value <= 0) return 'N/A';
  const num = Number(value);
  if (num <= 1) return (num * 100).toFixed(1) + '%';
  return num.toFixed(1);
}

function formatPrice(value: number, decimals = 2): string {
  if (!value || value <= 0) return '-';
  return '$' + value.toFixed(decimals);
}

function hasPositiveNumber(value: number | null | undefined): boolean {
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

function pricesAreClose(
  first: number | null | undefined,
  second: number | null | undefined,
): boolean {
  if (!hasPositiveNumber(first) || !hasPositiveNumber(second)) return false;
  return Math.abs(Number(first) - Number(second)) < 0.001;
}

function formatTPS(value: number | null | undefined): string {
  if (!value || value <= 0) return '-';
  return value.toFixed(1) + ' t/s';
}

function formatTTFT(value: number | null | undefined): string {
  if (!value || value <= 0) return '-';
  const ms = value * 1000;
  return ms < 1000 ? ms.toFixed(0) + 'ms' : (ms / 1000).toFixed(2) + 's';
}

function formatContextLength(value: number | null | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '-';
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1) + 'M tokens';
  }
  if (num >= 1_000) return Math.round(num / 1_000) + 'K tokens';
  return num.toLocaleString() + ' tokens';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getScoreColor(score: number | null | undefined): string {
  if (!score || score <= 0) return 'score-none';
  const pct = score <= 1 ? score * 100 : score;
  if (pct >= 80) return 'score-high';
  if (pct >= 60) return 'score-mid';
  if (pct >= 40) return 'score-low';
  return 'score-poor';
}

const providerLogos: Record<string, string> = {
  openai: '/icons/providers/openai.svg',
  anthropic: '/icons/providers/anthropic.svg',
  claude: '/icons/providers/claude-color.svg',
  google: '/icons/providers/google.svg',
  gemini: '/icons/providers/gemini-color.svg',
  gemma: '/icons/providers/gemma-color.svg',
  meta: '/icons/providers/meta.svg',
  llama: '/icons/providers/meta.svg',
  mistral: '/icons/providers/mistral.svg',
  cohere: '/icons/providers/cohere-color.svg',
  deepseek: '/icons/providers/deepseek-color.svg',
  qwen: '/icons/providers/qwen-color.svg',
  alibaba: '/icons/providers/qwen-color.svg',
  xai: '/icons/providers/xai.svg',
  grok: '/icons/providers/grok.svg',
  nvidia: '/icons/providers/nvidia-color.svg',
  microsoft: '/icons/providers/microsoft.svg',
  moonshot: '/icons/providers/moonshot.svg',
  kimi: '/icons/providers/moonshot.svg',
  perplexity: '/icons/providers/perplexity.svg',
  bytedance: '/icons/providers/bytedance.svg',
  minimax: '/icons/providers/minimax.svg',
  zhipu: '/icons/providers/zai.svg',
  zai: '/icons/providers/zai.svg',
};

const darkLogoKeys = new Set([
  'openai',
  'anthropic',
  'xai',
  'grok',
  'moonshot',
  'kimi',
  'zai',
  'zhipu',
  'meta',
  'llama',
  'perplexity',
  'bytedance',
]);

function getProviderIdentity(model: ModelData) {
  const providerName = model.company_name || 'Unknown provider';
  const search = `${providerName} ${model.name}`.toLowerCase();
  const normalizedSearch = search.replace(/[^a-z0-9]+/g, '');
  const matched = Object.entries(providerLogos).find(([key]) =>
    normalizedSearch.includes(key.replace(/[^a-z0-9]+/g, '')),
  );
  const initials =
    providerName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';

  return {
    providerName,
    logo: matched?.[1] ?? null,
    isDarkLogo: matched ? darkLogoKeys.has(matched[0]) : false,
    initials,
  };
}

export default function ModelDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [model, setModel] = useState<ModelData | null>(null);

  useEffect(() => {
    const handleOpen = (e: CustomEvent<ModelData>) => {
      setModel(e.detail);
      setIsOpen(true);
      document.body.style.overflow = 'hidden';
    };

    const handleClose = () => {
      setIsOpen(false);
      document.body.style.overflow = '';
    };

    window.addEventListener('open-model-drawer' as any, handleOpen);
    window.addEventListener('close-model-drawer' as any, handleClose);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open-model-drawer' as any, handleOpen);
      window.removeEventListener('close-model-drawer' as any, handleClose);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen || !model) return null;
  const provider = getProviderIdentity(model);
  const openRouterParameters = Array.isArray(model.openrouter_supported_parameters)
    ? model.openrouter_supported_parameters
    : [];
  const openRouterInputModalities = Array.isArray(model.openrouter_input_modalities)
    ? model.openrouter_input_modalities
    : [];
  const openRouterOutputModalities = Array.isArray(model.openrouter_output_modalities)
    ? model.openrouter_output_modalities
    : [];
  const hasOpenRouterData = Boolean(model.openrouter_id);
  const hasOpenRouterPrice =
    hasPositiveNumber(model.openrouter_prompt_price_1m) ||
    hasPositiveNumber(model.openrouter_completion_price_1m);
  const openRouterPriceMatchesAa =
    pricesAreClose(model.price_1m_input_tokens, model.openrouter_prompt_price_1m) &&
    pricesAreClose(model.price_1m_output_tokens, model.openrouter_completion_price_1m);
  const showOpenRouterPricing = hasOpenRouterPrice && !openRouterPriceMatchesAa;
  const effectiveContextLength = model.openrouter_context_length || model.context_window;
  const sourceRows = [
    ['Artificial Analysis', 'Pricing, AA benchmarks, speed'],
    hasOpenRouterData ? ['OpenRouter', 'Catalog, context, route metadata'] : null,
    model.slug ? ['AA slug', model.slug] : null,
    model.creator_slug ? ['Creator slug', model.creator_slug] : null,
    model.first_seen ? ['First seen', formatDate(model.first_seen)] : null,
    model.last_seen ? ['Last seen', formatDate(model.last_seen)] : null,
  ].filter(Boolean) as string[][];
  const capabilityText =
    [
      openRouterParameters.includes('tools') ? 'tools' : null,
      openRouterInputModalities.includes('image') ? 'vision' : null,
      openRouterOutputModalities.includes('image') ? 'image output' : null,
      model.openrouter_is_free ? 'free route listed' : null,
    ]
      .filter(Boolean)
      .join(', ') || 'text';

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/75 transition-opacity"
        onClick={() => {
          setIsOpen(false);
          document.body.style.overflow = '';
        }}
        aria-hidden="true"
      />

      <div
        className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto border-l border-border-color bg-base shadow-[-24px_0_80px_var(--shadow-color)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-drawer-title"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-color bg-base/95 px-6 py-5 backdrop-blur">
          <div className="flex min-w-0 items-start gap-3">
            {provider.logo ? (
              <span className={`provider-logo-frame ${provider.isDarkLogo ? 'provider-logo-frame-light' : ''}`}>
                <img className="provider-logo-image" src={provider.logo} alt="" width="20" height="20" />
              </span>
            ) : (
              <span className="provider-logo-frame provider-logo-fallback" aria-hidden="true">
                {provider.initials}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted">Model detail</p>
              <h2 id="model-drawer-title" className="mt-1 text-xl font-black text-text">{model.name}</h2>
              <p className="font-mono text-sm text-subtle">{provider.providerName}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              document.body.style.overflow = '';
            }}
            className="inline-grid h-11 w-11 shrink-0 place-items-center border border-border-color p-0 leading-none text-subtle transition-colors hover:border-love hover:bg-love hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-love"
            aria-label="Close drawer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="space-y-7 p-6">
          <section className="rounded-lg border border-border-color bg-surface p-4">
            <h3 className="mb-3 font-mono text-xs font-bold text-muted">Pricing</h3>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="font-mono text-xs text-subtle">Input, 1M tokens</dt>
                <dd className="font-mono text-lg font-semibold text-text">{formatPrice(model.price_1m_input_tokens, 3)}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-subtle">Output, 1M tokens</dt>
                <dd className="font-mono text-lg font-semibold text-text">{formatPrice(model.price_1m_output_tokens, 3)}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-subtle">Blended, 3:1</dt>
                <dd className="font-mono text-lg font-semibold text-text">{formatPrice(model.price_1m_blended_3_to_1, 3)}</dd>
              </div>
            </dl>
            {hasOpenRouterData && (
              <div className="mt-4 border border-highlight-med bg-overlay px-3 py-2 font-mono text-xs text-subtle">
                {showOpenRouterPricing ? (
                  <span>
                    OpenRouter catalog: {formatPrice(model.openrouter_prompt_price_1m ?? 0, 3)} input,{' '}
                    {formatPrice(model.openrouter_completion_price_1m ?? 0, 3)} output.
                  </span>
                ) : (
                  <span>OpenRouter catalog pricing matches the AA pricing shown above.</span>
                )}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border-color bg-surface p-4">
            <h3 className="mb-3 font-mono text-xs font-bold text-muted">Performance</h3>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="font-mono text-xs text-subtle">Throughput</dt>
                <dd className="font-mono text-lg font-semibold text-text">{formatTPS(model.median_output_tokens_per_second)}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-subtle">TTFT, token</dt>
                <dd className="font-mono text-lg font-semibold text-text">{formatTTFT(model.median_time_to_first_token_seconds)}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-subtle">TTFT, answer</dt>
                <dd className="font-mono text-lg font-semibold text-text">{formatTTFT(model.median_time_to_first_answer_token)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border-color bg-surface p-4">
            <h3 className="mb-3 font-mono text-xs font-bold text-muted">Benchmarks</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['MMLU Pro', model.mmlu_pro],
                ['GPQA', model.gpqa],
                ['HLE', model.hle],
                ['AIME', model.aime],
                ['LiveCodeBench', model.livecodebench],
                ['SciCode', model.scicode],
                ['Math 500', model.math_500],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between border border-highlight-med bg-overlay px-3 py-2">
                  <span className="font-mono text-sm text-subtle">{label}</span>
                  <span className={`text-sm font-semibold ${getScoreColor(value as number)}`}>
                    {formatScore(value as number)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border-color bg-surface p-4">
            <h3 className="mb-3 font-mono text-xs font-bold text-muted">AA indexes</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Intelligence', model.aa_intelligence_index],
                ['Coding', model.aa_coding_index],
                ['Math', model.aa_math_index],
              ].map(([label, value]) => (
                <div key={label as string} className="border border-highlight-med bg-overlay p-3 text-center">
                  <div className="font-mono text-xs text-subtle">{label}</div>
                  <div className={`mt-1 text-xl font-bold ${getScoreColor(value as number)}`}>
                    {formatScore(value as number)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {(hasOpenRouterData || effectiveContextLength || model.max_output_tokens) && (
            <section className="rounded-lg border border-border-color bg-surface p-4">
              <h3 className="mb-3 font-mono text-xs font-bold text-muted">Catalog and context</h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="font-mono text-xs text-subtle">Context length</dt>
                  <dd className="font-mono text-lg font-semibold text-text">
                    {formatContextLength(effectiveContextLength)}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-xs text-subtle">Max output</dt>
                  <dd className="font-mono text-lg font-semibold text-text">
                    {formatContextLength(model.max_output_tokens)}
                  </dd>
                </div>
                {hasOpenRouterData && (
                  <>
                    <div>
                      <dt className="font-mono text-xs text-subtle">OpenRouter ID</dt>
                      <dd className="break-words font-mono text-sm font-semibold text-text">{model.openrouter_id}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-xs text-subtle">Catalog name</dt>
                      <dd className="break-words font-mono text-sm font-semibold text-text">{model.openrouter_name || model.name}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-xs text-subtle">Modalities</dt>
                      <dd className="font-mono text-sm font-semibold text-text">
                        {(openRouterInputModalities.join(', ') || 'text') + ' to ' + (openRouterOutputModalities.join(', ') || 'text')}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-xs text-subtle">Capabilities</dt>
                      <dd className="font-mono text-sm font-semibold text-text">{capabilityText}</dd>
                    </div>
                  </>
                )}
              </dl>
            </section>
          )}

          {sourceRows.length > 0 && (
            <section className="rounded-lg border border-border-color bg-surface p-4">
              <h3 className="mb-3 font-mono text-xs font-bold text-muted">Source coverage</h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                {sourceRows.map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-mono text-xs text-subtle">{label}</dt>
                    <dd className="break-words font-mono text-sm font-semibold text-text">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
