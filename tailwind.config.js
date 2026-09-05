/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ecosystem contract tokens. Legacy names stay mapped so existing markup keeps working.
        base: "var(--surface-0)",
        surface: "var(--surface-1)",
        overlay: "var(--surface-2)",
        muted: "var(--ink-2)",
        subtle: "var(--ink-1)",
        text: "var(--ink-0)",
        love: "var(--signal)",
        signal: "var(--signal)",
        gold: "var(--warn)",
        rose: "var(--bad)",
        pine: "var(--ok)",
        foam: "var(--signal-hover)",
        iris: "var(--info)",
        "border-color": "var(--line-1)",
        "highlight-low": "var(--line-0)",
        "highlight-med": "var(--line-1)",
        "highlight-high": "color-mix(in srgb, var(--ink-0) 30%, transparent)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};
