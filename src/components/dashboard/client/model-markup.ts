// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- untyped browser code moved verbatim from the Dashboard.astro inline script
// @ts-nocheck
// Client-rendered model browser card and table row markup (moved unchanged from Dashboard.astro).
// The server-rendered first page lives in ModelCard.astro and ModelBrowserSection.astro.
import {hasFiniteMetricValue,parseFiniteMetricValue} from "../../../lib/metric-values";
import {escapeHtml,toDisplayName,formatIndex,formatScore,formatPrice,formatCompactNumber,formatTps,formatTtft,formatContextLength,getScoreClass} from "./format";

export const createCardMarkup = (model) => {
  const name = escapeHtml(toDisplayName(model.name));
  const company = escapeHtml(
    toDisplayName(model.company_name, "Unknown provider"),
  );
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
  const hasPositiveNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0;
  };
  const pricesAreClose = (first, second) => {
    if (!hasPositiveNumber(first) || !hasPositiveNumber(second)) return false;
    return Math.abs(Number(first) - Number(second)) < 0.001;
  };
  const hasOpenRouterPrice =
    hasPositiveNumber(model.openrouter_prompt_price_1m) ||
    hasPositiveNumber(model.openrouter_completion_price_1m);
  const openRouterPriceMatchesAa =
    pricesAreClose(model.price_1m_input_tokens, model.openrouter_prompt_price_1m) &&
    pricesAreClose(model.price_1m_output_tokens, model.openrouter_completion_price_1m);
  const showOpenRouterPricing = hasOpenRouterPrice && !openRouterPriceMatchesAa;
  const effectiveContextLength =
    model.openrouter_context_length ||
    model.litellm_max_input_tokens ||
    model.context_window;
  const publicSourceCount = [
    hasOpenRouterData,
    Number(model.openrouter_usage_tokens) > 0,
    Number(model.openrouter_endpoint_provider_count) > 0,
    Boolean(model.hf_model_id),
    Boolean(model.litellm_model_id),
  ].filter(Boolean).length;
  const dataSourceBadge =
    publicSourceCount > 1
      ? `AA + ${publicSourceCount} catalogs`
      : hasOpenRouterData
        ? "AA + OR"
        : model.hf_model_id
          ? "AA + HF"
          : model.litellm_model_id
            ? "AA + LiteLLM"
            : "AA";
  const openRouterCaps =
    [
      openRouterParameters.includes("tools") || model.litellm_supports_function_calling ? "Tools" : null,
      openRouterInputModalities.includes("image") || model.litellm_supports_vision ? "Vision" : null,
      openRouterOutputModalities.includes("image") ? "Image out" : null,
      model.litellm_supports_reasoning ? "Reasoning" : null,
      model.litellm_supports_prompt_caching ? "Cache" : null,
      model.litellm_supports_web_search ? "Web" : null,
    ]
      .filter(Boolean)
      .join(", ") || "Text";
  const hasPublicCatalogData =
    hasOpenRouterData || Boolean(model.hf_model_id) || Boolean(model.litellm_model_id);
  const catalogMarkup = hasPublicCatalogData
    ? `
      <section class="card-metric-panel mt-2 px-3 py-2">
        <div class="text-[length:var(--text-xs)] text-muted">Public catalog</div>
        <dl class="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[length:var(--text-xs)] text-text">
          <div class="flex items-center justify-between gap-2"><dt class="text-subtle">Tools</dt><dd class="font-bold">${openRouterParameters.includes("tools") || model.litellm_supports_function_calling ? "Yes" : "No"}</dd></div>
          <div class="flex items-center justify-between gap-2"><dt class="text-subtle">Route</dt><dd class="font-bold">${hasOpenRouterData ? (model.openrouter_is_free ? "Free" : "Paid") : "-"}</dd></div>
          ${
            showOpenRouterPricing
              ? `<div class="flex items-center justify-between gap-2"><dt class="text-subtle">OR input</dt><dd class="font-bold">${formatPrice(model.openrouter_prompt_price_1m, 3)}</dd></div>
                 <div class="flex items-center justify-between gap-2"><dt class="text-subtle">OR output</dt><dd class="font-bold">${formatPrice(model.openrouter_completion_price_1m, 3)}</dd></div>`
              : ""
          }
          <div class="col-span-2 flex items-center justify-between gap-3"><dt class="text-subtle">HF signal</dt><dd class="min-w-0 truncate font-bold">${model.hf_model_id ? `${formatCompactNumber(model.hf_downloads)} downloads, ${formatCompactNumber(model.hf_likes)} likes` : "-"}</dd></div>
          <div class="col-span-2 flex items-center justify-between gap-3"><dt class="text-subtle">OR routes</dt><dd class="min-w-0 truncate font-bold">${Number(model.openrouter_endpoint_provider_count) > 0 ? `${Number(model.openrouter_endpoint_provider_count)} providers` : "-"}</dd></div>
          <div class="col-span-2 flex items-center justify-between gap-3"><dt class="text-subtle">Context</dt><dd class="min-w-0 truncate font-bold">${formatContextLength(effectiveContextLength)}</dd></div>
          <div class="col-span-2 flex items-center justify-between gap-3"><dt class="text-subtle">Capabilities</dt><dd class="min-w-0 truncate font-bold">${escapeHtml(openRouterCaps)}</dd></div>
        </dl>
      </section>
    `
    : "";
  const allBenchmarks = [
    ["MMLU Pro", model.mmlu_pro],
    ["GPQA", model.gpqa],
    ["HLE", model.hle],
    ["AIME", model.aime],
    ["LiveCodeBench", model.livecodebench],
    ["SciCode", model.scicode],
    ["Math 500", model.math_500],
  ].filter(([, value]) => hasFiniteMetricValue(value));

  // AA Indexes
  const aaIndexes = [
    ["AA Index", model.aa_intelligence_index],
    ["Coding", model.aa_coding_index],
    ["Math", model.aa_math_index],
  ].filter(([, value]) => hasFiniteMetricValue(value));


  return `
    <div
      data-model-card
      data-model-id="${escapeHtml(model.id)}"
      data-card-label="${name}, ${company}"
      data-name="${escapeHtml(String(model.name ?? "").toLowerCase())}"
      data-company="${escapeHtml(String(model.company_name ?? "").toLowerCase())}"
      data-intelligence="${parseFiniteMetricValue(model.aa_intelligence_index) ?? ''}"
      data-mmlu="${parseFiniteMetricValue(model.mmlu_pro) ?? ''}"
      data-gpqa="${parseFiniteMetricValue(model.gpqa) ?? ''}"
      data-hle="${parseFiniteMetricValue(model.hle) ?? ''}"
      data-aime="${parseFiniteMetricValue(model.aime) ?? ''}"
      data-input-price="${parseFiniteMetricValue(model.price_1m_input_tokens) ?? ''}"
      data-output-price="${parseFiniteMetricValue(model.price_1m_output_tokens) ?? ''}"
      data-tps="${parseFiniteMetricValue(model.median_output_tokens_per_second) ?? ''}"
      class="model-card brutalist-card group px-4 py-4 text-sm stagger-item is-visible"
    >
      <header class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h3 class="break-words text-sm font-semibold text-text group-hover:text-foam transition-colors" title="${name}">${name}</h3>
          <p class="mt-0.5 text-xs text-subtle">${company}</p>
        </div>
        <div class="source-strip flex-shrink-0" title="Data coverage">
          <span>${dataSourceBadge}</span>
        </div>
      </header>
      <div class="mt-3 grid gap-2 text-[length:var(--text-xs)] text-subtle sm:grid-cols-2 xl:grid-cols-3">
        <section class="card-metric-panel px-3 py-2">
          <div class="text-[length:var(--text-xs)] text-muted">Pricing</div>
          <dl class="mt-1.5 space-y-0.5 text-text text-[length:var(--text-xs)]">
            <div class="flex items-center justify-between"><dt>Input</dt><dd class="font-semibold">${formatPrice(model.price_1m_input_tokens, 3)}</dd></div>
            <div class="flex items-center justify-between"><dt>Output</dt><dd class="font-semibold">${formatPrice(model.price_1m_output_tokens, 3)}</dd></div>
            <div class="flex items-center justify-between"><dt>Blended</dt><dd class="font-semibold">${formatPrice(model.price_1m_blended_3_to_1, 3)}</dd></div>
          </dl>
        </section>
        <section class="card-metric-panel px-3 py-2">
          <div class="text-[length:var(--text-xs)] text-muted">Performance</div>
          <dl class="mt-1.5 space-y-0.5 text-text text-[length:var(--text-xs)]">
            <div class="flex items-center justify-between"><dt>TPS</dt><dd class="font-semibold">${formatTps(model.median_output_tokens_per_second)}</dd></div>
            <div class="flex items-center justify-between"><dt>First token</dt><dd class="font-semibold">${formatTtft(model.median_time_to_first_token_seconds)}</dd></div>
            <div class="flex items-center justify-between"><dt>First answer token</dt><dd class="font-semibold">${formatTtft(model.median_time_to_first_answer_token)}</dd></div>
          </dl>
        </section>
        <section class="card-metric-panel px-3 py-2">
          <div class="text-[length:var(--text-xs)] text-muted">Specs</div>
          <dl class="mt-1.5 space-y-0.5 text-text text-[length:var(--text-xs)]">
            <div class="flex items-center justify-between"><dt>Context</dt><dd class="font-semibold">${formatContextLength(effectiveContextLength)}</dd></div>
            <div class="flex items-center justify-between"><dt>Max output</dt><dd class="font-semibold">${formatContextLength(model.max_output_tokens)}</dd></div>
            <div class="flex items-center justify-between"><dt>Source</dt><dd class="font-semibold">${dataSourceBadge}</dd></div>
          </dl>
        </section>
      </div>
${allBenchmarks.length ? `
      <section class="card-metric-panel mt-2 px-3 py-2">
        <div class="text-[length:var(--text-xs)] text-muted">Benchmarks</div>
        <div class="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[length:var(--text-xs)]">
          ${allBenchmarks.map(([label,value]) => `<div class="flex items-center justify-between"><span class="text-subtle">${label}</span><span class="font-semibold ${getScoreClass(value)}">${formatScore(value)}</span></div>`).join("")}
        </div>
      </section>` : `<p class="card-metric-panel mt-2 px-3 py-2 text-subtle">No benchmark measurements available.</p>`}
      ${aaIndexes.length ? `
      <section class="card-metric-panel mt-2 px-3 py-2">
        <div class="text-[length:var(--text-xs)] text-muted">Artificial Analysis indexes (points)</div>
        <div class="mt-1.5 grid grid-cols-3 gap-1.5 text-center text-[length:var(--text-xs)]">
          ${aaIndexes.map(([label,value]) => `<div class="border border-highlight-med bg-overlay px-1.5 py-1.5"><div class="text-[length:var(--text-xs)] text-muted">${label}</div><div class="font-bold ${getScoreClass(value)}">${formatIndex(value)}</div></div>`).join("")}
        </div>
      </section>` : ""}
      ${catalogMarkup}
    </div>
  `;
};

