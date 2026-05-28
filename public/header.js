(function () {
  var THEME_STORAGE_KEY = "theme";

  function initHeader() {
    var menuToggle = document.getElementById("mobile-menu-toggle");
    var mobileNav = document.getElementById("mobile-nav");
    var overlay = document.getElementById("mobile-nav-overlay");
    var themeToggle = document.getElementById("theme-toggle");
    var themeToggleMobile = document.getElementById("theme-toggle-mobile");

    function applyTheme(theme) {
      var isLight = theme === "light";
      document.documentElement.classList.toggle("light", isLight);
      var colorScheme = isLight ? "light" : "dark";
      document.documentElement.style.colorScheme = colorScheme;
      if (document.body) {
        document.body.style.colorScheme = colorScheme;
      }
    }

    function readStoredTheme() {
      try {
        var saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark") return saved;
      } catch (_error) {
        // ignore storage read errors
      }
      return document.documentElement.classList.contains("light") ? "light" : "dark";
    }

    function persistTheme(theme) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch (_error) {
        // ignore storage write errors
      }
    }

    function setMenuState(isOpen) {
      if (mobileNav) mobileNav.classList.toggle("open", isOpen);
      if (menuToggle) menuToggle.classList.toggle("open", isOpen);
      if (overlay) overlay.classList.toggle("open", isOpen);
      if (menuToggle) menuToggle.setAttribute("aria-expanded", String(isOpen));
      if (mobileNav) {
        if (isOpen) {
          mobileNav.removeAttribute("inert");
        } else {
          mobileNav.setAttribute("inert", "");
        }
        var navLinks = mobileNav.querySelectorAll("a");
        navLinks.forEach(function (link) {
          link.setAttribute("tabindex", isOpen ? "0" : "-1");
        });
      }
    }

    function toggleMenu() {
      var currentlyOpen = mobileNav ? mobileNav.classList.contains("open") : false;
      setMenuState(!currentlyOpen);
    }

    function toggleTheme() {
      var currentTheme = readStoredTheme();
      var newTheme = currentTheme === "light" ? "dark" : "light";
      applyTheme(newTheme);
      persistTheme(newTheme);
    }

    if (menuToggle) {
      var newMenuToggle = menuToggle.cloneNode(true);
      menuToggle.parentNode.replaceChild(newMenuToggle, menuToggle);
      menuToggle = newMenuToggle;
      menuToggle.addEventListener("click", toggleMenu);
    }

    if (overlay) {
      var newOverlay = overlay.cloneNode(true);
      overlay.parentNode.replaceChild(newOverlay, overlay);
      overlay = newOverlay;
      overlay.addEventListener("click", function () {
        setMenuState(false);
      });
    }

    [themeToggle, themeToggleMobile].forEach(function (toggle) {
      if (!toggle) return;
      var newToggle = toggle.cloneNode(true);
      toggle.parentNode.replaceChild(newToggle, toggle);
      newToggle.addEventListener("click", toggleTheme);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setMenuState(false);
    });

    setMenuState(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeader);
  } else {
    initHeader();
  }
  document.addEventListener("astro:page-load", initHeader);
})();
