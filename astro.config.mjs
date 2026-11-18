// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://aistats.jonathanrreed.com',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'never',
  },
  integrations: [react()],
  // Hover (and keyboard focus) prefetch for internal pages. Nothing is prefetched by
  // default: Layout.astro opts in HTML page links only, so the large JSON under /api
  // and /data is never fetched speculatively. No viewport strategy: the Stats and
  // Compare documents are large enough that prefetching every visible link would cost
  // more than it saves.
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  vite: {
    plugins: [tailwindcss()],
    // Radix and cmdk ship ESM that Astro must bundle for the island rather
    // than externalize, or the dialog loses its context on hydration.
    ssr: { noExternal: ['radix-ui', 'cmdk'] },
  },
  compressHTML: true,
});
