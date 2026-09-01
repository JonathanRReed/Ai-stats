# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary users are AI-literate builders and practitioners comparing models for real work. They need a trustworthy evidence view quickly, without interpreting several unrelated leaderboards, pricing pages, and provider catalogs.

Researchers, benchmark specialists, and technically curious readers are a secondary audience. The product should give them enough methodology, provenance, version, and freshness detail to inspect the evidence behind a comparison.

## Product Purpose

AI Stats is a source-backed model evidence workbench. It brings model quality, benchmark coverage, price, speed, latency, context, provider routes, and availability into one place so a user can inspect comparable evidence within minutes.

Success means that a user can compare models for a practical task while understanding where every material number came from, when it was refreshed, and which comparisons are valid. AI Stats supplies evidence, not a product recommendation.

## Positioning

AI Stats combines independent evaluation sources and public provider catalogs without pretending that unlike benchmarks share one universal scale. It preserves each source's methodology, attaches provenance to observations, and uses transparent task-oriented views to help users make decisions.

The product is not a model hype feed, a single opaque leaderboard, or a replacement for the underlying benchmark publishers. It is an evidence layer that makes their measurements easier to compare and use responsibly.

## Operating Context

Users arrive with a task, budget, modality, latency requirement, context need, or shortlist of models. They browse the market, filter candidates, inspect source-specific scores, compare tradeoffs, and follow methodology links when they need more detail.

AI Stats currently draws from Artificial Analysis, Epoch AI's Benchmarking Hub, OpenRouter, Hugging Face Hub, LiteLLM, and public benchmark publishers. PoliBench is a first-party benchmark source that should be integrated with the same provenance and versioning standards as external sources.

## Capabilities and Constraints

- Public browsing and comparison remain usable without an account, payment, or visitor-supplied API key.
- Benchmark scores retain their native source, benchmark version, metric, scale, direction, evaluation date, and methodology link.
- Scores from different benchmarks or harnesses are not silently blended into a universal ranking.
- Task-oriented evidence views may combine measurements only when their included metrics, weights, coverage threshold, and filtered-set normalization are visible and explainable.
- Pricing, benchmark results, provider routes, popularity signals, and catalog metadata remain distinct data types.
- Data freshness, ingestion health, source coverage, and known gaps are visible rather than inferred from a site build date.
- Missing values stay missing. The product does not fabricate scores, interpolate unsupported results, or present catalog availability as evaluation evidence.
- External source licensing and attribution requirements must be preserved.
- Production data changes require an identified target project, a recoverable backup or export, additive migrations where practical, and post-migration verification.

## Brand Commitments

The product name is AI Stats. Its voice is direct, evidence-led, technically literate, and useful without being academic. Claims should be concrete and attributed. Preserve the existing dark, technical, near-black product aesthetic and recognizable AI Stats identity. The renovation should refine that visual world through better information hierarchy, richer visualizations, clearer source and freshness states, and more deliberate typography rather than replacing it with an unrelated metaphor or light theme.

## Evidence on Hand

- The existing Astro application and its rendered production site provide the incumbent workflows, content, and functional baseline.
- Supabase project `Ai-dex` stores Artificial Analysis and Epoch data used by the current site.
- The repository contains Artificial Analysis model integration, Epoch synchronization, benchmark attribution, public catalog enrichment, comparison UI, and data-integrity logic.
- The PoliBench repository contains first-party benchmark methodology, model results, scoring artifacts, and a generated public snapshot suitable for a provenance-aware integration.
- No testimonials, customer claims, or paid-product evidence are established. Future work must not invent them.

## Product Principles

1. Evidence before rank. Show the source, method, version, and date behind every consequential number.
2. Useful comparison before data exhaust. Help users reach a defensible evidence set without hiding the underlying data.
3. Compare like with like. Keep incompatible benchmark scales separate and explain any explicit synthesis.
4. Freshness is a feature. Surface stale sources, failed ingestions, partial coverage, and changing methodology.
5. Free public utility. Core discovery, comparison, provenance, and source navigation remain available without an account.

## Accessibility & Inclusion

The web interface should meet WCAG 2.2 AA expectations, support keyboard-only navigation, respect reduced-motion and contrast preferences, use semantic tables and charts with textual equivalents, and remain usable across desktop and mobile layouts.
