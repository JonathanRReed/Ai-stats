// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://aistats.jonathanrreed.com',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'never',
  },
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: true,
    }),
  ],
  compressHTML: true,
});
