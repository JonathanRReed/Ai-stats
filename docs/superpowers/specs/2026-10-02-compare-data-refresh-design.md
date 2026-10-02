# AI Stats: comparison explorer and trustworthy cached data

Date: 2026-10-02
Status: proposed design for review
Repository: JonathanRReed/Ai-stats
Baseline: b6ed9e4bbb162268ade69e5bd13dffd7e83f0d37

## Goal and decisions

Replace the Compare experience with a chart-first explorer inspired by Slopalytics, using AI Stats' existing near-black surfaces, ivory text, orange accents, typography and navigation. Keep the Stats layout, remove redundant introductory copy, and add OpenRouter usage history. Jonathan selected AA free data, OpenRouter, improved Epoch ingestion, and an AA access request. No paid subscription is assumed.

Success means useful interactive comparisons with trustworthy units, exact model variants, visible evidence dates and bounded upstream traffic. Different benchmarks and usage populations never become one synthetic score.

## Verified problems

- Compare requires positive input and output prices even for non-price charts, excluding free and unpriced models.
- Both its initial API and browser refresh collapse Epoch observations into one model/benchmark scalar using last-row-wins. For Qwen2.5-Coder-32B-Instruct, Aider results of 8% (diff edit format) and 16.4% (whole format) lose their conditions.
- Published Epoch snapshots omit evaluation conditions held in raw database records.
- Source freshness uses a generic 14-day threshold despite twice-daily ingestion. Successful reimport of old evidence does not make it current.
- AA rows remain after disappearing from the latest response. Archived observations need explicit visibility rules.
- Public catalog snapshots omit fetch timestamps. Some catalogs are build-time API fallbacks with process-local caching, not durable database caches.
- Current AA free access excludes benchmark token counts. Slopalytics' public bundle contains richer snapshot data, but its collection permissions are unverified.

## 1. Data contract and Supabase

Use the existing Ai-dex production project, canonical_models, model_aliases, benchmark_definitions, benchmark_versions and benchmark_observations. Extend these deliberately rather than creating a parallel model registry.

An observation carries source record ID, exact source model ID, benchmark/version, metric key, native unit, direction, value, evaluation conditions, evaluation date when supplied, source URL, fetched time, ingest receipt and snapshot membership. Unknown dates and conditions remain unknown. Preserve raw source evidence privately.

Keep model family, release and reasoning effort separate. Family grouping is presentation only. Cross-source joins require an explicit unambiguous match with provenance; uncertain aliases remain unmatched. Never strip a reasoning suffix and silently inherit another variant's measurements.

For Epoch, preserve edit format, harness, sampling, token budget, run IDs, score metric, uncertainty and other relevant source conditions. Prefer its official relationship-preserving client/API when authorized access is available. Otherwise retain supported CSV ingestion and preserve the same fields explicitly. Do not pretend CSV alone resolves omitted relationships.

Repeated comparable runs may use a source-published aggregate. Do not take a maximum or last row as the default. If no justified aggregate exists, show distinct observations or a multiple-runs state with selectable conditions. Keep benchmark families/versions separate. Unit conversion requires an explicit definition, never a value-less-than-one heuristic.

Use validated snapshot membership to distinguish current and historical data without deleting old rows. Staging and validation precede promotion of a current snapshot pointer. Invalid, empty, partial or failed fetches retain the last good published data with an honest warning.

Changes are additive and reversible. Capture schema/count baselines and rollback instructions; test migrations outside production first when supported. Keep RLS enabled, raw/private records private, public benchmark reads narrowly scoped, and all writes privileged. No new credential grants or destructive cleanup are included.

## 2. Refresh and delivery

Supabase remains the durable cache. Browsers never call AA, Epoch or OpenRouter upstream APIs directly.

Initial cadence: AA every four hours within its shared quota; Epoch every six hours using conditional requests where supported; OpenRouter catalog every six hours and daily usage checked every six hours for newly completed UTC days; HF/LiteLLM daily. Respect published limits, Retry-After, backoff and a per-source lock. Measure actual page counts and quota headroom before increasing AA's existing cadence.

