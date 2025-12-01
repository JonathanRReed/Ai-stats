// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://aistats.jonathanrreed.com',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: true,
    }),
    sitemap(),
  ],
  compressHTML: true,
});
