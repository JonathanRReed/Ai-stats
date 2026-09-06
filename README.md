# AI Stats

Compare AI model prices, context limits, provider routes, speed, latency, and benchmark results in one dashboard.

[Live site](https://aistats.jonathanrreed.com/) · [Case study](https://jonathanrreed.com/projects/ai-stats/) · [Jonathan R. Reed](https://jonathanrreed.com/about/)

Inspired by Theo Browne's [model-prices](https://model-prices.vercel.app/).

## What the data means

Popularity, route availability, benchmark results, and political profiles measure different things. AI Stats keeps them separate.

| Source | Data |
| --- | --- |
| [Artificial Analysis](https://artificialanalysis.ai) | Pricing, its benchmark scores, speed, and latency |
| [Epoch AI Benchmarking Hub](https://epoch.ai/benchmarks) | Published benchmark runs |
| [PoliBench](https://github.com/JonathanRReed/Poli-bench) | Model-output measurements and directional political profiles, not quality scores |
| [OpenRouter](https://openrouter.ai/) | Models, providers, routes, modalities, context limits, usage rankings, and route prices |
| [Hugging Face Hub](https://huggingface.co/docs/hub/api) | Repository popularity and model tags |
| [LiteLLM](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) | Additional pricing, context, and capability metadata |

Aider Polyglot and Terminal Bench subsets from Epoch retain their documented Apache 2.0 licensing. The broader Epoch export follows its published terms. Attribution beside each metric links to its publisher where verified and credits Epoch as the aggregator. Unknown Epoch benchmarks link to the Benchmarking Hub until a publisher link is verified.

## Develop

The site uses Astro, React, Tailwind CSS, and Bun.

```sh
brew install oven-sh/bun/bun
bun install
cp .env.example .env
bun run dev
```

```sh
bun run lint
bun run build
bun run preview
```

Production is a static Astro build. `/api/intelligence.json` is a build snapshot with a generation timestamp, not a runtime endpoint. Visitor page loads use built data and checked-in snapshots, not direct Supabase table queries. To update deployed data, sync the sources and rebuild.

The [production migration guide](docs/operations/ai-stats-production-migration.md) covers the normalized intelligence schema and verification. Applying a migration is a separate production operation, not part of a build. A runtime freshness route would require a reviewed Astro server adapter.

`bun run check:epoch` checks the hosted data path and needs real `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` values. Without credentials, run lint and build.

## OpenRouter sync

[openrouter_catalog.sql](supabase/openrouter_catalog.sql) creates `public.openrouter_models`, `public.openrouter_model_endpoints`, and `public.sync_openrouter_models()`.

The catalog data path uses `public.openrouter_models` when available, otherwise OpenRouter's public `/api/v1/models?output_modalities=all` endpoint. Additional public sources include `/api/v1/models/count`, `/api/v1/providers`, `/api/v1/embeddings/models`, and model endpoint routes capped to the top catalog routes. `/rankings/` supplies weekly usage signals.

Hugging Face and LiteLLM add cross-checks. Their popularity, tags, and capability fields do not become benchmark scores.

## Epoch sync

Apply [epoch_benchmark_sync.sql](supabase/epoch_benchmark_sync.sql), then import the [Benchmarking Hub export](https://epoch.ai/data/benchmark_data.zip):

```sh
SUPABASE_SERVICE_ROLE_KEY=... bun run sync:epoch
```

The sync loads the ECI model file and benchmark CSVs. It upserts definitions by slug, models by `model_version`, and runs by Epoch run ID. Raw rows remain available for traceability; auxiliary ECI files go into `public.epoch_data_files`.

To refresh the browser snapshot without writing to Supabase:

```sh
bun run snapshot:epoch
```

The output is `public/data/epoch-benchmark-snapshot.json`. Dashboard and comparison pages use it when it provides broader coverage than the hosted tables. Metric controls retain the full Epoch pool, beyond the benchmarks shown first in the interface.

## PoliBench snapshot

`public/data/polibench-snapshot.json` derives from [`src/data/liveBenchmark.generated.json`](https://github.com/JonathanRReed/Poli-bench/blob/f49763cdbca9387d823ba19578992434b5ac04b0/src/data/liveBenchmark.generated.json) at commit `f49763cdbca9387d823ba19578992434b5ac04b0`. That artifact was generated at `2026-08-30T07:15:38.021Z` for the `full` suite. It contains 103 models, 103 model rows, and 110 run receipts.

Refresh from a sibling `../Poli-bench` checkout:

```sh
bun run sync:polibench
```

The transform preserves source model slugs, providers, and labels without matching models across sources. Robustness, completion and parse validity, stability, contradiction consistency, resolution, cost per completed response, p95 latency, and political axes stay in separate fields.

These are live model-output measurements, not human validation, external validation, or a frozen paper release. Cite PoliBench's [`CITATION.cff`](https://github.com/JonathanRReed/Poli-bench/blob/f49763cdbca9387d823ba19578992434b5ac04b0/CITATION.cff) with the exact source commit. That checkout states no dataset license for the artifact.

## Credits and licensing

Nebula Sans is by [Nebula](https://nebula.com) and remains subject to its rights and terms. Icons include [lobe-icons](https://lobe-icons.dev/) and the sources credited in the interface and [NOTICE.md](NOTICE.md).

The repository's source code is MIT-licensed. Third-party data, logos, fonts, and trademarks are excluded. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
