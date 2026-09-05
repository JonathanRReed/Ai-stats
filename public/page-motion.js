/* Reveal on scroll, progressive enhancement only. Reduced motion shows everything immediately. */
(function () {
  var SECTION = ".fade-in-section";
  var ALL = SECTION + ", .stagger-item";
  function showAll() { document.querySelectorAll(ALL).forEach(function (el) { el.classList.add("is-visible"); }); }
  function init() {
    document.documentElement.classList.add("motion-ready");
    var reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return showAll();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.01, rootMargin: "50px 0px 0px 0px" });
    document.querySelectorAll(SECTION).forEach(function (el) { if (!el.classList.contains("is-visible")) io.observe(el); });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var container = entry.target;
        var step = parseInt(container.getAttribute("data-stagger"), 10);
        if (isNaN(step) || step < 0) step = 40;
        container.querySelectorAll(".stagger-item:not(.is-visible)").forEach(function (item, i) {
          window.setTimeout(function () { item.classList.add("is-visible"); }, Math.min(step * i, 400));
        });
        so.unobserve(container);
      });
    }, { threshold: 0.01, rootMargin: "50px 0px 0px 0px" });
    document.querySelectorAll(".stagger-container").forEach(function (c) {
      if (c.dataset.staggerBound === "1") return;
      c.dataset.staggerBound = "1";
      so.observe(c);
    });
    window.setTimeout(showAll, 700);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
  document.addEventListener("astro:page-load", init);
  document.addEventListener("astro:after-swap", init);
})();
