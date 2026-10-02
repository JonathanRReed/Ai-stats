# AI Stats architecture improvements
Approved direction: improve the existing Astro/React, Supabase and Cloudflare site incrementally. Keep it free to use, source-backed, mobile-friendly and concise. Deliver in the order below after Compare PR15.

## 1. Consistent catalog and identity
A source record is not a unique model family. Preserve native IDs, versions, reasoning settings and provider routes. Use one build-scoped loader for the complete validated cached catalog. Stats, model pages, Compare and the search index should share this inventory definition while labelling measured subsets honestly. Never borrow a score or price through a fuzzy name join. Existing model-page URLs remain stable. Links created by the site must select exact records; old ambiguous display-name links remain explicit about ambiguity.
Deliver a versioned public catalog endpoint and shared coverage summary. Do not generate thousands of thin SEO pages just to represent catalog-only rows.

## 2. Comparison flow
Pick records, choose a compatible metric, inspect evidence. Introduce coding, budget and open-weight starting points only where source data supports their stated criteria. Explain missing measurements. Retain source, conditions, units and dates; do not fabricate combined winners.

## 3. Phone payloads
Keep the initial page useful before JavaScript. Load a compact catalog when selection is opened and fetch detailed measurements only as needed. Bound rendered results, preserve URL/back/forward and keyboard behavior, and compare transferred bytes against the current baseline.

## 4. Independent data refresh
Keep validation, quota/backoff coordination, last-good snapshots and rollback. Decouple public data publication from code deployment without adding per-visitor calls to upstream providers. Use versioned manifests and atomic promotion so a page cannot silently mix incompatible releases. Keep observed, fetched and published times distinct.

## 5. Supabase maintenance
Measure representative reads and retention operations before indexes. Review the missing source_snapshot_cache.snapshot_id index; do not delete indexes solely for a zero-use advisor count. Verify intended anonymous sharing RPC behavior rather than disabling sharing to silence warnings. Plan the Postgres security patch with backup/recovery and a downtime window. Any persistent-access or security change retains its required confirmation.

## 6. Release guardrails
Block catalog loss, accidental cross-source joins, stale publication falsely labelled live, incompatible units and unavailable controls. Add repeatable phone-width interaction checks and release-size limits. Check the live deployment after merge.

## Delivery constraints
Author source changes through GitHub MCP, use PRs and merges, test on Snoopy's cloud machine. No user-machine execution, new paid service, invented ranking, or private credential in source. Stage each improvement independently; report shipped results with a live URL.
