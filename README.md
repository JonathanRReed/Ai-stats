# AI Stats

AI Stats is a model-selection workbench for comparing model pricing, context limits, provider routes, speed, latency, and benchmark coverage without opening a pile of tabs.

- [Live site](https://aistats.jonathanrreed.com/)
- [Portfolio case study](https://jonathanrreed.com/projects/ai-stats/)
- [Jonathan R. Reed](https://jonathanrreed.com/about/)

The project was inspired by Theo Browne's [model-prices](https://model-prices.vercel.app/). AI Stats expands that basic comparison idea into a sourced dashboard covering model catalogs, provider routes, pricing, benchmark results, popularity signals, and data freshness.

## Data source boundaries

Each source has a specific role. Catalog popularity and route availability are not presented as benchmark results.

- [Artificial Analysis](https://artificialanalysis.ai) supplies pricing, Artificial Analysis benchmark scores, speed, and latency through its free API.
- [Epoch AI Benchmarking Hub](https://epoch.ai/benchmarks) supplies published benchmark runs. Aider Polyglot and Terminal Bench derived subsets retain their documented Apache 2.0 licensing; the broader Epoch export is used under its published terms.
- [OpenRouter](https://openrouter.ai/) supplies public model catalog, provider, route, modality, context, usage-ranking, and route-pricing metadata.
- [Hugging Face Hub](https://huggingface.co/docs/hub/api) supplies public repository popularity and model tags.
- [LiteLLM](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) supplies an additional public pricing, context, and capability catalog.

## OpenRouter catalog sync

The Supabase migration in [`supabase/openrouter_catalog.sql`](./supabase/openrouter_catalog.sql) adds:

- `public.openrouter_models`
- `public.openrouter_model_endpoints`
- `public.sync_openrouter_models()`

The dashboard reads from `public.openrouter_models` when the table exists. Otherwise it falls back to OpenRouter's public `/api/v1/models?output_modalities=all` endpoint so the catalog remains usable.

The frontend also uses these free public OpenRouter surfaces when available:

- `/api/v1/models/count`
- `/api/v1/providers`
- `/api/v1/embeddings/models`
- `/api/v1/models/{author}/{slug}/endpoints`, capped to the top catalog routes
- `/rankings/`, parsed for public weekly usage signals

Hugging Face Hub and LiteLLM add public popularity, tag, pricing, context, and capability checks. Those fields stay separate from benchmark scores.

## Epoch data sync

Epoch AI publishes the free AI Benchmarking Hub export at `https://epoch.ai/data/benchmark_data.zip`. Apply [`supabase/epoch_benchmark_sync.sql`](./supabase/epoch_benchmark_sync.sql), then run:

```sh
SUPABASE_SERVICE_ROLE_KEY=... bun run sync:epoch
```

The sync loads the ECI model file and each benchmark CSV in the ZIP. It upserts benchmark definitions by slug, models by `model_version`, and benchmark runs by Epoch run ID while preserving the raw CSV row for source traceability. Auxiliary ECI files are stored in `public.epoch_data_files` even when they are not direct leaderboard inputs.

Refresh the browser fallback snapshot without writing to Supabase:

```sh
bun run snapshot:epoch
```

The snapshot is served from `public/data/epoch-benchmark-snapshot.json`. The dashboard and comparison page use it when it contains broader Epoch coverage than the hosted tables.

The interface promotes high-signal free benchmarks first, including GPQA Diamond, FrontierMath, SWE-bench Verified, TerminalBench, Aider Polyglot, HLE, SimpleBench, SimpleQA Verified, ARC-AGI-2, LiveBench, WebDev Arena, CyBench, OSWorld, GDPval, Video-MME, METR Time Horizons, APEX-Agents, The Agent Company, BALROG, DeepResearchBench, and WeirdML. The full Epoch pool remains available in the metric controls.

Benchmark attribution appears beside the selected metric. Artificial Analysis fields link to Artificial Analysis. Epoch-backed fields link to the benchmark publisher when the export provides a source or the project has a verified fallback, and also credit Epoch AI as the aggregation source. Unknown future Epoch benchmarks fall back to the Epoch Benchmarking Hub until a publisher link is verified.

## Development

The site uses Astro, React, Tailwind CSS, and Bun.

```sh
brew install oven-sh/bun/bun
bun install
cp .env.example .env
bun run dev
```

Production checks:

```sh
bun run lint
bun run build
```

Preview the built site:

```sh
bun run preview
```

`bun run check:epoch` validates the Supabase-backed model data path and requires real `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` values. In a clean environment without credentials, use `bun run lint` and `bun run build` for repository verification.

## Credits and licensing

The interface uses Nebula Sans, created by [Nebula](https://nebula.com), under its applicable rights and terms. Provider and product icons include assets from [lobe-icons](https://lobe-icons.dev/) and the credited upstream sources documented in the interface and [`NOTICE.md`](./NOTICE.md).

Repository source code is licensed under MIT. Third-party data, logos, fonts, and trademarks are excluded. See [`LICENSE`](./LICENSE) and [`NOTICE.md`](./NOTICE.md).
