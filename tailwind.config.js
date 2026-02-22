/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./src/**/*.{astro,html,js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // These use CSS variables so they respond to the Rosé Pine theme toggle
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
        // Highlight colors stay static; we mainly use them for borders and accents
        'highlight-low': '#21202e',
        'highlight-med': '#403d52',
        'highlight-high': '#524f67',
      },
    },
  },
  plugins: [],
};
