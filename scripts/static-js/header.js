/* Header behaviour: scroll state, theme toggle, model search trigger, the "More" disclosure and the
   accessible mobile menu. Every navigation is a full page load, so this binds once per document. */
(function () {
  var MOBILE_QUERY = "(max-width: 900px)";

  function bindScroll(header) {
    var ticking = false;
    function sync() { header.classList.toggle("scrolled", window.scrollY > 8); }
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { sync(); ticking = false; });
    }, { passive: true });
    sync();
  }

  function bindTools(header) {
    header.querySelectorAll(".theme-toggle").forEach(function (button) {
      button.addEventListener("click", function () { if (window.__ecoTheme) window.__ecoTheme.toggle(); });
    });
    // The search palette island listens for this event, so the buttons work before it hydrates.
    header.querySelectorAll("[data-model-search-open]").forEach(function (button) {
      button.addEventListener("click", function () { window.dispatchEvent(new Event("ai-stats:open-model-search")); });
    });
  }

  /* "More" is a native <details>, so it opens without script. This adds the expected closing
     behaviour: Escape returns focus to the toggle, and a click or focus outside closes it. */
  function bindMore(header) {
    var more = header.querySelector(".nav-more");
    if (!more) return;
    var summary = more.querySelector("summary");
    var links = function () { return Array.prototype.slice.call(more.querySelectorAll(".nav-more-link")); };
    function close(returnFocus) {
      if (!more.open) return;
      more.open = false;
      if (returnFocus && summary) summary.focus();
    }
    document.addEventListener("click", function (event) { if (!more.contains(event.target)) close(false); });
    more.addEventListener("focusout", function (event) {
      if (event.relatedTarget && !more.contains(event.relatedTarget)) close(false);
    });
    more.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && more.open) {
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      var items = links();
      if (!items.length) return;
      event.preventDefault();
      if (!more.open) more.open = true;
      var index = items.indexOf(document.activeElement);
      var next = event.key === "ArrowDown" ? index + 1 : index - 1;
      if (index === -1) next = event.key === "ArrowDown" ? 0 : items.length - 1;
      items[(next + items.length) % items.length].focus();
    });
  }

  function bindMobileMenu() {
    var toggle = document.getElementById("mobile-menu-toggle");
    var nav = document.getElementById("mobile-nav");
    var overlay = document.getElementById("mobile-nav-overlay");
    if (!toggle || !nav) return;
    var navLinks = function () { return Array.prototype.slice.call(nav.querySelectorAll("a[href]")); };

    function isOpen() { return toggle.getAttribute("aria-expanded") === "true"; }
    function setOpen(open, focusTarget) {
      nav.classList.toggle("open", open);
      if (open) nav.removeAttribute("inert"); else nav.setAttribute("inert", "");
      navLinks().forEach(function (a) { a.setAttribute("tabindex", open ? "0" : "-1"); });
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (overlay) {
        overlay.classList.toggle("open", open);
        overlay.setAttribute("aria-hidden", String(!open));
      }
      document.documentElement.classList.toggle("menu-open", open);
      if (focusTarget) focusTarget.focus();
    }

    toggle.addEventListener("click", function () {
      if (isOpen()) setOpen(false, toggle);
      else setOpen(true, nav.querySelector('a[aria-current]') || navLinks()[0]);
    });
    if (overlay) overlay.addEventListener("click", function () { setOpen(false, toggle); });
    // Tab cycles between the close button and the menu links while the menu is open.
    document.addEventListener("keydown", function (event) {
      if (!isOpen()) return;
      if (event.key === "Escape") { setOpen(false, toggle); return; }
      if (event.key !== "Tab") return;
      var items = [toggle].concat(navLinks());
      var index = items.indexOf(document.activeElement);
      if (index === -1) { event.preventDefault(); items[0].focus(); return; }
      var next = event.shiftKey ? index - 1 : index + 1;
      if (next < 0 || next >= items.length) {
        event.preventDefault();
        items[(next + items.length) % items.length].focus();
      }
    });
    // Leaving the mobile layout with the menu open would strand the scroll lock.
    if (typeof window.matchMedia === "function") {
      var query = window.matchMedia(MOBILE_QUERY);
      var onChange = function () { if (!query.matches && isOpen()) setOpen(false); };
      if (query.addEventListener) query.addEventListener("change", onChange);
    }
    setOpen(false);
  }

  function bind() {
    var root = document.documentElement;
    var header = document.querySelector(".header");
    if (!header || root.dataset.headerBound === "1") return;
    root.dataset.headerBound = "1";
    bindScroll(header);
    bindTools(header);
    bindMore(header);
    bindMobileMenu();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})();
