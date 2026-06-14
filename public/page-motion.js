/*
 * page-motion.js
 * Progressive-enhancement motion for AI Stats.
 *
 * Responsibilities:
 *  - Mark <html> as `motion-ready` so the CSS resting (hidden) states engage.
 *  - Reveal `.fade-in-section` via IntersectionObserver (adds `is-visible`).
 *  - Reveal `.stagger-item` children of `.stagger-container` in sequence.
 *    Cadence is configurable per-container via `data-stagger` (ms; default 40).
 *  - `.tilt-card` 3D mouse tilt with a smooth spring settle on mouseleave.
 *  - 700ms failsafe that force-reveals everything (covers observer gaps).
 *  - Honors prefers-reduced-motion: skips observers + tilt, reveals all.
 *  - Idempotent across Astro ClientRouter navigations (astro:page-load /
 *    astro:after-swap), so listeners/observers are never double-bound.
 *
 * Loaded from Layout.astro via: <script is:inline src="/page-motion.js" defer>
 */
(function () {
  var DEFAULT_STAGGER_MS = 40;
  var FAILSAFE_MS = 700;
  var REVEAL_SELECTOR = ".fade-in-section";
  var ALL_REVEAL_SELECTOR = REVEAL_SELECTOR + ", .stagger-item";

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  // Force every revealable element into its visible state.
  function revealAll() {
    document.querySelectorAll(ALL_REVEAL_SELECTOR).forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  function setupRevealObserver() {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: "50px 0px 0px 0px" }
    );

    document.querySelectorAll(REVEAL_SELECTOR).forEach(function (el) {
      if (!el.classList.contains("is-visible")) observer.observe(el);
    });
  }

  function setupStaggerObserver() {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var container = entry.target;
          var step = parseInt(container.getAttribute("data-stagger"), 10);
          if (isNaN(step) || step < 0) step = DEFAULT_STAGGER_MS;

          var items = container.querySelectorAll(
            ".stagger-item:not(.is-visible)"
          );
          items.forEach(function (item, index) {
            window.setTimeout(function () {
              item.classList.add("is-visible");
            }, step * index);
          });
          observer.unobserve(container);
        });
      },
      { threshold: 0.01, rootMargin: "50px 0px 0px 0px" }
    );

    document.querySelectorAll(".stagger-container").forEach(function (el) {
      if (el.dataset.staggerBound === "1") return;
      el.dataset.staggerBound = "1";
      observer.observe(el);
    });
  }

  function setupTiltCards() {
    document.querySelectorAll(".tilt-card").forEach(function (card) {
      if (card.dataset.tiltBound === "1") return;
      card.dataset.tiltBound = "1";

      card.addEventListener("mousemove", function (event) {
        var rect = card.getBoundingClientRect();
        var px = (event.clientX - rect.left) / rect.width;
        var py = (event.clientY - rect.top) / rect.height;
        var rotateX = 6 * (py - 0.5);
        var rotateY = -6 * (px - 0.5);
        // No transition while actively tracking the pointer.
        card.style.transition = "transform 0s";
        card.style.transform =
          "perspective(1000px) rotateX(" +
          rotateX +
          "deg) rotateY(" +
          rotateY +
          "deg) translateY(-4px)";
      });

      card.addEventListener("mouseleave", function () {
        // Smooth spring settle back to rest.
        card.style.transition = "transform var(--dur-slow) var(--ease-spring)";
        card.style.transform = "";
      });
    });
  }

  function init() {
    document.documentElement.classList.add("motion-ready");

    if (prefersReducedMotion()) {
      revealAll();
      return;
    }

    if ("IntersectionObserver" in window) {
      setupRevealObserver();
      setupStaggerObserver();
    } else {
      // No observer support: just show everything.
      revealAll();
    }

    // Failsafe: guarantee content becomes visible even if observers miss.
    window.setTimeout(revealAll, FAILSAFE_MS);

    setupTiltCards();
  }

  function start() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  start();

  // Re-init on Astro ClientRouter navigations. init() is idempotent:
  // observers only attach to not-yet-visible elements, and tilt binding is
  // guarded by data-tiltBound, so navigations never double-bind.
  document.addEventListener("astro:page-load", init);
  document.addEventListener("astro:after-swap", init);
})();
