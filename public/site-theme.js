(function () {
  var THEME_STORAGE_KEY = "theme";

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
  }

  applyTheme();
  document.addEventListener("astro:after-swap", applyTheme);
})();