export const createTableRowMarkup = (model) => `
  <tr
    class="cursor-pointer transition-colors hover:bg-highlight-low/50"
    data-table-row
    tabindex="0"
    role="button"
    aria-label="Open details for ${escapeHtml(toDisplayName(model.name))}, ${escapeHtml(toDisplayName(model.company_name, "Unknown provider"))}"
    data-card-label="${escapeHtml(toDisplayName(model.name))}, ${escapeHtml(toDisplayName(model.company_name, "Unknown provider"))}"
    data-model-id="${escapeHtml(model.id)}"
    data-name="${escapeHtml(String(model.name ?? "").toLowerCase())}"
    data-company="${escapeHtml(String(model.company_name ?? "").toLowerCase())}"
    data-intelligence="${parseFiniteMetricValue(model.aa_intelligence_index) ?? ''}"
      data-mmlu="${parseFiniteMetricValue(model.mmlu_pro) ?? ''}"
    data-gpqa="${parseFiniteMetricValue(model.gpqa) ?? ''}"
    data-hle="${parseFiniteMetricValue(model.hle) ?? ''}"
    data-aime="${parseFiniteMetricValue(model.aime) ?? ''}"
    data-input-price="${parseFiniteMetricValue(model.price_1m_input_tokens) ?? ''}"
    data-output-price="${parseFiniteMetricValue(model.price_1m_output_tokens) ?? ''}"
    data-tps="${parseFiniteMetricValue(model.median_output_tokens_per_second) ?? ''}"
  >
    <td class="px-4 py-3 font-medium text-text">${escapeHtml(toDisplayName(model.name))}</td>
    <td class="px-4 py-3 text-subtle">${escapeHtml(toDisplayName(model.company_name, "-"))}</td>
    <td class="px-4 py-3 text-right font-mono text-text">${formatIndex(model.aa_intelligence_index)}</td>
    <td class="px-4 py-3 text-right font-mono text-text">${formatContextLength(model.openrouter_context_length)}</td>
    <td class="px-4 py-3 text-right font-mono text-text">${formatPrice(model.price_1m_input_tokens, 3)}</td>
    <td class="px-4 py-3 text-right font-mono text-text">${formatPrice(model.price_1m_output_tokens, 3)}</td>
    <td class="px-4 py-3 text-right font-semibold ${getScoreClass(model.mmlu_pro)}">${formatScore(model.mmlu_pro)}</td>
    <td class="px-4 py-3 text-right font-semibold ${getScoreClass(model.gpqa)}">${formatScore(model.gpqa)}</td>
    <td class="px-4 py-3 text-right text-text">${formatTps(model.median_output_tokens_per_second)}</td>
  </tr>
`;
