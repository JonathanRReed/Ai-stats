// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- untyped browser code moved verbatim from the Dashboard.astro inline script
// @ts-nocheck
// Public catalog provider board (#openrouter-provider-board) for the homepage
// Sources disclosure. Moved unchanged from the Dashboard.astro script; the
// model-browser callbacks are passed in so a provider row can filter the browser.
import {escapeHtml,toDisplayName,formatPrice,formatCompactNumber,formatContextLength} from "./format";
import {parseFiniteMetricValue} from "../../../lib/metric-values";

export function createOpenRouterBoard({
  openRouterRankSelect,
  openRouterProviderBoard,
  openRouterBoardTitle,
  openRouterBoardNote,
  openRouterColDetail,
  openRouterColValue,
  searchInput,
  applySearch,
  setView,
  openModelDrawerFromElement,
}) {
  const getOpenRouterProvider = (model) => {
    const idProvider = String(model?.openrouter_id || "")
      .split("/")[0]
      .trim();
    return idProvider || String(model?.author_slug || "unknown").trim() || "unknown";
  };

  const OPENROUTER_PROVIDER_SEARCH = {
    "meta-llama": "llama",
    "mistralai": "mistral",
    "moonshotai": "kimi",
    "x-ai": "grok",
    "qwen": "qwen",
    "google": "google",
    "openai": "openai",
    "anthropic": "anthropic",
    "deepseek": "deepseek",
    "minimax": "minimax",
  };

  const OPENROUTER_RANK_METRICS = [
    { key: "catalog", label: "Catalog coverage", detailLabel: "Route detail", note: "OpenRouter catalog", kind: "catalog", direction: "desc" },
    { key: "tools", label: "Tool-ready routes", detailLabel: "Vision routes", note: "OpenRouter supported parameters", kind: "tools", direction: "desc" },
    { key: "vision", label: "Vision coverage", detailLabel: "Tool-ready routes", note: "OpenRouter input modalities", kind: "vision", direction: "desc" },
    { key: "context", label: "Max context", detailLabel: "Largest context model", note: "OpenRouter context windows", kind: "context", direction: "desc" },
    { key: "input_price", label: "Lowest input price", detailLabel: "Cheapest route model", note: "OpenRouter route pricing", kind: "input_price", direction: "asc" },
    { key: "output_price", label: "Lowest output price", detailLabel: "Cheapest route model", note: "OpenRouter route pricing", kind: "output_price", direction: "asc" },
  ];

  const getOpenRouterRankMetric = (key) =>
    OPENROUTER_RANK_METRICS.find((metric) => metric.key === key) ??
    OPENROUTER_RANK_METRICS[0];

  const getProviderSearchValue = (provider) =>
    OPENROUTER_PROVIDER_SEARCH[String(provider || "").toLowerCase()] ||
    String(provider || "").replace(/-/g, " ");

  const buildOpenRouterProviderGroups = () => {
    const groups = new Map();
    const ensureGroup = (provider) => {
      const key = String(provider || "unknown").trim() || "unknown";
      if (!groups.has(key)) {
        groups.set(key, {
          provider: key,
          total: 0,
          tools: 0,
          vision: 0,
          maxContext: 0,
          maxContextModel: null,
          usageTokens: 0,
          usageRequests: 0,
          usageToolCalls: 0,
          catalogModels: [],
        });
      }
      return groups.get(key);
    };

    (window.__aistatsOpenRouterModels || []).forEach((model) => {
      const provider = getOpenRouterProvider(model);
      const group = ensureGroup(provider);
      const context = Number(model?.context_length) || 0;
      group.catalogModels.push(model);
      group.total += 1;
      if ((model?.supported_parameters || []).includes("tools")) group.tools += 1;
      if ((model?.input_modalities || []).includes("image")) group.vision += 1;
      if (context > group.maxContext) {
        group.maxContext = context;
        group.maxContextModel = model;
      }
    });

    (window.__aistatsOpenRouterUsageRankings || []).forEach((ranking) => {
      const provider = String(ranking.provider || "unknown").trim() || "unknown";
      const group = ensureGroup(provider);
      group.usageTokens += Number(ranking.total_tokens) || 0;
      group.usageRequests += Number(ranking.request_count) || 0;
      group.usageToolCalls += Number(ranking.tool_calls) || 0;
    });

    return Array.from(groups.values());
  };

  const getBestOpenRouterPriceModel = (models, key) => {
    const priceKey =
      key === "output_price" ? "completion_price_1m" : "prompt_price_1m";
    const candidates = (models || [])
      .filter((model) => Array.isArray(model?.output_modalities) && model.output_modalities.includes('text'))
      .map((model) => ({
        model,
        score: parseFiniteMetricValue(model?.[priceKey]),
      }))
      .filter((entry) => entry.score !== null && Number.isFinite(entry.score) && entry.score >= 0);
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0];
  };

  const renderOpenRouterProviderLeaderboard = () => {
    if (!openRouterRankSelect || !openRouterProviderBoard) return;
    if (
      !window.__aistatsPublicCatalogLoaded &&
      !(window.__aistatsOpenRouterModels || []).length
    ) {
      return;
    }

    const metric = getOpenRouterRankMetric(openRouterRankSelect.value);
    const groups = buildOpenRouterProviderGroups();
    const rows = groups
      .map((group) => {
        const base = {
          ...group,
          leaderName:
            group.maxContextModel?.name ||
            `${group.tools} tool-ready, ${group.vision} vision`,
          displayScore: String(group.total),
          scoreValue: group.total,
          model: null,
        };

        if (metric.kind === "usage") {
          return {
            ...base,
            leaderName: `${formatCompactNumber(group.usageRequests)} requests`,
            displayScore: formatCompactNumber(group.usageTokens),
            scoreValue: group.usageTokens,
          };
        }

        if (metric.kind === "requests") {
          return {
            ...base,
            leaderName: `${formatCompactNumber(group.usageTokens)} tokens`,
            displayScore: formatCompactNumber(group.usageRequests),
            scoreValue: group.usageRequests,
          };
        }

        if (metric.kind === "tools") {
          return {
            ...base,
            leaderName: `${group.vision} vision routes`,
            displayScore: String(group.tools),
            scoreValue: group.tools,
          };
        }

        if (metric.kind === "vision") {
          return {
            ...base,
            leaderName: `${group.tools} tool-ready routes`,
            displayScore: String(group.vision),
            scoreValue: group.vision,
          };
        }

        if (metric.kind === "context") {
          return {
            ...base,
            leaderName: group.maxContextModel?.name || "No context data",
            displayScore: formatContextLength(group.maxContext),
            scoreValue: group.maxContext,
          };
        }

        if (metric.kind === "input_price" || metric.kind === "output_price") {
          const best = getBestOpenRouterPriceModel(
            group.catalogModels,
            metric.kind,
          );
          if (!best) {
            return {
              ...base,
              leaderName: "No route price",
              displayScore: "N/A",
              scoreValue: Number.POSITIVE_INFINITY,
            };
          }
          return {
            ...base,
            leaderName: toDisplayName(best.model?.name),
            displayScore: formatPrice(best.score, 3),
            scoreValue: best.score,
          };
        }

        return base;
      })
      .filter((row) => Number.isFinite(row.scoreValue))
      .sort((a, b) =>
        metric.direction === "asc"
          ? a.scoreValue - b.scoreValue
          : b.scoreValue - a.scoreValue,
      )
      .slice(0, 8);

    if (openRouterBoardTitle) openRouterBoardTitle.textContent = metric.label;
    if (openRouterBoardNote) openRouterBoardNote.textContent = metric.note;
    if (openRouterColDetail) openRouterColDetail.textContent = metric.detailLabel;
    if (openRouterColValue) openRouterColValue.textContent = metric.label;

    openRouterProviderBoard.innerHTML = rows
      .map((row) => {
        const provider = escapeHtml(row.provider);
        const leaderName = escapeHtml(row.leaderName);
        const modelPayload = row.model
          ? ` data-model-id="${escapeHtml(row.model.id)}"`
          : "";
        const providerQuery = escapeHtml(getProviderSearchValue(row.provider));
        const rowLabel = escapeHtml(
          `Provider ${row.provider}. ${metric.detailLabel} ${row.leaderName}. ${metric.label} ${row.displayScore}. Models ${row.total}. Max context ${formatContextLength(row.maxContext)}.`,
        );
        return `
          <li>
            <button
              type="button"
              class="openrouter-provider-row"
              aria-label="${rowLabel}"
              data-openrouter-provider="${provider}"
              data-openrouter-provider-query="${providerQuery}"
              ${modelPayload}
            >
              <span class="openrouter-model" title="${provider}">${provider}</span>
              <span class="openrouter-leader" title="${leaderName}">${leaderName}</span>
              <span class="openrouter-score">${escapeHtml(row.displayScore)}</span>
              <span>${row.total}</span>
              <span>${formatContextLength(row.maxContext)}</span>
            </button>
          </li>
        `;
      })
      .join("");
    bindOpenRouterProviderRows();
  };

  const openOpenRouterProviderRow = (row) => {
    if (row.dataset.modelId || row.dataset.modelJson) {
      void openModelDrawerFromElement(row);
      return;
    }
    const query = row.dataset.openrouterProviderQuery;
    if (!query || !searchInput) return;
    const modelDisclosure = document.getElementById("stats-models");
    if (modelDisclosure instanceof HTMLDetailsElement) modelDisclosure.open = true;
    searchInput.value = query;
    applySearch(true);
    setView("cards");
    document.getElementById("model-browser")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const bindOpenRouterProviderRows = () => {
    document.querySelectorAll("[data-openrouter-provider]").forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      if (row.dataset.providerBound === "true") return;
      row.dataset.providerBound = "true";
      row.addEventListener("click", () => openOpenRouterProviderRow(row));
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openOpenRouterProviderRow(row);
      });
    });
  };

  return {renderOpenRouterProviderLeaderboard, bindOpenRouterProviderRows};
}
