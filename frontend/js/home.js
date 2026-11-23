(() => {
  const revealItems = [...document.querySelectorAll('.reveal')];
  document.querySelectorAll('.faq-item').forEach(item => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      document.querySelectorAll('.faq-item[open]').forEach(openItem => {
        if (openItem !== item) openItem.open = false;
      });
    });
  });

  if (!revealItems.length) return;

  document.documentElement.classList.add('reveal-ready');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealItems.forEach(item => item.classList.add('is-visible'));
    return;
  }

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });

  revealItems.forEach(item => revealObserver.observe(item));
})();
