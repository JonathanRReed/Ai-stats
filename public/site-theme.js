(function () {
  var THEME_STORAGE_KEY = "theme";
  // Must mirror the --base token values in Layout.astro.
  var THEME_COLOR_DARK = "#090b0d";
  var THEME_COLOR_LIGHT = "#efede8";

  function updateThemeColorMeta(isLight) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", isLight ? THEME_COLOR_LIGHT : THEME_COLOR_DARK);
    }
  }

  function applyTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (_error) {
      // ignore storage access failures
    }

    var isLight = saved === "light";
    document.documentElement.classList.toggle("light", isLight);

    var colorScheme = isLight ? "light" : "dark";
    document.documentElement.style.colorScheme = colorScheme;
    if (document.body) {
      document.body.style.colorScheme = colorScheme;
    }

    updateThemeColorMeta(isLight);
  }

  applyTheme();
  document.addEventListener("astro:after-swap", applyTheme);
})();
