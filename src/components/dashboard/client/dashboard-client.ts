// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- untyped browser code moved verbatim from the Dashboard.astro inline script
// @ts-nocheck
// Homepage client script: Benchmarks leaderboard, model browser, public catalog
// board and live refresh. Moved from Dashboard.astro; it binds to the ids and
// data attributes rendered by LeaderboardSection, ModelBrowserSection and
// PublicCatalogPanel, and reads the window.__* payload set by Dashboard.astro.
import {escapeHtml,toDisplayName,cleanSourceUrl,cleanSourceName,formatIndex,formatScore,formatPrice,toDrawerModel} from "./format";
import {createCardMarkup,createTableRowMarkup} from "./model-markup";
import {createOpenRouterBoard} from "./openrouter-board";
import {validateBrowserPayload,selectBrowserModels,browserPage} from "../../../lib/model-browser";
import {bindDashboardLifecycle} from "../../../lib/dashboard-lifecycle";
import {nextLeaderboardLimit,visibleLeaderboardRows} from "../../../lib/leaderboard-pagination";
import {resolveEpochLeaderboardRunNames} from "../../../lib/epoch-model-display-name";
import {rankModelFamilies} from "../../../lib/model-family-ranking";
import {setLeaderboardCompareAction,setLeaderboardFamilyControlsDisabled,setLeaderboardPanel} from "../../../lib/leaderboard-panels";
import {leaderboardComparisonHref,leaderboardRunCatalogRecord} from "../../../lib/leaderboard-comparison";
import {buildBenchmarkCohorts,benchmarkRecordHref,benchmarkRunSettings,leaderboardBarWidth} from '../../../lib/benchmark-leaderboard';
import {preferPublisherBenchmarks} from '../../../lib/benchmark-catalog';
import {createEpochRankingController,epochLiveSnapshotFrom,visibleCountAfterExpansion} from '../../../lib/epoch-leaderboard-ranking';
import { findAaComparableCoverageLeader } from "../../../lib/data-integrity";
import {
  hasFiniteMetricValue,
  compareOptionalMetricValues,
  parseFiniteMetricValue,
} from "../../../lib/metric-values";