Store successful fetch time separately from source observation date and publication time. A repeated unchanged download advances the fetch receipt only. Dynamic source status becomes overdue after two scheduled intervals; actual historical benchmark dates remain visible rather than being mislabeled as failed ingestion.

Generate versioned public payloads and a small freshness manifest from the validated cache. Keep Astro's static delivery and last-good fallback. Publish only changed payloads, verify deployment separately from database success, and avoid full-corpus browser downloads when a selected comparison needs a small subset. Expose source dates, snapshot IDs and partial-coverage status. Preserve current consumer fields through a versioned transition.

## 3. OpenRouter usage on Stats

Use the documented rankings-daily dataset rather than scraping HTML/Next.js payloads. It provides daily model token totals plus Other. Import complete UTC days idempotently by date/model and retain the source as_of timestamp.

Show stacked share and absolute-volume views, 7/30/90-day windows when available, model selection, pointer/touch/keyboard inspection and an exact-data table. Preserve Other in denominator calculations; distinguish share of the full dataset from share of a selected subset. Missing days are gaps, not zero.

Label these as OpenRouter traffic, not all-market adoption, user counts, spend or benchmark efficiency. Provider tokenizers differ. Follow the documented attribution. A securely configured valid key is an access prerequisite; no key is placed in chat, browser code or the repository.

## 4. Compare interface

Replace the current monolithic page with a small Astro shell and focused explorer components/data adapters.

The first screen is the chart, not explanatory cards. Provide a compact searchable model/family/reasoning selector, chart tabs and a collapsible methodology panel. Include:
- Intelligence versus task cost scatter
- Intelligence versus output speed or clearly named response latency scatter
- Task cost and total benchmark cost bars
- Input/output price bars
- Individual benchmark comparisons with exact conditions
- Token-per-task and total-token views only when a permitted, validated source supplies them

Do not substitute 500-token response time for benchmark task duration. Disabled unavailable metrics explain the missing source without fabricated placeholders.

Use stable family colors, linked reasoning variants, optional labels, linear/log axes, hover and pinned receipts, reset/select controls, and shareable URL state. Compute the frontier only within compatible evidence and selected models; disclose exclusions. Zero prices remain valid and require a linear-axis fallback. Each chart offers a table and source links.

Mobile uses an accessible filter drawer and horizontal tab navigation. Keyboard users can select models and inspect observations; Escape closes overlays. Respect reduced motion, theme contrast and browser Back/Forward. PNG/CSV export includes source and date when implemented.

## 5. Stats copy

Shorten the hero to a direct heading and one useful sentence. Preserve necessary units, dates and caveats adjacent to charts; move repeated methodology prose into expandable details. Keep the existing page's visual identity and useful sections. No keyword padding or new promotional copy.

## 6. Licensing and unavailable fields

AA was emailed from Jonathan's professional account asking for free/discounted richer data or a daily export, explicit public-display rights and attribution requirements. Its current API page describes free use as internal-only; expanded public distribution is not assumed authorized by API access alone.

Do not scrape AA or copy Slopalytics' dataset as a shortcut. Continue independent Epoch/OpenRouter work while AA responds. Token charts remain capability-gated. Existing AA presentation is not silently removed or expanded pending clarification.

## 7. Verification and rollout

Regression fixtures cover conflicting Epoch conditions, missing/zero values, unit scales, alias collisions, reasoning variants, retired AA rows, duplicate imports, partial pagination, unchanged snapshots, failed promotion and quota backoff.

Usage tests cover Other, denominators, date boundaries, missing days and idempotence. UI tests cover linked selections, shared URLs, Back/Forward, keyboard/touch, log-axis zero handling, empty states and responsive layout.

Run repository tests, lint, types and build against exact remote code on Snoopy's cloud machine. Code and migration changes go through GitHub MCP PRs. Stage data fixes, then Compare, then Stats usage/copy; verify the matching production deployment and live behavior after each merge. Report the live URL and any unavailable sources explicitly.

## Sources

- https://slopalytics.com/
- https://artificialanalysis.ai/data-api/docs
- https://artificialanalysis.ai/data-api
- https://epoch.ai/benchmarks/use-this-data
- https://openrouter.ai/docs/api/api-reference/datasets/daily-token-totals-for-top-50-models
