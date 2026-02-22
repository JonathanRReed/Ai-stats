import { useEffect, useState } from 'react';

interface ModelData {
  id: string;
  name: string;
  company_name: string;
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

function formatTPS(value: number | null | undefined): string {
  if (!value || value <= 0) return '-';
  return value.toFixed(1) + ' t/s';
}

function formatTTFT(value: number | null | undefined): string {
  if (!value || value <= 0) return '-';
  const ms = value * 1000;
  return ms < 1000 ? ms.toFixed(0) + 'ms' : (ms / 1000).toFixed(2) + 's';
}

function getScoreColor(score: number | null | undefined): string {
  if (!score || score <= 0) return 'score-none';
  const pct = score <= 1 ? score * 100 : score;
  if (pct >= 80) return 'score-high';
  if (pct >= 60) return 'score-mid';
  if (pct >= 40) return 'score-low';
  return 'score-poor';
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

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => {
          setIsOpen(false);
          document.body.style.overflow = '';
        }}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto bg-[#1f1d2e] shadow-2xl border-l border-[#403d52]">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#403d52] bg-[#1f1d2e]/95 px-6 py-4 backdrop-blur">
          <div>
            <h2 className="text-lg font-bold text-[#e0def4]">{model.name}</h2>
            <p className="text-sm text-[#b0acbe]">{model.company_name || 'Unknown provider'}</p>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              document.body.style.overflow = '';
            }}
            className="rounded-lg p-2 text-[#b0acbe] transition-colors hover:bg-[#26233a] hover:text-[#e0def4]"
            aria-label="Close drawer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="space-y-6 p-6">
          {/* Pricing */}
          <section className="rounded-xl border border-[#403d52] bg-[#26233a]/50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9490a8]">Pricing</h3>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-[#b0acbe]">Input (1M tokens)</dt>
                <dd className="text-lg font-semibold text-[#e0def4]">{formatPrice(model.price_1m_input_tokens, 3)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#b0acbe]">Output (1M tokens)</dt>
                <dd className="text-lg font-semibold text-[#e0def4]">{formatPrice(model.price_1m_output_tokens, 3)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#b0acbe]">Blended (3:1)</dt>
                <dd className="text-lg font-semibold text-[#e0def4]">{formatPrice(model.price_1m_blended_3_to_1, 3)}</dd>
              </div>
            </dl>
          </section>

          {/* Performance */}
          <section className="rounded-xl border border-[#403d52] bg-[#26233a]/50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9490a8]">Performance</h3>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-[#b0acbe]">Throughput</dt>
                <dd className="text-lg font-semibold text-[#e0def4]">{formatTPS(model.median_output_tokens_per_second)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#b0acbe]">TTFT (token)</dt>
                <dd className="text-lg font-semibold text-[#e0def4]">{formatTTFT(model.median_time_to_first_token_seconds)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#b0acbe]">TTFT (answer)</dt>
                <dd className="text-lg font-semibold text-[#e0def4]">{formatTTFT(model.median_time_to_first_answer_token)}</dd>
              </div>
            </dl>
          </section>

          {/* Benchmarks */}
          <section className="rounded-xl border border-[#403d52] bg-[#26233a]/50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9490a8]">Benchmarks</h3>
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
                <div key={label as string} className="flex items-center justify-between rounded-lg bg-[#21202e] px-3 py-2">
                  <span className="text-sm text-[#b0acbe]">{label}</span>
                  <span className={`text-sm font-semibold ${getScoreColor(value as number)}`}>
                    {formatScore(value as number)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* AA Indexes */}
          <section className="rounded-xl border border-[#403d52] bg-[#26233a]/50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9490a8]">AA Indexes</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Intelligence', model.aa_intelligence_index],
                ['Coding', model.aa_coding_index],
                ['Math', model.aa_math_index],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg bg-[#21202e] p-3 text-center">
                  <div className="text-xs text-[#b0acbe]">{label}</div>
                  <div className={`mt-1 text-xl font-bold ${getScoreColor(value as number)}`}>
                    {formatScore(value as number)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Context Window */}
          {(model.context_window || model.max_output_tokens) && (
            <section className="rounded-xl border border-[#403d52] bg-[#26233a]/50 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9490a8]">Context</h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                {model.context_window && (
                  <div>
                    <dt className="text-xs text-[#b0acbe]">Context Window</dt>
                    <dd className="text-lg font-semibold text-[#e0def4]">
                      {(model.context_window / 1000).toFixed(0)}K tokens
                    </dd>
                  </div>
                )}
                {model.max_output_tokens && (
                  <div>
                    <dt className="text-xs text-[#b0acbe]">Max Output</dt>
                    <dd className="text-lg font-semibold text-[#e0def4]">
                      {(model.max_output_tokens / 1000).toFixed(0)}K tokens
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
