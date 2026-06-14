import type { CSSProperties, TransitionEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

type DrawerPhase = 'closed' | 'entering' | 'open' | 'leaving';

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
  const [phase, setPhase] = useState<DrawerPhase>('closed');
  const [model, setModel] = useState<ModelData | null>(null);

  const phaseRef = useRef<DrawerPhase>('closed');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);
  // Read the reduced-motion preference once via a ref.
  const reducedMotionRef = useRef<boolean>(
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  const setPhaseTracked = useCallback((next: DrawerPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const finishClose = useCallback(() => {
    cancelRaf();
    if (leaveTimerRef.current !== null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setPhaseTracked('closed');
    setModel(null);
    document.body.style.overflow = '';
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger && typeof trigger.focus === 'function') {
      trigger.focus();
    }
  }, [cancelRaf, setPhaseTracked]);

  const beginClose = useCallback(() => {
    if (phaseRef.current === 'closed' || phaseRef.current === 'leaving') return;
    if (reducedMotionRef.current) {
      finishClose();
      return;
    }
    setPhaseTracked('leaving');
    // Failsafe: if the panel transition is interrupted and transitionend never
    // fires, force-close so body scroll isn't left permanently locked.
    leaveTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current === 'leaving') finishClose();
    }, 600);
  }, [finishClose, setPhaseTracked]);

  useEffect(() => {
    const handleOpen = (e: CustomEvent<ModelData>) => {
      // Remember the element that triggered the drawer so focus can return to it.
      const active = document.activeElement;
      triggerRef.current = active instanceof HTMLElement ? active : null;

      cancelRaf();
      if (leaveTimerRef.current !== null) {
        clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
      setModel(e.detail);
      document.body.style.overflow = 'hidden';

      if (reducedMotionRef.current) {
        setPhaseTracked('open');
        return;
      }

      setPhaseTracked('entering');
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setPhaseTracked('open');
        });
      });
    };

    const handleClose = () => {
      beginClose();
    };

    window.addEventListener('open-model-drawer', handleOpen as EventListener);
    window.addEventListener('close-model-drawer', handleClose as EventListener);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (phaseRef.current === 'closed') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        beginClose();
        return;
      }
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeEl = document.activeElement;
        if (e.shiftKey) {
          if (activeEl === first || !panel.contains(activeEl)) {
            e.preventDefault();
            last.focus();
          }
        } else if (activeEl === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open-model-drawer', handleOpen as EventListener);
      window.removeEventListener('close-model-drawer', handleClose as EventListener);
      document.removeEventListener('keydown', handleKeyDown);
      cancelRaf();
      if (leaveTimerRef.current !== null) {
        clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
    };
  }, [beginClose, cancelRaf, setPhaseTracked]);

  // Focus the close button once the panel has entered.
  useEffect(() => {
    if (phase === 'open') {
      closeButtonRef.current?.focus();
    }
  }, [phase]);

  if (phase === 'closed' || !model) return null;

  const isActive = phase === 'open';
  const reduced = reducedMotionRef.current;
  const supportsBlur =
    typeof window !== 'undefined' &&
    typeof window.CSS !== 'undefined' &&
    typeof window.CSS.supports === 'function' &&
    window.CSS.supports('backdrop-filter', 'blur(8px)');

  const backdropStyle: CSSProperties = reduced
    ? { opacity: isActive ? 1 : 0 }
    : {
        opacity: isActive ? 1 : 0,
        transition: 'opacity var(--dur-base) var(--ease-smooth)',
        ...(supportsBlur
          ? {
              backdropFilter: isActive ? 'blur(8px)' : 'blur(0px)',
              WebkitBackdropFilter: isActive ? 'blur(8px)' : 'blur(0px)',
              transitionProperty: 'opacity, backdrop-filter, -webkit-backdrop-filter',
            }
          : {}),
      };

  const panelStyle: CSSProperties = reduced
    ? {}
    : {
        transform: isActive ? 'translateX(0) scale(1)' : 'translateX(100%) scale(0.98)',
        opacity: isActive ? 1 : 0,
        transition:
          'transform var(--dur-slow) var(--ease-spring), opacity var(--dur-base) var(--ease-smooth)',
        willChange: 'transform, opacity',
      };

  const handlePanelTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.propertyName !== 'transform') return;
    if (phaseRef.current === 'leaving') {
      finishClose();
    }
  };

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
        className="fixed inset-0 z-40 bg-black/75"
        style={backdropStyle}
        onClick={beginClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto border-l border-border-color bg-base shadow-[-24px_0_80px_var(--shadow-color)]"
        style={panelStyle}
        onTransitionEnd={handlePanelTransitionEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-drawer-title"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-color bg-base/95 px-6 py-5 backdrop-blur">
          <div className="flex min-w-0 items-start gap-3">
            {provider.logo ? (
              <span className={`provider-logo-frame ${provider.isDarkLogo ? 'provider-logo-frame-light' : ''}`}>
                <img
                  className="provider-logo-image"
                  src={provider.logo}
                  alt={`${provider.providerName} logo`}
                  width="20"
                  height="20"
                />
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
            ref={closeButtonRef}
            onClick={beginClose}
            className="drawer-close inline-grid h-11 w-11 shrink-0 place-items-center border border-border-color p-0 leading-none text-subtle transition-colors hover:border-love hover:bg-love hover:text-[var(--on-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-love"
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
