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
  vite: {
    plugins: [tailwindcss()],
  },
  compressHTML: true,
});