const initializeDashboard = (currentRoot, signal, isCurrentDashboard) => {
  if (typeof window === "undefined" || !currentRoot) return;
  const lifecycle = { signal };
  const observers = new Set();
  lifecycle.signal.addEventListener("abort", () => {
    observers.forEach((observer) => observer.disconnect());
    observers.clear();
  }, { once: true });
  const PAGE_SIZE = 12;
  const AA_BENCHMARKS = [
    { key: "mmlu_pro", label: "MMLU Pro", source: "aa" },
    { key: "gpqa", label: "GPQA", source: "aa" },
    { key: "hle", label: "HLE", source: "aa" },
    { key: "aime", label: "AIME", source: "aa" },
    { key: "scicode", label: "SciCode", source: "aa" },
    { key: "math_500", label: "Math 500", source: "aa" },
    { key: "livecodebench", label: "LiveCodeBench", source: "aa" },
    { key: "aa_math_index", label: "AA Math Index", source: "aa" },
    { key: "aa_coding_index", label: "AA Coding Index", source: "aa" },
    { key: "aa_agentic_index", label: "AA Agentic Index", source: "aa" },
    {
      key: "aa_intelligence_index",
      label: "AA Intelligence Index",
      source: "aa",
    },
  ];
  const PREFERRED_EPOCH_BENCHMARK_SLUGS =
    window.__preferredEpochBenchmarkSlugs || [];
  const EPOCH_BENCHMARK_LABELS = window.__epochBenchmarkLabels || {};
  const preferredEpochBenchmarkRank = new Map(
    PREFERRED_EPOCH_BENCHMARK_SLUGS.map((slug, index) => [slug, index]),
  );

  const sortEpochBenchmarksByValue = (benchmarks) =>
    [...(benchmarks ?? [])].sort((a, b) => {
      const aRank = preferredEpochBenchmarkRank.get(a.slug) ?? Number.POSITIVE_INFINITY;
      const bRank = preferredEpochBenchmarkRank.get(b.slug) ?? Number.POSITIVE_INFINITY;
      if (aRank !== bRank) return aRank - bRank;
      return String(a.name || a.slug).localeCompare(String(b.name || b.slug));
    });
  const grid = document.getElementById("models-grid");
  const tableBody = document.getElementById("models-table-body");
  const tableContainer = document.getElementById("models-table-container");
  const searchInput = document.getElementById("model-search");
  const sortSelect = document.getElementById("model-sort");
  const sortDirectionSelect = document.getElementById("model-sort-direction");
  const loadMoreBtn = document.getElementById("load-more-models");
  const visibleCountEl = document.getElementById("visible-model-count");
  const totalCountEl = document.getElementById("total-models-count");
  const heroCountEl = document.getElementById("hero-model-count");
  const summaryAvgInputEl = document.getElementById("summary-avg-input");
  const summaryAvgOutputEl = document.getElementById("summary-avg-output");
  const topMmluNameEl = document.getElementById("top-mmlu-name");
  const topMmluScoreEl = document.getElementById("top-mmlu-score");
  const topEciNameEl = document.getElementById("top-eci-name");
  const topEciScoreEl = document.getElementById("top-eci-score");
  const cheapestNameEl = document.getElementById("cheapest-blended-name");
  const cheapestPriceEl = document.getElementById("cheapest-blended-price");
  const epochModelsCountEl = document.getElementById("epoch-models-count");
  const epochBenchmarksCountEl = document.getElementById(
    "epoch-benchmarks-count",
  );
  const epochRunsCountEl = document.getElementById("epoch-runs-count");
  const dataUpdatedEl = document.getElementById("data-updated-at");
  const metricSelect = document.getElementById("leaderboard-metric");
  const leaderboardPanels = document.getElementById("leaderboard-panels");
  const leaderboardAttribution = document.getElementById(
    "leaderboard-attribution",
  );
  const leaderboardCompareLink = document.getElementById(
    "leaderboard-compare-link",
  );
  const familySearchInput = document.getElementById("leaderboard-family-search");
  const familyModeSelect = document.getElementById("leaderboard-family-mode");
  const reasoningFilters = Array.from(document.querySelectorAll("[data-leaderboard-reasoning]"));
  const leaderboardVisibleCounts = new Map();
  const leaderboardFooter = (key, shown, total) => `<div class="flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted"><span>Showing ${shown} of ${total} ranked results${shown>100?" · Compare opens the first 100": ""}</span><span class="flex items-center gap-3">${shown < total ? `<button type="button" class="underline underline-offset-2" data-leaderboard-more="${escapeHtml(key)}">Show more</button>` : ""}${shown > 5 ? `<button type="button" class="underline underline-offset-2" data-leaderboard-less="${escapeHtml(key)}">Show fewer</button>` : ""}</span></div>`;
  const openRouterRankSelect = document.getElementById(
    "openrouter-rank-metric",
  );
  const openRouterProviderBoard = document.getElementById(
    "openrouter-provider-board",
  );
  const openRouterBoardTitle = document.getElementById(
    "openrouter-board-title",
  );
  const openRouterBoardNote = document.getElementById("openrouter-board-note");
  const openRouterColDetail = document.getElementById("openrouter-col-detail");
  const openRouterColValue = document.getElementById("openrouter-col-value");
  const publicCatalogNotice = document.getElementById(
    "openrouter-catalog-notice",
  );
  const publicCatalogRetry = document.getElementById(
    "openrouter-catalog-retry",
  );
  const setPublicCatalogNotice = (visible) => {
    if (publicCatalogNotice) publicCatalogNotice.hidden = !visible;
    // A select whose options describe data that never arrived is not usable.
    if (openRouterRankSelect) openRouterRankSelect.disabled = visible;
  };
  publicCatalogRetry?.addEventListener("click", () => {
    publicCatalogRetry.disabled = true;
    setPublicCatalogNotice(false);
    void loadPublicCatalogData()
      .then(() => { if (isCurrentDashboard()) renderOpenRouterProviderLeaderboard(); })
      .finally(() => {
        if (isCurrentDashboard()) publicCatalogRetry.disabled = false;
      });
  }, lifecycle);
  const emptyState = document.getElementById("empty-state");
  const viewCardsBtn = document.getElementById("view-cards");
  const viewTableBtn = document.getElementById("view-table");
  const sortDirectionIndicator = document.getElementById(
    "sort-direction-indicator",
  );

  let browserModels=null;
  let currentVisible = PAGE_SIZE;
  let matchedTotal = 0;
  let currentView = "cards";
  let focusedCardIndex = -1;
  let publicCatalogLoadPromise = null;
  let latestLeaderboardModels = window.__leaderboardInitialModels || [];
  let latestEpochBenchmarks = window.__epochInitialBenchmarks || [];
  let latestEpochRuns = window.__epochInitialRuns || [];
  let latestEpochModelNames = window.__epochModelNames || {};
  let epochLeaderboardTotals = { ...(window.__epochLeaderboardTotals || {}) };
  const epochRanking = createEpochRankingController({
    revision: window.__epochRankingRevision,
    benchmarks: latestEpochBenchmarks,
    runs: latestEpochRuns,
    modelNames: latestEpochModelNames,
    totals: epochLeaderboardTotals,
    fetchedAt: window.__epochCorpusFetchedAt ?? null,
  });
  const syncEpochRankingView = () => {
    const view = epochRanking.view();
    latestEpochBenchmarks = preferPublisherBenchmarks(view.benchmarks);
    latestEpochRuns = view.runs;
    latestEpochModelNames = view.modelNames;
    epochLeaderboardTotals = { ...view.totals };
  };
  const epochRankingNotice = () => ({
    loading: "Loading full benchmark ranking…",
    failed: "Full benchmark ranking could not load. Retry Show more.",
  })[epochRanking.status()] ?? "";
  const epochRankingTotal = (key, available) => Math.max(available, Number(epochLeaderboardTotals[key]) || 0);

  const loadPublicCatalogData = () => {
    if (window.__aistatsPublicCatalogLoaded) return Promise.resolve();
    if (publicCatalogLoadPromise) return publicCatalogLoadPromise;

    const url = window.__aistatsCatalogDataUrl;
    if (!url) return Promise.resolve();

    publicCatalogLoadPromise = fetch(url, { cache: "force-cache", signal: lifecycle.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Public catalog request failed with ${response.status}`);
        }
        return response.json();
      })
      .then((catalogs) => {
        if (!isCurrentDashboard()) return;
        setPublicCatalogNotice(false);
        window.__aistatsOpenRouterModels = catalogs.openRouterModels || [];
        window.__aistatsHuggingFaceModels = catalogs.huggingFaceModels || [];
        window.__aistatsLiteLlmModels = catalogs.liteLlmModels || [];
        window.__aistatsOpenRouterUsageRankings =
          catalogs.openRouterUsageRankings || [];
        window.__aistatsOpenRouterEndpointSummaries =
          catalogs.openRouterEndpointSummaries || [];
        window.__aistatsPublicCatalogLoaded = true;
      })
      .catch((error) => {
        // Drop the cached promise so the retry control can refetch.
        publicCatalogLoadPromise = null;
        if (isCurrentDashboard()) setPublicCatalogNotice(true);
        console.warn("Failed to load public catalog data", error);
      });

    return publicCatalogLoadPromise;
  };

  const updateLeaderboardCompareLink = () => {
    if (!leaderboardCompareLink || !metricSelect) return;
    const panel = Array.from(leaderboardPanels?.querySelectorAll("[data-metric]") || [])
      .find((candidate) => candidate.dataset.metric === metricSelect.value);
    setLeaderboardCompareAction(leaderboardCompareLink,panel?.dataset.compareHref||null);
  };

  const METRIC_ATTRIBUTIONS = window.__benchmarkAttributions || {};
  const renderAttributionText = (metricKey) => {
    const attribution =
      METRIC_ATTRIBUTIONS[metricKey] ||
      (metricKey?.startsWith("epoch_")
        ? {
            sourceName: "Epoch AI Benchmarking Hub",
            sourceUrl: "https://epoch.ai/benchmarks",
          }
        : null);
    if (!leaderboardAttribution || !attribution) return;

    const sourceName = escapeHtml(attribution.sourceName || "Source");
    const sourceUrl = escapeHtml(attribution.sourceUrl || "#");
    const viaName = escapeHtml(attribution.viaName || "");
    const viaUrl = escapeHtml(attribution.viaUrl || "");
    const viaText =
      viaName && viaUrl
        ? ` via <a href="${viaUrl}" target="_blank" rel="noopener noreferrer" class="text-text underline decoration-highlight-med/70 underline-offset-4">${viaName}</a>`
        : "";

    leaderboardAttribution.innerHTML = `Source: <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-text underline decoration-highlight-med/70 underline-offset-4">${sourceName}</a>${viaText}`;
  };

  const ensureEpochAttribution = (key, benchmark, runs) => {
    if (METRIC_ATTRIBUTIONS[key]) return;
    const source = (runs || [])
      .filter((run) => run.benchmark_slug === benchmark.slug)
      .map((run) => ({
        sourceName: cleanSourceName(run.source_name),
        sourceUrl:
          cleanSourceUrl(run.source_link) ?? cleanSourceUrl(run.source_name),
      }))
      .find((candidate) => candidate.sourceName || candidate.sourceUrl);
    METRIC_ATTRIBUTIONS[key] = {
      sourceName:
        source?.sourceName ||
        `${EPOCH_BENCHMARK_LABELS[benchmark.slug] || benchmark.name} source`,
      sourceUrl: source?.sourceUrl || "https://epoch.ai/benchmarks",
      viaName: "Epoch AI Benchmarking Hub",
      viaUrl: "https://epoch.ai/benchmarks",
    };
  };

  const drawerModelCache = new Map();
  const drawerModelRequests = new Map();
  const registerDrawerModels = (models) => {
    (models || []).forEach((model) => {
      if (!model?.id) return;
      drawerModelCache.set(String(model.id), toDrawerModel(model));
    });
  };
  const loadDrawerModel = (id) => {
    const existingRequest = drawerModelRequests.get(id);
    if (existingRequest) return existingRequest;

    const request = fetch(`/api/models/${encodeURIComponent(id)}.json`, { signal: lifecycle.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Model detail request failed with ${response.status}`);
        }
        return response.json();
      })
      .then((model) => {
        registerDrawerModels(model ? [model] : []);
        return drawerModelCache.get(String(id)) || null;
      })
      .catch((error) => {
        console.warn("Failed to load model detail payload", error);
        return null;
      })
      .finally(() => {
        drawerModelRequests.delete(id);
      });

    drawerModelRequests.set(id, request);
    return request;
  };
  const resolveDrawerModel = async (element) => {
    const modelJson = element?.dataset?.modelJson;
    if (modelJson) {
      try {
        const model = JSON.parse(modelJson);
        if (model?.id) drawerModelCache.set(String(model.id), model);
        return model;
      } catch (error) {
        console.warn("Failed to parse model payload", error);
      }
    }

    const id = element?.dataset?.modelId;
    if (!id) return null;
    const cached = drawerModelCache.get(String(id));
    if (cached) return cached;
    return loadDrawerModel(String(id));
  };

  const sortAttrMap = {
    intelligence: "intelligence",
    mmlu: "mmlu",
    gpqa: "gpqa",
    hle: "hle",
    aime: "aime",
    inputPrice: "inputPrice",
    outputPrice: "outputPrice",
    tps: "tps",
  };

  const getCards = () =>
    Array.from(document.querySelectorAll("[data-model-card]"));
  const getTableRows = () =>
    Array.from(document.querySelectorAll("[data-table-row]"));

  const getValidModels = (models) => selectBrowserModels(models ?? []);

  const {renderOpenRouterProviderLeaderboard, bindOpenRouterProviderRows} = createOpenRouterBoard({
    openRouterRankSelect,
    openRouterProviderBoard,
    openRouterBoardTitle,
    openRouterBoardNote,
    openRouterColDetail,
    openRouterColValue,
    searchInput,
    // Declared further down this closure; wrapped so they resolve at call time.
    applySearch: (...args) => applySearch(...args),
    setView: (...args) => setView(...args),
    openModelDrawerFromElement: (...args) => openModelDrawerFromElement(...args),
  });

  const getVisibleCards = () =>
    getCards().filter((card) => card.style.display !== "none");

  const updateModelCounts = (models) => {
    const count = models.length;
    if (heroCountEl) heroCountEl.textContent = String(count);
    if (totalCountEl) totalCountEl.textContent = String(count);
  };

  // Keep the provenance stamp honest when the client-side refresh pulls data
  // newer than the build. Never moves the date backwards.
  const updateDataFreshness = (models) => {
    if (!dataUpdatedEl) return;
    let newest = 0;
    models.forEach((model) => {
      const seen = Date.parse(model?.last_seen ?? "");
      if (Number.isFinite(seen) && seen > newest) newest = seen;
    });
    if (!newest) return;

    const updated = new Date(newest);
    const nextIso = updated.toISOString().slice(0, 10);
    // ISO dates compare lexicographically, so this also skips same-day rewrites.
    if (nextIso <= (dataUpdatedEl.getAttribute("datetime") ?? "")) return;

    dataUpdatedEl.setAttribute("datetime", nextIso);
    dataUpdatedEl.textContent = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(updated);
  };

  const updateSummaryStats = (models) => {
    const total = models.length || 1;
    const avgInput =
      models.reduce(
        (sum, m) => sum + (Number(m.price_1m_input_tokens) || 0),
        0,
      ) / total;
    const avgOutput =
      models.reduce(
        (sum, m) => sum + (Number(m.price_1m_output_tokens) || 0),
        0,
      ) / total;
    if (summaryAvgInputEl)
      summaryAvgInputEl.textContent = formatPrice(avgInput, 3);
    if (summaryAvgOutputEl)
      summaryAvgOutputEl.textContent = formatPrice(avgOutput, 3);
  };

  const updateTopStrip = (models, epochModels, epochBenchmarks, epochRuns) => {
    const topAaAverageModel = findAaComparableCoverageLeader(models);

    const topEciModel =
      [...(epochModels ?? [])]
        .filter((model) => hasFiniteMetricValue(model?.eci_score))
        .sort((a, b) => Number(b.eci_score) - Number(a.eci_score))[0] ?? null;

    const cheapestBlended =
      [...models]
        .filter((m) => Number(m.price_1m_blended_3_to_1) > 0)
        .sort(
          (a, b) =>
            Number(a.price_1m_blended_3_to_1) -
            Number(b.price_1m_blended_3_to_1),
        )[0] ?? null;

    if (topMmluNameEl)
      topMmluNameEl.textContent = topAaAverageModel
        ? toDisplayName(topAaAverageModel.model?.name)
        : "-";
    if (topMmluScoreEl)
      topMmluScoreEl.textContent = topAaAverageModel
        ? `${formatScore(topAaAverageModel.avgScore)} avg`
        : "N/A";
    if (topEciNameEl)
      topEciNameEl.textContent = topEciModel
        ? toDisplayName(topEciModel.display_name || topEciModel.model_name)
        : "-";
    if (topEciScoreEl)
      topEciScoreEl.textContent =
        topEciModel && hasFiniteMetricValue(topEciModel.eci_score)
            ? `${Number(topEciModel.eci_score).toFixed(1)} ECI`
            : "N/A";
    if (cheapestNameEl)
      cheapestNameEl.textContent = cheapestBlended
        ? toDisplayName(cheapestBlended.name)
        : "-";
    if (cheapestPriceEl) {
      cheapestPriceEl.textContent = cheapestBlended
        ? formatPrice(cheapestBlended.price_1m_blended_3_to_1, 3)
        : "";
    }

    if (Array.isArray(epochRuns) && epochRunsCountEl) {
      epochRunsCountEl.textContent = `${epochRuns.length} benchmark runs`;
    }
    if (epochBenchmarksCountEl) {
      const scoredBenchmarkSlugs = new Set(
        (epochRuns ?? [])
          .filter((run) => run.benchmark_slug && run.score !== null)
          .map((run) => String(run.benchmark_slug)),
      );
      const benchmarkCount = (epochBenchmarks ?? []).filter((benchmark) =>
        scoredBenchmarkSlugs.has(benchmark.slug),
      ).length;
      epochBenchmarksCountEl.textContent = `${benchmarkCount} benchmarks`;
    }
    if (Array.isArray(epochRuns) && epochModelsCountEl) {
      const modelCount = Array.isArray(epochModels) && epochModels.length
        ? epochModels.length
        : new Set(
            epochRuns
              .map((run) => String(run.model_version || "").trim())
              .filter(Boolean),
          ).size;
      epochModelsCountEl.textContent = String(modelCount);
    }
  };

  const getLeaderboardFilters = () => ({
    query: familySearchInput?.value ?? "",
    reasoning: reasoningFilters.filter((input) => input.checked).map((input) => input.value),
    mode: familyModeSelect?.value === "variants" ? "variants" : "families",
  });
  const buildTopByBenchmark = (models, epochBenchmarks, epochRuns, epochModelNames = latestEpochModelNames) => {
    const topByBenchmark = {};
    const familiesByBenchmark = {};
    const aaConfigs = [];
    const epochConfigs = [];

    AA_BENCHMARKS.forEach((config) => {
      const groups = rankModelFamilies(models, config.key, {...getLeaderboardFilters()});
      const list = groups.map((group) => group.best);
      if (!rankModelFamilies(models, config.key, {limit:1}).length) return;
      topByBenchmark[config.key] = list;
      familiesByBenchmark[config.key] = groups;
      aaConfigs.push(config);
    });

    sortEpochBenchmarksByValue(preferPublisherBenchmarks(epochBenchmarks)).forEach((benchmark) => {
      buildBenchmarkCohorts(benchmark,epochRuns).forEach(cohort=>{
      const key=cohort.key;
      const list=resolveEpochLeaderboardRunNames(cohort.runs, epochModelNames).map((run) => ({
          name: run.name,
          company_name: run.organization ?? "Unknown provider",
          score: parseFiniteMetricValue(run.score) ?? 0,
          score_metric: run.score_metric,
          source_key: run.source_key,
          metric_key:cohort.metricKey,
          higher_is_better:cohort.higherIsBetter,
          score_unit: run.score_unit ?? 'native',
          model_version: run.model_version,
          benchmark_version: run.benchmark_version ?? null,
          conditions: run.conditions ?? null,
      }));
      if (!list.length) return;
      ensureEpochAttribution(key, benchmark, epochRuns);
      topByBenchmark[key] = list;
      epochConfigs.push({
        key,
        label: cohort.label,
        source: "epoch",
        scoreMetric: list[0]?.score_metric ?? null,
      });
      });
    });

    return {
      benchmarkConfigs: [...aaConfigs, ...epochConfigs],
      topByBenchmark,
      familiesByBenchmark,
    };
  };

  const leaderboardPanelMarkup = (list, config, groups = []) => {
    const rankColors = ["lbb1", "lbb2", "lbb3", "lbbx", "lbbx"];
    const getScore = (model) => parseFiniteMetricValue(model[config.key]) ?? 0;
    const scoreText = (score) => config.key.startsWith("aa_") ? formatIndex(score) : formatScore(score);
    const rows = list.map((model, index) => {
      const score = getScore(model);
      const group = groups.find((candidate) => candidate.best.id === model.id);
      const extra = group?.variants.filter((variant) => variant.id !== model.id) ?? [];
      const name = escapeHtml(toDisplayName(model.name));
      const company = escapeHtml(toDisplayName(model.company_name ?? model.creator_name, "Unknown provider"));
      const details = extra.length ? `<details class="leaderboard-variants"><summary>+${extra.length} measured variants</summary><ul>${extra.map((variant) => `<li><a href="/compare?${new URLSearchParams({chart:"benchmark",metric:config.key,m:variant.id})}">${escapeHtml(toDisplayName(variant.name))}<span>${scoreText(getScore(variant))}</span></a></li>`).join("")}</ul></details>` : "";
      return `<li class="lbi"><button type="button" class="lr" data-lr data-model-id="${escapeHtml(model.id)}"><div class="lbb ${rankColors[index] ?? "lbbx"}" style="--w:${leaderboardBarWidth(score,list.map(getScore),true)}%;--row-index:${index}"></div><div class="lbr"><div class="lrw"><div class="lrn ${index<3?`lrn${index+1}`:"lrnx"}">${index+1}</div></div><div class="lbm"><div class="lbml"><span class="lbn ${index===0?"lbnt":"lbnx"}">${name}</span></div><div class="lbc">${company}</div></div><div class="lbs ${index===0?"score-high":index<3?"lbsp":"lbsx"}">${scoreText(score)}</div></div></button>${details}</li>`;
    }).join("");
    const params = new URLSearchParams({chart:"benchmark",metric:config.key});
    list.slice(0, 100).forEach((model) => params.append("m", model.id));
    return {rows, compareHref:list.length?`/compare?${params.toString()}`:""};
  };

  const renderAaLeaderboardPanels = (models) => {
    if (!leaderboardPanels) return;
    const filters = getLeaderboardFilters();
    AA_BENCHMARKS.forEach((config) => {
      const panel = Array.from(leaderboardPanels.querySelectorAll('[data-metric]')).find((candidate) => candidate.dataset.metric === config.key);
      if (!panel) return;
      const groups = rankModelFamilies(models, config.key, {...filters});
      const allList = groups.map((group) => group.best);
      const list = visibleLeaderboardRows(allList, leaderboardVisibleCounts.get(config.key) ?? 5);
      const {rows,compareHref} = leaderboardPanelMarkup(list,config,groups);
      panel.dataset.compareHref = compareHref;
      panel.innerHTML = list.length ? `<ul class="divide-y divide-highlight-low/40">${rows}</ul>${leaderboardFooter(config.key,list.length,allList.length)}` : `<p class="leaderboard-empty">No measured models match these filters.</p>`;
    });
    bindLeaderboardRows();
    updateLeaderboardCompareLink();
    playBarFill(getActiveLeaderboardPanel());
  };

  const reducedMotionQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  const prefersReducedMotion = () => Boolean(reducedMotionQuery?.matches);

  // Animate the visible leaderboard panel's bars 0 -> --w.
  const playBarFill = (panel) => {
    if (!panel) return;
    const bars = panel.querySelectorAll(".lbb");
    if (!bars.length) return;
    if (prefersReducedMotion()) {
      panel.classList.add("leaderboard-revealed");
      return;
    }
    // Reset to collapsed, force reflow, then grow.
    panel.classList.remove("leaderboard-revealed");
    void panel.offsetWidth;
    panel.classList.add("leaderboard-revealed");
  };

  const getActiveLeaderboardPanel = () =>
    leaderboardPanels?.querySelector("[data-metric]:not([hidden])") || null;

  const renderLeaderboard = (models, epochBenchmarks, epochRuns) => {
    if (!metricSelect || !leaderboardPanels) return;
    latestEpochBenchmarks = epochBenchmarks ?? [];
    latestEpochRuns = epochRuns ?? [];

    const selectedMetric = metricSelect.value || "mmlu_pro";
    const { benchmarkConfigs, topByBenchmark, familiesByBenchmark } = buildTopByBenchmark(
      models,
      epochBenchmarks ?? [],
      epochRuns ?? [],
      latestEpochModelNames,
    );

    metricSelect.innerHTML = benchmarkConfigs
      .map(
        (config) =>
          `<option value="${escapeHtml(config.key)}">${escapeHtml(config.label)}</option>`,
      )
      .join("");

    const fallbackMetric = benchmarkConfigs[0]?.key ?? "mmlu_pro";
    metricSelect.value = benchmarkConfigs.some(
      (config) => config.key === selectedMetric,
    )
      ? selectedMetric
      : fallbackMetric;

    leaderboardPanels.innerHTML = benchmarkConfigs
      .map((config) => {
        const allList = topByBenchmark[config.key] ?? [];
        const list = visibleLeaderboardRows(allList, leaderboardVisibleCounts.get(config.key) ?? 5);
        const isEpoch = config.source === "epoch";
        if (!isEpoch) {
          const {rows,compareHref}=leaderboardPanelMarkup(list,config,familiesByBenchmark[config.key]??[]);
          const hiddenAttr = config.key === metricSelect.value ? "" : " hidden";
          return `<div data-metric="${escapeHtml(config.key)}" data-compare-href="${escapeHtml(compareHref)}" class="overflow-hidden border border-highlight-low/60"${hiddenAttr}>${list.length?`<ul class="divide-y divide-highlight-low/40">${rows}</ul>${leaderboardFooter(config.key,list.length,allList.length)}`:`<p class="leaderboard-empty">No measured models match these filters.</p>`}</div>`;
        }
        if (!list.length) return "";

        const getScore = (model) =>
          parseFiniteMetricValue(
            isEpoch ? model.score : model[config.key],
          ) ?? 0;
        const formatBenchmarkScore = (score, model) => {
          if (!Number.isFinite(score)) return "N/A";
          if (!isEpoch) return config.key.startsWith("aa_") ? formatIndex(score) : formatScore(score);
          if (model.score_unit === 'fraction') return `${(score * 100).toFixed(1)}%`;
          if (model.score_unit === 'percent') return `${score.toFixed(1)}%`;
          return score.toLocaleString('en-US',{maximumFractionDigits:3});
        };
        const rankColors = [
          "lbb1",
          "lbb2",
          "lbb3",
          "lbbx",
          "lbbx",
        ];

        const visibleList = visibleLeaderboardRows(allList, leaderboardVisibleCounts.get(config.key) ?? 5);
        const rows = visibleList
          .map((model, index) => {
            const score = getScore(model);
            const barWidth = leaderboardBarWidth(score,list.map(getScore),model.higher_is_better!==false);
            const scoreText = formatBenchmarkScore(score, model);
            const name = escapeHtml(toDisplayName(model.name));
            const company = escapeHtml(
              benchmarkRunSettings(model)||toDisplayName(model.company_name, "Unknown provider"),
            );
            const rowAction = isEpoch
              ? `data-compare-href="${escapeHtml(benchmarkRecordHref(model,model.metric_key??config.key))}"`
              : `data-model-id="${escapeHtml(model.id)}"`;
            const rankBadge =
              index === 0
                ? '<div class="lrn lrn1">1</div>'
                : index === 1
                  ? '<div class="lrn lrn2">2</div>'
                  : index === 2
                    ? '<div class="lrn lrn3">3</div>'
                    : `<div class="lrn lrnx">${index + 1}</div>`;

            return `
              <li class="lbi">
                <button type="button" class="lr" data-lr ${rowAction}>
                  <div class="lbb ${rankColors[index] ?? "lbbx"}" style="--w:${barWidth}%;--row-index:${index}"></div>
                  <div class="lbr">
                    <div class="lrw">${rankBadge}</div>
                    <div class="lbm">
                      <div class="lbml">
                        <span class="lbn ${index === 0 ? "lbnt" : "lbnx"}">${name}</span>
                      </div>
                      <div class="lbc">${company}</div>
                    </div>
                    <div class="lbs ${index === 0 ? "score-high" : index < 3 ? "lbsp" : "lbsx"}">${scoreText}</div>
                  </div>
                </button>
              </li>
            `;
          })
          .join("");

        const hiddenAttr = config.key === metricSelect.value ? "" : " hidden";
        const epochCatalog=visibleList.map(leaderboardRunCatalogRecord);
        const compareHref=leaderboardComparisonHref(visibleList.slice(0,100).map(model=>benchmarkRecordHref(model,model.metric_key??config.key)),epochCatalog);
        const totalCount = epochRankingTotal(config.key, allList.length);
        const rankingStatus = epochRankingNotice();
        const rankingNotice = config.key === metricSelect.value && rankingStatus
          ? `<p class="px-3 py-2 text-xs text-muted" role="status">${escapeHtml(rankingStatus)}</p>`
          : "";
        return `
          <div data-metric="${escapeHtml(config.key)}" data-compare-href="${escapeHtml(compareHref)}" class="overflow-hidden border border-highlight-low/60"${hiddenAttr}>
            <ul class="divide-y divide-highlight-low/40">${rows}</ul>${rankingNotice}${leaderboardFooter(config.key,visibleList.length,totalCount)}
          </div>
        `;
      })
      .join("");

    // Keep metric select and panel set in lockstep.
    const panelKeys = new Set(
      Array.from(document.querySelectorAll("[data-metric]"))
        .map((el) => el.getAttribute("data-metric"))
        .filter(Boolean),
    );
    Array.from(metricSelect.options).forEach((option) => {
      if (!panelKeys.has(option.value)) option.remove();
    });
    if (!panelKeys.has(metricSelect.value)) {
      metricSelect.value = metricSelect.options[0]?.value ?? "mmlu_pro";
    }
    setLeaderboardFamilyControlsDisabled(document.getElementById("leaderboard-family-controls"),metricSelect.value.startsWith("epoch_"));
    updateLeaderboardCompareLink();
    renderAttributionText(metricSelect.value);

    setLeaderboardPanel(Array.from(leaderboardPanels.querySelectorAll("[data-metric]")),metricSelect.value);
    bindLeaderboardRows();
    // Replay the fill on the freshly rendered active panel.
    playBarFill(getActiveLeaderboardPanel());
  };

  const openModelDrawerFromElement = async (element) => {
    const model = await resolveDrawerModel(element);
    if (!isCurrentDashboard()) return;
    if (model) {
      window.dispatchEvent(new CustomEvent("open-model-drawer", { detail: model }));
      return;
    }
    const id = element?.dataset?.modelId;
    if (!id) return;
    lastDrawerTrigger = element;
    window.dispatchEvent(
      new CustomEvent("model-drawer-error", {
        detail: { id: String(id), label: describeModelRow(element) },
      }),
    );
  };

  // The drawer's retry control asks for the same model again.
  const handleDrawerRetry = (event) => {
    const id = event?.detail?.id;
    if (!id) return;
    const element =
      (lastDrawerTrigger && lastDrawerTrigger.dataset?.modelId === String(id)
        ? lastDrawerTrigger
        : null) ||
      document.querySelector(`[data-model-id="${CSS.escape(String(id))}"]`);
    if (!element) return;
    void openModelDrawerFromElement(element);
  };
  window.addEventListener("retry-model-drawer", handleDrawerRetry, lifecycle);

  let lastDrawerTrigger = null;

  const describeModelRow = (element) => {
    const explicit = element.dataset.cardLabel;
    if (explicit) return explicit;
    const name =
      element.querySelector("h3")?.textContent?.trim() ||
      element.querySelector("td")?.textContent?.trim() ||
      element.dataset.name ||
      "this model";
    const provider =
      element.querySelector("h3")?.parentElement?.querySelector("p")?.textContent?.trim() ||
      element.querySelector("td + td")?.textContent?.trim() ||
      element.dataset.company ||
      "";
    return provider ? `${name}, ${provider}` : name;
  };

  const bindCardFocus = () => {
    getCards().forEach((card) => {
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute(
        "aria-label",
        `Open details for ${describeModelRow(card)}`,
      );
      card.addEventListener("focus", () => {
        focusedCardIndex = getVisibleCards().indexOf(card);
      });
      if (card.dataset.drawerBound === "true") return;
      card.dataset.drawerBound = "true";
      card.addEventListener("click", () => void openModelDrawerFromElement(card));
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        void openModelDrawerFromElement(card);
      });
    });
  };

  const bindTableRows = () => {
    getTableRows().forEach((row) => {
      row.setAttribute("tabindex", "0");
      row.setAttribute("role", "button");
      row.setAttribute(
        "aria-label",
        `Open details for ${describeModelRow(row)}`,
      );
      if (row.dataset.drawerBound === "true") return;
      row.dataset.drawerBound = "true";
      row.addEventListener("click", () => void openModelDrawerFromElement(row));
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        void openModelDrawerFromElement(row);
      });
    });
  };

  const openLeaderboardRow = (row) => {
    if (row.dataset.compareHref?.startsWith("/compare?")) {window.location.href=row.dataset.compareHref;return;}
    if (row.dataset.modelId || row.dataset.modelJson) {
      void openModelDrawerFromElement(row);
      return;
    }
    const metric = row.closest("[data-metric]")?.dataset?.metric;
    const modelName =
      row.querySelector("[title]")?.getAttribute("title") ||
      row.querySelector(".truncate")?.textContent?.trim() ||
      "";
    if (metric && modelName) {
      window.location.href = `/compare?metric=${encodeURIComponent(metric)}&model=${encodeURIComponent(modelName)}`;
    }
  };

  const bindLeaderboardRows = () => {
    document.querySelectorAll("[data-lr]").forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      if (row.dataset.leaderboardBound === "true") return;
      row.dataset.leaderboardBound = "true";
      row.addEventListener("click", () => openLeaderboardRow(row));
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openLeaderboardRow(row);
      });
    });
  };

  const updateVisibility = () => {
    let visible = 0;
    getCards().forEach((card) => {
      const match = card.dataset.match === "true";
      if (match && visible < currentVisible) {
        card.style.display = "";
        visible += 1;
      } else {
        card.style.display = "none";
      }
    });

    if (visibleCountEl) visibleCountEl.textContent = String(visible);
    if (loadMoreBtn) loadMoreBtn.hidden = visible >= matchedTotal;
    if (grid && currentView === "cards")
      grid.style.display = matchedTotal === 0 ? "none" : "";
    if (emptyState) emptyState.classList.toggle("hidden", matchedTotal > 0);
  };

  const applyTableSearch = () => {
    const q = (searchInput?.value || "").toLowerCase().trim();
    getTableRows().forEach((row) => {
      const name = row.dataset.name || "";
      const company = row.dataset.company || "";
      row.style.display =
        !q || name.includes(q) || company.includes(q) ? "" : "none";
    });
  };

  const applySearch = (resetVisible = false) => {
    if (resetVisible) currentVisible = PAGE_SIZE;
    const q = (searchInput?.value || "").toLowerCase().trim();
    if(browserModels&&grid&&tableBody){
      const page=browserPage(browserModels,q,sortSelect?.value??'intelligence',sortDirectionSelect?.value??'desc',currentVisible);
      matchedTotal=page.total;
      if(totalCountEl)totalCountEl.textContent=String(page.total);
      grid.innerHTML=page.rows.map(createCardMarkup).join('');
      tableBody.innerHTML=page.rows.map(createTableRowMarkup).join('');
      getCards().forEach(card=>{card.dataset.match='true';});
      bindCardFocus();bindTableRows();updateVisibility();
      return;
    }
    matchedTotal = 0;

    getCards().forEach((card) => {
      const name = card.dataset.name || "";
      const company = card.dataset.company || "";
      const match = !q || name.includes(q) || company.includes(q);
      card.dataset.match = match ? "true" : "false";
      if (match) matchedTotal += 1;
    });

    updateVisibility();
    if (currentView === "table") applyTableSearch();
  };

  const sortCards = () => {
    if (!grid) return;
    const metric = sortSelect?.value || "intelligence";
    const direction = sortDirectionSelect?.value || "desc";
    const attr = sortAttrMap[metric] ?? "intelligence";

    // Reflect the active sort direction in the rotating glyph.
    sortDirectionIndicator?.classList.toggle("is-asc", direction === "asc");
    if(browserModels){applySearch(true);return;}

    const cards = getCards();
    cards.sort((a, b) => {
      return compareOptionalMetricValues(a.dataset[attr], b.dataset[attr], direction)
        || (a.dataset.name ?? '').localeCompare(b.dataset.name ?? '');
    });
    cards.forEach((card) => grid.appendChild(card));

    const rows = getTableRows();
    rows.sort((a, b) => {
      return compareOptionalMetricValues(a.dataset[attr], b.dataset[attr], direction)
        || (a.dataset.name ?? '').localeCompare(b.dataset.name ?? '');
    });
    rows.forEach((row) => tableBody?.appendChild(row));

    applySearch(true);
  };

  // Run `cb` once: on the element's opacity transitionend, or after a failsafe
  // timeout if it never fires (interrupted/canceled). Shared by the view and
  // leaderboard-metric crossfades below.
  const FAILSAFE_VIEW_SWAP_MS = 260;
  const onceAfterFade = (el, timeoutMs, cb) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      el.removeEventListener("transitionend", onEnd);
      lifecycle.signal.removeEventListener("abort", finish);
      if (isCurrentDashboard()) cb();
    };
    const onEnd = (event) => {
      if (event.propertyName === "opacity") finish();
    };
    el.addEventListener("transitionend", onEnd);
    // finish only runs from these async callbacks, after timer is assigned.
    const timer = window.setTimeout(finish, timeoutMs);
    lifecycle.signal.addEventListener("abort", finish, { once: true });
  };

  // Crossfade between two view containers. updateVisibility/setView still own
  // each container's final display; this only animates the transition.
  const swapView = (fromEl, toEl, onShown) => {
    const showTarget = () => {
      if (toEl) {
        toEl.classList.remove("hidden");
        toEl.classList.remove("view-leaving");
      }
      onShown?.();
      if (!toEl || prefersReducedMotion()) {
        toEl?.classList.remove("view-entering");
        return;
      }
      toEl.classList.add("view-entering");
      void toEl.offsetWidth;
      toEl.classList.remove("view-entering");
    };

    if (prefersReducedMotion() || !fromEl) {
      fromEl?.classList.add("hidden");
      fromEl?.classList.remove("view-leaving", "view-entering");
      showTarget();
      return;
    }

    fromEl.classList.add("view-leaving");
    onceAfterFade(fromEl, FAILSAFE_VIEW_SWAP_MS, () => {
      fromEl.classList.add("hidden");
      fromEl.classList.remove("view-leaving");
      showTarget();
    });
  };

  const applyCardsViewState = () => {
    if (grid) grid.style.display = matchedTotal === 0 ? "none" : "";
    viewCardsBtn?.classList.add("active");
    viewCardsBtn?.setAttribute("aria-pressed", "true");
    viewTableBtn?.classList.remove("active");
    viewTableBtn?.setAttribute("aria-pressed", "false");
    if (loadMoreBtn) loadMoreBtn.style.display = "";
  };

  const applyTableViewState = () => {
    if (grid) grid.style.display = "none";
    viewCardsBtn?.classList.remove("active");
    viewCardsBtn?.setAttribute("aria-pressed", "false");
    viewTableBtn?.classList.add("active");
    viewTableBtn?.setAttribute("aria-pressed", "true");
    if (loadMoreBtn) loadMoreBtn.style.display = browserModels ? "" : "none";
    applyTableSearch();
  };

  const setView = (view) => {
    const previousView = currentView;
    currentView = view;
    const animate = previousView && previousView !== view;

    if (view === "cards") {
      if (animate) {
        swapView(tableContainer, grid, applyCardsViewState);
      } else {
        tableContainer?.classList.add("hidden");
        tableContainer?.classList.remove("view-leaving", "view-entering");
        grid?.classList.remove("hidden", "view-leaving", "view-entering");
        applyCardsViewState();
      }
    } else {
      if (animate) {
        swapView(grid, tableContainer, applyTableViewState);
      } else {
        tableContainer?.classList.remove("hidden", "view-leaving", "view-entering");
        grid?.classList.remove("view-leaving", "view-entering");
        applyTableViewState();
      }
    }
  };

  const renderModels = (models) => {
    if (!grid || !tableBody) return;
    browserModels=models;
    registerDrawerModels(models);
    sortCards();
    setView(currentView);
  };

  metricSelect?.addEventListener("change", () => {
    const metric = metricSelect.value;
    setLeaderboardPanel(Array.from(leaderboardPanels?.querySelectorAll("[data-metric]") ?? []),metric);
    setLeaderboardFamilyControlsDisabled(document.getElementById("leaderboard-family-controls"),metric.startsWith("epoch_"));
    if (!metric.startsWith("epoch_")) renderAaLeaderboardPanels(latestLeaderboardModels);
    updateLeaderboardCompareLink();
    renderAttributionText(metric);
    playBarFill(getActiveLeaderboardPanel());
  });

  familySearchInput?.addEventListener("input", () => renderAaLeaderboardPanels(latestLeaderboardModels));
  familyModeSelect?.addEventListener("change", () => renderAaLeaderboardPanels(latestLeaderboardModels));
  reasoningFilters.forEach((input) => input.addEventListener("change", () => renderAaLeaderboardPanels(latestLeaderboardModels)));
  leaderboardPanels?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-leaderboard-more],[data-leaderboard-less]");
    if (!button) return;
    const key = button.dataset.leaderboardMore ?? button.dataset.leaderboardLess;
    if (!key) return;
    const expand = !button.hasAttribute("data-leaderboard-less");
    if (!expand) leaderboardVisibleCounts.delete(key);
    else leaderboardVisibleCounts.set(key, nextLeaderboardLimit(leaderboardVisibleCounts.get(key) ?? 5));
    if (key.startsWith("aa_")) {
      renderAaLeaderboardPanels(latestLeaderboardModels);
      return;
    }
    const desired = leaderboardVisibleCounts.get(key) ?? 5;
    const available = (buildTopByBenchmark(latestLeaderboardModels, latestEpochBenchmarks, latestEpochRuns).topByBenchmark[key] ?? []).length;
    const total = epochRankingTotal(key, available);
    if (expand && desired > available && available < total) {
      void epochRanking.ensureComplete(lifecycle.signal).then((loaded) => {
        if (!isCurrentDashboard()) return;
        syncEpochRankingView();
        const clamped = visibleCountAfterExpansion({
          key,
          desired,
          loaded,
          available: (buildTopByBenchmark(latestLeaderboardModels, latestEpochBenchmarks, latestEpochRuns).topByBenchmark[key] ?? []).length,
          visibleCounts: leaderboardVisibleCounts,
        });
        if (clamped !== undefined) leaderboardVisibleCounts.set(key, clamped);
        renderLeaderboard(latestLeaderboardModels, latestEpochBenchmarks, latestEpochRuns);
      });
      renderLeaderboard(latestLeaderboardModels, latestEpochBenchmarks, latestEpochRuns);
      return;
    }
    renderLeaderboard(latestLeaderboardModels, latestEpochBenchmarks, latestEpochRuns);
  }, lifecycle);

  openRouterRankSelect?.addEventListener("change", () => {
    void loadPublicCatalogData().then(() => { if (isCurrentDashboard()) renderOpenRouterProviderLeaderboard(); });
  });

  loadMoreBtn?.addEventListener("click", () => {
    currentVisible = Math.min(currentVisible + PAGE_SIZE, matchedTotal);
    if(browserModels)applySearch();else updateVisibility();
  });

  sortSelect?.addEventListener("change", sortCards);
  sortDirectionSelect?.addEventListener("change", sortCards);
  searchInput?.addEventListener("input", () => applySearch(true));
  viewCardsBtn?.addEventListener("click", () => setView("cards"));
  viewTableBtn?.addEventListener("click", () => setView("table"));

  const emptyStateClearBtn = document.getElementById("empty-state-clear");
  emptyStateClearBtn?.addEventListener("click", () => {
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
    applySearch(true);
  });

  document.addEventListener("keydown", (event) => {
    const visibleCards = getVisibleCards();
    if (!visibleCards.length) return;
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const active = document.activeElement;
    const isCardFocused =
      active instanceof HTMLElement &&
      active.matches("[data-model-card]");
    if (!isCardFocused) return;
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    focusedCardIndex = Math.max(
      0,
      Math.min(visibleCards.length - 1, focusedCardIndex + delta),
    );
    visibleCards[focusedCardIndex]?.focus();
  }, lifecycle);

  // Deferred to first scroll-in so bars don't animate during hydration; idempotent via dataset flag.
  const setupLeaderboardReveal = () => {
    const leaderboardSection = document.getElementById("leaderboard");
    if (!leaderboardSection) return;
    if (leaderboardSection.dataset.barRevealBound === "true") return;
    leaderboardSection.dataset.barRevealBound = "true";

    const reveal = () => playBarFill(getActiveLeaderboardPanel());

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          reveal();
          obs.disconnect();
        });
      },
      { threshold: 0.15 },
    );
    observers.add(observer);
    observer.observe(leaderboardSection);
  };

  // Toggle .is-stuck when the sentinel scrolls out; idempotent via dataset flag.
  const setupStickyToolbar = () => {
    const toolbarSentinel = document.getElementById("model-toolbar-sentinel");
    const stickyToolbar = document.getElementById("model-toolbar");
    if (!toolbarSentinel || !stickyToolbar) return;
    if (stickyToolbar.dataset.stickyBound === "true") return;
    stickyToolbar.dataset.stickyBound = "true";

    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          stickyToolbar.classList.toggle("is-stuck", !entry.isIntersecting);
        });
      },
      { threshold: [1] },
    );
    observers.add(observer);
    observer.observe(toolbarSentinel);
  };

  const setupPublicCatalogHydration = () => {
    const catalogSection = document.querySelector(".openrouter-panel");
    if (!(catalogSection instanceof HTMLElement)) return;
    if (catalogSection.dataset.catalogHydrationBound === "true") return;
    catalogSection.dataset.catalogHydrationBound = "true";

    const hydrate = () =>
      loadPublicCatalogData().then(() => { if (isCurrentDashboard()) renderOpenRouterProviderLeaderboard(); });

    if (!("IntersectionObserver" in window)) {
      void hydrate();
      return;
    }

    const catalogObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        catalogObserver.disconnect();
        void hydrate();
      },
      { rootMargin: "400px 0px" },
    );
    observers.add(catalogObserver);
    catalogObserver.observe(catalogSection);
  };

  let browserLoaded=false,browserLoading=false;
  const browserStatus=document.getElementById('model-browser-load-status');
  const browserRetry=document.getElementById('model-browser-retry');
  const browserDisclosure=document.getElementById('model-browser')?.closest('details');
  const loadFullModelBrowser=async()=>{
    if(browserLoaded||browserLoading)return;
    browserLoading=true;
    if(browserStatus){browserStatus.hidden=false;browserStatus.textContent='Loading the full model list…';}
    if(browserRetry)browserRetry.hidden=true;
    try{
      const response=await fetch('/api/model-browser.json',{signal:lifecycle.signal});
      if(!response.ok)throw new Error('Model list unavailable');
      const rows=validateBrowserPayload(await response.json());
      if(!isCurrentDashboard())return;
      updateModelCounts(rows);renderModels(rows);browserLoaded=true;
      if(browserStatus)browserStatus.hidden=true;
    }catch{
      if(lifecycle.signal.aborted)return;
      if(browserStatus)browserStatus.textContent='The full model list could not load. Only the initial preview is shown.';
      if(browserRetry)browserRetry.hidden=false;
    }finally{browserLoading=false;}
  };
  browserDisclosure?.addEventListener('toggle',()=>{if(browserDisclosure.open)void loadFullModelBrowser();},lifecycle);
  browserRetry?.addEventListener('click',()=>void loadFullModelBrowser(),lifecycle);
  if(browserDisclosure?.open)void loadFullModelBrowser();

  bindCardFocus();
  bindTableRows();
  bindLeaderboardRows();
  bindOpenRouterProviderRows();
  setupLeaderboardReveal();
  setupStickyToolbar();
  setupPublicCatalogHydration();
  updateLeaderboardCompareLink();
  applySearch(true);

  window.addEventListener("aistats:live-snapshot", async (event) => {
    const snapshot = event.detail;
    if (!snapshot) return;
    await loadPublicCatalogData();
    if (!isCurrentDashboard()) return;

    const liveModels = getValidModels(snapshot.aaModels ?? []);
    latestLeaderboardModels = (snapshot.aaModels ?? []).filter((model) => model.current_source_member !== false);
    // Live snapshots are Epoch-only and may be row-capped: only a declared-complete Epoch corpus
    // replaces Epoch rows; publisher rows and the build ranking stay otherwise.
    const liveEpoch = epochLiveSnapshotFrom(snapshot);
    if (liveEpoch && epochRanking.applyLiveSnapshot(liveEpoch)) syncEpochRankingView();

    updateModelCounts(liveModels);
    updateDataFreshness(liveModels);
    updateSummaryStats(liveModels);
    updateTopStrip(
      liveModels,
      snapshot.epochModels ?? [],
      latestEpochBenchmarks,
      latestEpochRuns,
    );
    renderOpenRouterProviderLeaderboard();
    renderLeaderboard((snapshot.aaModels??[]).filter(model=>model.current_source_member!==false), latestEpochBenchmarks, latestEpochRuns);
    renderModels(liveModels);
  }, lifecycle);
};
bindDashboardLifecycle(document, "#leaderboard-panels", initializeDashboard);
