/* Header behaviour: scroll state, theme toggle, accessible mobile menu. Rebinds after Astro view transitions. */
(function () {
  function syncScrolled() {
    var header = document.querySelector(".header");
    if (header) header.classList.toggle("scrolled", window.scrollY > 8);
  }
  function bindScroll() {
    if (document.documentElement.dataset.headerScrollBound) return syncScrolled();
    document.documentElement.dataset.headerScrollBound = "1";
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { syncScrolled(); ticking = false; });
    }, { passive: true });
    syncScrolled();
  }
  function fresh(el) {
    if (!el) return null;
    var clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    return clone;
  }
  function bind() {
    var toggle = fresh(document.getElementById("mobile-menu-toggle"));
    var nav = document.getElementById("mobile-nav");
    var overlay = fresh(document.getElementById("mobile-nav-overlay"));
    var themeButtons = [document.getElementById("theme-toggle"), document.getElementById("theme-toggle-mobile")];

    function setOpen(open) {
      if (nav) {
        nav.classList.toggle("open", open);
        if (open) nav.removeAttribute("inert"); else nav.setAttribute("inert", "");
        nav.querySelectorAll("a").forEach(function (a) { a.setAttribute("tabindex", open ? "0" : "-1"); });
      }
      if (toggle) {
        toggle.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", String(open));
      }
      if (overlay) {
        overlay.classList.toggle("open", open);
        overlay.setAttribute("aria-hidden", String(!open));
      }
      document.documentElement.classList.toggle("menu-open", open);
    }

    if (toggle) toggle.addEventListener("click", function () { setOpen(!(nav && nav.classList.contains("open"))); });
    if (overlay) overlay.addEventListener("click", function () { setOpen(false); });
    themeButtons.forEach(function (button) {
      var b = fresh(button);
      if (b) b.addEventListener("click", function () { if (window.__ecoTheme) window.__ecoTheme.toggle(); });
    });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") setOpen(false); });
    setOpen(false);
    bindScroll();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
  document.addEventListener("astro:page-load", bind);
})();
