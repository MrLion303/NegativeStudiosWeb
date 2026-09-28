document.addEventListener('DOMContentLoaded', () => {
  const slides = Array.from(document.querySelectorAll('.home-hero-slides .home-slide'));
  if (!slides.length) return;

  let current = 0;
  let timer = null;
  const interval = 5200;

  const show = (index) => {
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
  };

  const next = () => {
    current = (current + 1) % slides.length;
    show(current);
  };

  const start = () => {
    if (timer || slides.length < 2) return;
    timer = window.setInterval(next, interval);
  };

  const stop = () => {
    if (!timer) return;
    window.clearInterval(timer);
    timer = null;
  };

  show(0);
  start();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
});
