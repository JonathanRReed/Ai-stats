# AI Stats (Astro + Bun)

This is a hobbyist project.
Inspired by Theo Browne's [model-prices](https://model-prices.vercel.app/)

Pricing, Artificial Analysis benchmark scores, speed, and latency metrics are from [Artificial Analysis](https://artificialanalysis.ai) via their free API.
Epoch benchmark runs are from Epoch AI, AI Benchmarking Hub, published online at [epoch.ai/benchmarks](https://epoch.ai/benchmarks), used under Creative Commons Attribution licensing with Apache 2.0 licensing for Aider Polyglot and Terminal Bench derived subsets.
OpenRouter public model catalog data is used for model availability, provider coverage, modalities, context length, and route pricing metadata. OpenRouter usage rankings are not treated as benchmark scores.

## OpenRouter catalog sync

The Supabase migration in [`supabase/openrouter_catalog.sql`](./supabase/openrouter_catalog.sql) adds:

- `public.openrouter_models`
- `public.openrouter_model_endpoints`
- `public.sync_openrouter_models()`

The dashboard reads from `public.openrouter_models` when present. If that table has not been applied yet, it falls back to OpenRouter's public `/api/v1/models?output_modalities=all` endpoint so the catalog collection still renders.

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
