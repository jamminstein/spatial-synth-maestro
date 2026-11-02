'use strict';

// An explicit, quiet gallery. The visible image is replaced only after a new
// image has loaded and decoded. No slideshow, preload queue or media controls.
(() => {
  const images = [
    { src: 'media/concept-tidal.webp', width: 2048, height: 1152, name: 'tidal room',
      alt: 'AI-generated concept art: a worn tiled room with still water, a narrow concrete walkway and suspended ink loops. An imagined setting, not app or headset footage.' },
    { src: 'media/concept-weather.webp', width: 2048, height: 1152, name: 'weather room',
      alt: 'AI-generated concept art: a curved concrete room beneath an oval opening to a cloudy sky, with suspended ink lines and dots. An imagined setting, not app or headset footage.' },
    { src: 'media/concept-night.webp', width: 2048, height: 1152, name: 'night glass',
      alt: 'AI-generated concept art: a dim glass-roofed conservatory with weathered window frames, bare trees outside and suspended ink loops and lines. An imagined setting, not app or headset footage.' },
    { src: 'media/concept-studio.png', width: 1586, height: 992, name: 'sunlit studio',
      alt: 'AI-generated concept art: an imagined sunlit studio with floating ink forms. An imagined setting, not app or headset footage.' }
  ];
  const installed = new WeakSet();

  function install(document) {
    if (!document || installed.has(document)) return;
    const frame = document.getElementById('concept-frame');
    const controls = document.getElementById('concept-controls');
    const previous = document.getElementById('concept-previous');
    const next = document.getElementById('concept-next');
    const count = document.getElementById('concept-count');
    const status = document.getElementById('concept-status');
    if (![frame, controls, previous, next, count, status].every(Boolean)) return;
    installed.add(document);
    let current = 0, cursor = 0, request = 0;
    const number = () => { count.textContent = `${current + 1} / ${images.length}`; };

    function choose(index) {
      if (!Number.isInteger(index)) return;
      const selected = (index % images.length + images.length) % images.length;
      cursor = selected;
      const token = ++request;
      status.textContent = '';
      count.removeAttribute('title');
      if (selected === current) { frame.setAttribute('aria-busy', 'false'); return; }
      const item = images[selected];
      const candidate = document.createElement('img');
      candidate.id = 'concept-image';
      candidate.width = item.width; candidate.height = item.height;
      candidate.alt = item.alt; candidate.decoding = 'async';
      frame.setAttribute('aria-busy', 'true');
      let settled = false;
      const failed = () => {
        if (settled || token !== request) return;
        settled = true;
        frame.setAttribute('aria-busy', 'false');
        status.textContent = `The ${item.name} concept image could not load. The current image is unchanged. Try another arrow.`;
        count.setAttribute('title', 'Image unavailable. Try another arrow.');
      };
      candidate.addEventListener('error', failed, { once: true });
      candidate.addEventListener('load', async () => {
        if (settled || token !== request) return;
        try {
          if (!candidate.naturalWidth || !candidate.naturalHeight) { failed(); return; }
          if (typeof candidate.decode === 'function') await candidate.decode();
          if (settled || token !== request) return;
          settled = true;
          // The loaded node itself becomes visible; there is no second URL swap
          // that could briefly expose a broken/empty replacement image.
          frame.replaceChildren(candidate);
          current = selected;
          number();
          frame.setAttribute('aria-busy', 'false');
          status.textContent = `Concept image ${current + 1} of ${images.length}: ${item.name}. AI-generated art, not headset footage.`;
        } catch { failed(); }
      }, { once: true });
      try { candidate.src = item.src; } catch { failed(); }
    }
    previous.addEventListener('click', () => choose(cursor - 1));
    next.addEventListener('click', () => choose(cursor + 1));
    number();
    frame.setAttribute('aria-busy', 'false');
    controls.hidden = false;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => install(document), { once: true });
    else install(document);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { images, install };
})();
