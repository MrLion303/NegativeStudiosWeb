document.addEventListener('DOMContentLoaded', () => {
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReducedMotion = () => motionPreference.matches;
  const slides = Array.from(document.querySelectorAll('.home-hero-slides .home-slide'));

  if (slides.length >= 2) {
    let current = 0;
    let timer = null;
    let transitionTimer = null;
    const DISPLAY_TIME = 12000;
    const FADE_TIME = 3200;

    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const resetToFirstSlide = () => {
      stop();
      if (transitionTimer) {
        window.clearTimeout(transitionTimer);
        transitionTimer = null;
      }
      current = 0;
      slides.forEach((slide, index) => {
        slide.classList.toggle('is-active', index === 0);
        slide.style.zIndex = '';
      });
    };

    const next = () => {
      if (prefersReducedMotion() || document.hidden) return;

      const previous = slides[current];
      current = (current + 1) % slides.length;
      const nextSlide = slides[current];

      if (transitionTimer) window.clearTimeout(transitionTimer);
      nextSlide.style.zIndex = '2';
      previous.style.zIndex = '1';
      nextSlide.classList.add('is-active');

      transitionTimer = window.setTimeout(() => {
        previous.classList.remove('is-active');
        previous.style.zIndex = '';
        nextSlide.style.zIndex = '1';
        transitionTimer = null;
      }, FADE_TIME + 100);
    };

    const start = () => {
      if (prefersReducedMotion() || document.hidden || timer) return;
      timer = window.setInterval(next, DISPLAY_TIME);
    };

    slides.forEach((slide, index) => slide.classList.toggle('is-active', index === 0));

    if (prefersReducedMotion()) resetToFirstSlide();
    else start();

    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    motionPreference.addEventListener('change', () => {
      if (prefersReducedMotion()) resetToFirstSlide();
      else start();
    });
  }

  const carousel = document.querySelector('[data-home-project-carousel]');
  if (!carousel) return;

  const projectSlides = Array.from(carousel.querySelectorAll('[data-project-slide]'));
  const dots = Array.from(carousel.querySelectorAll('[data-project-dot]'));
  const prev = carousel.querySelector('[data-project-prev]');
  const next = carousel.querySelector('[data-project-next]');

  if (projectSlides.length < 2) return;

  let currentProject = 0;
  let projectTimer = null;
  const PROJECT_TIME = 5000;

  projectSlides.forEach((slide, index) => {
    if (!slide.id) slide.id = `home-project-slide-${index}`;
  });
  dots.forEach((dot, index) => {
    dot.setAttribute('role', 'tab');
    if (projectSlides[index]) dot.setAttribute('aria-controls', projectSlides[index].id);
    else dot.disabled = true;
  });

  const stopProjectTimer = () => {
    if (projectTimer) {
      window.clearInterval(projectTimer);
      projectTimer = null;
    }
  };

  const startProjectTimer = () => {
    stopProjectTimer();
    if (prefersReducedMotion() || document.hidden || carousel.matches(':hover') || carousel.contains(document.activeElement)) return;
    projectTimer = window.setInterval(() => showProject(currentProject + 1, false), PROJECT_TIME);
  };

  const showProject = (index, resetTimer = true) => {
    currentProject = (index + projectSlides.length) % projectSlides.length;
    projectSlides.forEach((slide, i) => {
      const active = i === currentProject;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      slide.tabIndex = active ? 0 : -1;
    });
    dots.forEach((dot, i) => {
      const active = i === currentProject;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', active ? 'true' : 'false');
      dot.tabIndex = active ? 0 : -1;
    });
    if (resetTimer) startProjectTimer();
  };

  prev?.addEventListener('click', () => showProject(currentProject - 1));
  next?.addEventListener('click', () => showProject(currentProject + 1));

  dots.forEach((dot, index) => {
    if (dot.disabled) return;
    dot.addEventListener('click', () => showProject(index));
    dot.addEventListener('keydown', event => {
      let target = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = currentProject + 1;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = currentProject - 1;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = projectSlides.length - 1;
      if (target === null) return;
      event.preventDefault();
      showProject(target);
      dots[currentProject]?.focus();
    });
  });

  carousel.addEventListener('mouseenter', stopProjectTimer);
  carousel.addEventListener('mouseleave', startProjectTimer);
  carousel.addEventListener('focusin', stopProjectTimer);
  carousel.addEventListener('focusout', event => {
    if (!carousel.contains(event.relatedTarget)) startProjectTimer();
  });
  document.addEventListener('visibilitychange', () => document.hidden ? stopProjectTimer() : startProjectTimer());
  motionPreference.addEventListener('change', () => {
    if (prefersReducedMotion()) {
      stopProjectTimer();
      showProject(0, false);
    } else {
      startProjectTimer();
    }
  });

  showProject(0, false);
  startProjectTimer();
});
