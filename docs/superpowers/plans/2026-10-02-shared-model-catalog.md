# Shared Model Catalog Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
**Goal:** Make catalog identity and links consistent without changing the stats page's visual design.
**Architecture:** A build-scoped loader owns the exact cached inventory and its source receipts. Consumers choose explicit measured subsets; source-qualified links never infer identity from a display name.
**Tech Stack:** Astro, TypeScript, React, Supabase/Postgres, Cloudflare Pages, Bun
**Spec:** ../specs/2026-10-02-ai-stats-architecture.md
## Global constraints
- Product changes through GitHub MCP; PR then merge; cloud-machine tests
- Preserve existing page URLs, zero prices, source variants and missing-value semantics
- No fuzzy joins, new dependencies, paid services or secret changes
## Review focus
- Same display name across AA and Epoch must not change link targets
- Same AA slug across historical UUIDs must not lose source records
- Catalog-only entries must not acquire measurements or thin SEO pages
- Source unavailable must remain visible as a limitation, never fabricated empty success
- Existing share URLs, Back and Forward must remain usable
## Tasks
### 1. Pin exact link behavior
Files: src/lib/model-identity.ts, src/lib/model-identity.test.ts, src/lib/compare-state.ts
- [ ] Add failing tests for UUID links, source-qualified slug links, same-name sources, historical aliases, unsupported source keys
- [ ] Run bun test src/lib/model-identity.test.ts and confirm failures
- [ ] Implement compareRecordHref(id, chart?), sourceRecordHref(source,key), exact source-key resolution in parseCompareState
- [ ] Run focused tests and commit
### 2. Share catalog loading and coverage
Files: src/lib/model-catalog-data.ts, src/lib/model-catalog.ts, src/pages/compare.astro, src/pages/api/model-catalog.json.ts, src/components/CatalogCoverage.astro
- [ ] Test exact record counts, historical/current separation and source labels without unique-family claims
- [ ] Implement a memoized getModelCatalogData() loader returning aaModels, epoch, catalogs, canonical, aliases, sources and records
- [ ] Expose a versioned public source-record snapshot and render the same coverage summary on Stats and Models
- [ ] Keep detailed measured model pages and explicit links to browse the entire catalog
### 3. Fix consumer links and search
Files: model-pages.ts, model-passport.ts, LatestModelsStrip.astro, IntelligenceOverview.astro, model-index.json.ts
- [ ] Test all generated links select exact source records despite duplicate names
- [ ] Use known UUIDs in AA page and stats links, source-qualified native references in passports
- [ ] Extend the search index with catalog-only records pointing to the correct Compare selection; preserve measured page links
### 4. Verify and release
- [ ] Run full Bun tests, ESLint, Astro typecheck and git diff --check
- [ ] Use hosted data-backed build if local credentials are absent; do not bypass network restrictions
- [ ] Test Stats→Compare, model page→Compare and search routes on desktop and at390px
- [ ] Review, merge, verify live routes/counts and report completion
