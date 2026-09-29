document.addEventListener('DOMContentLoaded', () => {
  const slides = Array.from(document.querySelectorAll('.home-hero-slides .home-slide'));
  if (slides.length < 2) return;

  let current = 0;
  let timer = null;

  // Netflix-style pacing: each image stays on screen for a while,
  // with a long, soft crossfade between scenes.
  const DISPLAY_TIME = 12000;
  const FADE_TIME = 3200;

  slides.forEach((slide, index) => {
    slide.classList.toggle('is-active', index === 0);
  });

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

  const start = () => {
    if (timer) return;
    timer = window.setInterval(next, DISPLAY_TIME);
  };

  const stop = () => {
    if (!timer) return;
    window.clearInterval(timer);
    timer = null;
  };

  start();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
});