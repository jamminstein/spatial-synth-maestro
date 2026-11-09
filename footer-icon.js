'use strict';

// The app's three real icon layers, with a finite pointer response and no loop.
(() => {
  const icon = document.querySelector('[data-footer-icon]');
  if (!icon) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, pointer = null;
  const reset = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; pointer = null;
    icon.style.setProperty('--icon-x', '0'); icon.style.setProperty('--icon-y', '0');
  };
  const draw = () => {
    frame = 0;
    if (reduced.matches || document.hidden || !pointer) return;
    const rect = icon.getBoundingClientRect();
    const clamp = value => Math.max(-1, Math.min(1, value));
    icon.style.setProperty('--icon-x', clamp((pointer.x - rect.left) / rect.width * 2 - 1).toFixed(3));
    icon.style.setProperty('--icon-y', clamp((pointer.y - rect.top) / rect.height * 2 - 1).toFixed(3));
  };
  icon.addEventListener('pointermove', event => {
    if (reduced.matches || document.hidden || !['mouse', 'pen'].includes(event.pointerType)) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(draw);
  }, { passive: true });
  for (const name of ['pointerleave', 'pointercancel', 'blur']) icon.addEventListener(name, reset);
  for (const name of ['dragstart', 'selectstart', 'contextmenu']) icon.addEventListener(name, event => event.preventDefault());
  reduced.addEventListener('change', reset);
  window.addEventListener('blur', reset); window.addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
})();
