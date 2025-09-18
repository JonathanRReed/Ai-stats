# AI Stats (Astro + Bun)

This is a hobbyist project and is not intended to be used for any commercial purpose.
Inspired by Theo Browne's [model-prices](https://model-prices.vercel.app/)

The data is from [ArtificialAnalysis.com](https://artificialanalysis.ai) via their free API.
All data & benchmarking is created & owned internally by ArtificialAnalysis.com

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
