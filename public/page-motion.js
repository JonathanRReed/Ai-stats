(function () {
  function initPageMotion(isNavigation) {
    document.documentElement.classList.add("motion-ready");

    if (isNavigation) {
      document
        .querySelectorAll(".fade-in-section, .stagger-item")
        .forEach(function (el) {
          el.classList.add("is-visible");
        });
    } else {
      if (!("IntersectionObserver" in window)) {
        document
          .querySelectorAll(".fade-in-section, .stagger-item")
          .forEach(function (el) {
            el.classList.add("is-visible");
          });
        return;
      }

      var fadeObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
            }
          });
        },
        { threshold: 0.01, rootMargin: "50px 0px 0px 0px" },
      );

      document.querySelectorAll(".fade-in-section").forEach(function (el) {
        fadeObserver.observe(el);
      });

      var staggerObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var items = entry.target.querySelectorAll(
                ".stagger-item:not(.is-visible)",
              );
              items.forEach(function (item, index) {
                setTimeout(function () {
                  item.classList.add("is-visible");
                }, index * 40);
              });
            }
          });
        },
        { threshold: 0.01, rootMargin: "50px 0px 0px 0px" },
      );

      document.querySelectorAll(".stagger-container").forEach(function (el) {
        staggerObserver.observe(el);
      });
    }

    window.setTimeout(function () {
      document
        .querySelectorAll(".fade-in-section, .stagger-item")
        .forEach(function (el) {
          el.classList.add("is-visible");
        });
    }, 700);

    document.querySelectorAll(".tilt-card").forEach(function (card) {
      var newCard = card.cloneNode(true);
      card.parentNode.replaceChild(newCard, card);

      newCard.addEventListener("mousemove", function (e) {
        var rect = newCard.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width;
        var y = (e.clientY - rect.top) / rect.height;
        var tiltX = (y - 0.5) * 6;
        var tiltY = (x - 0.5) * -6;
        newCard.style.transform =
          "perspective(1000px) rotateX(" +
          tiltX +
          "deg) rotateY(" +
          tiltY +
          "deg) translateY(-4px)";
      });
      newCard.addEventListener("mouseleave", function () {
        newCard.style.transform = "";
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initPageMotion(false);
    });
  } else {
    initPageMotion(false);
  }

  document.addEventListener("astro:page-load", function () {
    initPageMotion(true);
  });
})();
