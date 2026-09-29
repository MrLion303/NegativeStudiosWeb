document.addEventListener('DOMContentLoaded', () => {
  const slides = Array.from(document.querySelectorAll('.home-hero-slides .home-slide'));
  if (slides.length >= 2) {
    let current = 0;
    let timer = null;
    const DISPLAY_TIME = 12000;
    const FADE_TIME = 3200;
    slides.forEach((slide, index) => slide.classList.toggle('is-active', index === 0));
    const next = () => {
      const previous = slides[current];
      current = (current + 1) % slides.length;
      const nextSlide = slides[current];
      nextSlide.style.zIndex = '2';
      previous.style.zIndex = '1';
      nextSlide.classList.add('is-active');
      window.setTimeout(() => {
        previous.classList.remove('is-active');
        previous.style.zIndex = '';
        nextSlide.style.zIndex = '1';
      }, FADE_TIME + 100);
    };
    const start = () => { if (!timer) timer = window.setInterval(next, DISPLAY_TIME); };
    const stop = () => { if (timer) { window.clearInterval(timer); timer = null; } };
    start();
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
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
  const PROJECT_TIME = 6500;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const showProject = (index, resetTimer = true) => {
    currentProject = (index + projectSlides.length) % projectSlides.length;
    projectSlides.forEach((slide, i) => {
      const active = i === currentProject;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    dots.forEach((dot, i) => {
      const active = i === currentProject;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (resetTimer) startProjectTimer();
  };

  const startProjectTimer = () => {
    if (reduceMotion) return;
    if (projectTimer) window.clearInterval(projectTimer);
    projectTimer = window.setInterval(() => showProject(currentProject + 1, false), PROJECT_TIME);
  };
  const stopProjectTimer = () => {
    if (projectTimer) {
      window.clearInterval(projectTimer);
      projectTimer = null;
    }
  };

  prev?.addEventListener('click', () => showProject(currentProject - 1));
  next?.addEventListener('click', () => showProject(currentProject + 1));
  dots.forEach(dot => dot.addEventListener('click', () => showProject(Number(dot.dataset.projectDot))));
  carousel.addEventListener('mouseenter', stopProjectTimer);
  carousel.addEventListener('mouseleave', startProjectTimer);
  carousel.addEventListener('focusin', stopProjectTimer);
  carousel.addEventListener('focusout', event => {
    if (!carousel.contains(event.relatedTarget)) startProjectTimer();
  });
  document.addEventListener('visibilitychange', () => document.hidden ? stopProjectTimer() : startProjectTimer());

  showProject(0, false);
  startProjectTimer();
});