/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./src/**/*.{astro,html,js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // These use CSS variables so they follow the active telemetry theme.
        base: 'var(--base)',
        surface: 'var(--surface)',
        overlay: 'var(--overlay)',
        muted: 'var(--muted)',
        subtle: 'var(--subtle)',
        text: 'var(--text)',
        love: 'var(--love)',
        gold: 'var(--gold)',
        rose: 'var(--rose)',
        pine: 'var(--pine)',
        foam: 'var(--foam)',
        iris: 'var(--iris)',
        'highlight-low': 'var(--highlight-low)',
        'highlight-med': 'var(--highlight-med)',
        'highlight-high': 'var(--highlight-high)',
      },
    },
  },
  plugins: [],
};
