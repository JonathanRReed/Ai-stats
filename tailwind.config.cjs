/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{astro,html,js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "var(--base)",
        surface: "var(--surface)",
        overlay: "var(--overlay)",
        muted: "var(--muted)",
        subtle: "var(--subtle)",
        text: "var(--text)",
        love: "var(--love)",
        gold: "var(--gold)",
        rose: "var(--rose)",
        pine: "var(--pine)",
        foam: "var(--foam)",
        iris: "var(--iris)",
        "highlight-low": "var(--highlight-low)",
        "highlight-med": "var(--highlight-med)",
        "highlight-high": "var(--highlight-high)",
      },
    },
  },
  plugins: [],
};
