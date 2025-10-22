// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://ai-stats.vercel.app', // Update this to your actual domain
  integrations: [sitemap()],
  compressHTML: true,
});
