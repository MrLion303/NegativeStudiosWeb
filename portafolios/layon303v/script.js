(() => {
  "use strict";

  const menuButton = document.querySelector(".menu-toggle");
  const siteNav = document.querySelector("#siteNav");
  const progressBar = document.querySelector("#readingProgress");
  const year = document.querySelector("#currentYear");
  const shareButton = document.querySelector("#sharePortfolio");
  const toast = document.querySelector("#shareToast");

  if (year) year.textContent = String(new Date().getFullYear());

  function closeMenu() {
    if (!menuButton || !siteNav) return;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Abrir menú");
    siteNav.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  }

  if (menuButton && siteNav) {
    menuButton.addEventListener("click", () => {
      const isOpen = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!isOpen));
      menuButton.setAttribute("aria-label", isOpen ? "Abrir menú" : "Cerrar menú");
      siteNav.classList.toggle("is-open", !isOpen);
      document.body.classList.toggle("menu-open", !isOpen);
    });

    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 720) closeMenu();
    });
  }


  // Carrusel continuo: mide una copia real para que el empalme nunca dependa
  // del ancho estimado del contenedor ni del porcentaje total de la pista.
  const tickerTrack = document.querySelector(".ticker-track");
  const tickerSets = tickerTrack ? tickerTrack.querySelectorAll(".ticker-set") : [];
  if (tickerTrack && tickerSets.length >= 2) {
    const firstTickerSet = tickerSets[0];
    let tickerMeasureFrame = 0;

    const measureTicker = () => {
      const distance = firstTickerSet.getBoundingClientRect().width;
      if (!Number.isFinite(distance) || distance <= 0) return;

      const previousDistance = Number.parseFloat(
        tickerTrack.style.getPropertyValue("--ticker-distance")
      ) || 0;

      if (Math.abs(distance - previousDistance) < 0.5) return;

      // Aproximadamente 46 px/s: mantiene la misma sensación al cambiar de
      // tamaño, fuente o espaciado en escritorio y móvil.
      const duration = Math.max(14, distance / 46);
      tickerTrack.style.setProperty("--ticker-distance", distance + "px");
      tickerTrack.style.setProperty("--ticker-duration", duration + "s");

      // Reinicia solo al cambiar el tamaño medido; no hay reinicios por frame.
      tickerTrack.style.animation = "none";
      void tickerTrack.offsetWidth;
      tickerTrack.style.animation = "";
    };

    const scheduleTickerMeasure = () => {
      window.cancelAnimationFrame(tickerMeasureFrame);
      tickerMeasureFrame = window.requestAnimationFrame(measureTicker);
    };

    if ("ResizeObserver" in window) {
      const tickerObserver = new ResizeObserver(scheduleTickerMeasure);
      tickerObserver.observe(firstTickerSet);
    }
    window.addEventListener("resize", scheduleTickerMeasure, { passive: true });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleTickerMeasure);
    }
    scheduleTickerMeasure();
  }

  let scrollQueued = false;
  function updateProgress() {
    if (!progressBar) return;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const percentage = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    progressBar.style.width = Math.min(100, Math.max(0, percentage)) + "%";
    scrollQueued = false;
  }
  window.addEventListener("scroll", () => {
    if (!scrollQueued) {
      window.requestAnimationFrame(updateProgress);
      scrollQueued = true;
    }
  }, { passive: true });
  updateProgress();

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  let toastTimer;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }

  async function copyCurrentLink() {
    const url = window.location.href;
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      return;
    }

    const helper = document.createElement("textarea");
    helper.value = url;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    if (!copied) throw new Error("No se pudo copiar el enlace.");
  }

  if (shareButton) {
    shareButton.addEventListener("click", async () => {
      const shareData = {
        title: document.title,
        text: "Portafolio creativo de LAYON303V",
        url: window.location.href
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error && error.name === "AbortError") return;
        }
      }

      try {
        await copyCurrentLink();
        showToast("Enlace del portafolio copiado.");
      } catch {
        showToast("Copia la dirección desde la barra del navegador.");
      }
    });
  }
})();