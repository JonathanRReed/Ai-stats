/* Theme boot. Runs before first paint so neither theme flashes. Stored choice wins, dark is the default. */
(function () {
  var KEY = "theme";
  function read() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // Storage can be blocked; fall through to the default theme.
    }
    return "dark";
  }
  function apply(theme) {
    var root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#efede8" : "#090b0d");
  }
  window.__ecoTheme = {
    get: read,
    set: function (theme) {
      apply(theme);
      try {
        localStorage.setItem(KEY, theme);
      } catch {
        // Storage can be blocked; the theme still applies for this page.
      }
    },
    toggle: function () {
      window.__ecoTheme.set(read() === "light" ? "dark" : "light");
    },
  };
  apply(read());
  document.addEventListener("astro:after-swap", function () { apply(read()); });
})();
