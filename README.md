# AI Stats (Astro + Bun)

This is a hobbyist project.
Inspired by Theo Browne's [model-prices](https://model-prices.vercel.app/)

Pricing, Artificial Analysis benchmark scores, speed, and latency metrics are from [Artificial Analysis](https://artificialanalysis.ai) via their free API.
Epoch benchmark runs are from Epoch AI, AI Benchmarking Hub, published online at [epoch.ai/benchmarks](https://epoch.ai/benchmarks), used under Creative Commons Attribution licensing with Apache 2.0 licensing for Aider Polyglot and Terminal Bench derived subsets.
OpenRouter public model catalog data is used for model availability, provider coverage, usage rankings, provider directory metadata, embedding models, endpoint route detail, modalities, context length, and route pricing metadata. Hugging Face Hub public model data adds public repository popularity and tag signals. LiteLLM public catalog data adds extra provider pricing, context, and capability checks. Public catalog rankings are not treated as benchmark scores.

## OpenRouter catalog sync

The Supabase migration in [`supabase/openrouter_catalog.sql`](./supabase/openrouter_catalog.sql) adds:

- `public.openrouter_models`
- `public.openrouter_model_endpoints`
- `public.sync_openrouter_models()`

The dashboard reads from `public.openrouter_models` when present. If that table has not been applied yet, it falls back to OpenRouter's public `/api/v1/models?output_modalities=all` endpoint so the catalog collection still renders.

The frontend also uses these free public OpenRouter endpoints when available:

- `/api/v1/models/count`
- `/api/v1/providers`
- `/api/v1/embeddings/models`
- `/api/v1/models/{author}/{slug}/endpoints`, capped to the top catalog routes
- `/rankings/`, parsed for public weekly usage signals

The frontend also fetches free public catalog data from the [Hugging Face Hub API](https://huggingface.co/docs/hub/api) and [LiteLLM's model prices and context catalog](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json). Those sources are used as availability, popularity, pricing, context, and capability signals only. They are not benchmark scores.

## Epoch data sync

Epoch AI publishes the free AI Benchmarking Hub export at `https://epoch.ai/data/benchmark_data.zip`. Apply [`supabase/epoch_benchmark_sync.sql`](./supabase/epoch_benchmark_sync.sql), then run:

```sh
SUPABASE_SERVICE_ROLE_KEY=... bun run sync:epoch
```

The sync loads the ECI model file and every benchmark CSV in the ZIP. It upserts benchmark definitions by slug, models by `model_version`, and benchmark runs by Epoch run id while preserving the raw CSV row for source traceability. It also stores every CSV file from the ZIP in `public.epoch_data_files`, including the auxiliary ECI files that are not direct benchmark leaderboards.

To refresh the frontend fallback snapshot without writing to Supabase, run:

```sh
bun run snapshot:epoch
```

That snapshot is served from `public/data/epoch-benchmark-snapshot.json`. The dashboard and compare page use it when it has broader Epoch coverage than the hosted Supabase tables, so old Epoch benchmark slugs and newly added free benchmarks stay visible even before the database sync runs.

The frontend promotes the highest-signal free benchmarks first, including GPQA Diamond, FrontierMath, SWE-bench Verified, TerminalBench, Aider Polyglot, HLE, SimpleBench, SimpleQA Verified, ARC-AGI-2, LiveBench, WebDev Arena, CyBench, OSWorld, GDPval, Video-MME, METR Time Horizons, APEX-Agents, The Agent Company, BALROG, DeepResearchBench, and WeirdML. The full Epoch pool still remains available in the metric dropdowns.

Benchmark attribution is shown beside the active metric selector. Artificial Analysis metrics link to Artificial Analysis. Epoch-backed metrics link to the benchmark publisher when the CSV exposes a source link or when the project has a verified fallback, and they also credit Epoch AI Benchmarking Hub as the aggregation source. Unknown future Epoch benchmarks fall back to Epoch AI Benchmarking Hub until a publisher link is available.

The font used is NebulaSans, which is a custom font created by [nebula.com](https://nebula.com) all rights reserved to them.

The site is built with Astro and TailwindCSS.

## Using Bun

This project is configured to use Bun as the package manager (see `package.json` `packageManager` field).

Install Bun (macOS):

```sh
brew install oven-sh/bun/bun
```

Install dependencies (generates `bun.lockb`):

```sh
bun install
```

Run the dev server:

```sh
bun run dev
```

Build for production:

```sh
bun run build
```

Preview the production build:

```sh
bun run preview
```

Notes:

- If you previously used npm, you can remove `package-lock.json` and `node_modules/` before running `bun install` to avoid lockfile conflicts.
- Bun can run `astro` directly as well via `bunx astro`, but the scripts defined in `package.json` are recommended.

Citation/Thanks yous:
Logo icons are from [lobe-icons](https://lobe-icons.dev/)

## License

The source code in this repository is licensed under MIT. Third-party data,
logos, font files, and trademarks are excluded. See [`LICENSE`](./LICENSE) and
[`NOTICE.md`](./NOTICE.md).
