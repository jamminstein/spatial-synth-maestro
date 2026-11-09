'use strict';

// An explicit, quiet gallery. The visible image is replaced only after a new
// image has loaded and decoded. No slideshow, preload queue or media controls.
(() => {
  // The selected sequence is weather, night glass, tidal (original 2, 3, 1).
  const images = [
    {"src": "media/concept-weather.webp", "width": 2048, "height": 1152, "name": "weather room", "alt": "AI-generated concept art: a curved concrete room beneath an oval opening to a cloudy sky, with suspended ink lines and dots. An imagined setting, not app or headset footage."},
    {"src": "media/concept-night.webp", "width": 2048, "height": 1152, "name": "night glass", "alt": "AI-generated concept art: a dim glass-roofed conservatory with weathered window frames, bare trees outside and suspended ink loops and lines. An imagined setting, not app or headset footage."},
    {"src": "media/concept-tidal.webp", "width": 2048, "height": 1152, "name": "tidal room", "alt": "AI-generated concept art: a worn tiled room with still water, a narrow concrete walkway and suspended ink loops. An imagined setting, not app or headset footage."}
  ];
  const compositions = [
    { featured: 'luna', name: 'Almost Asleep', voices: [
      ["luna", 36, 43, 27, 72, 6, 12, -7, false, false],
      ["seance", 68, 40, 13, 24, -11, -17, 8, false, true],
      ["poly-perc", 49, 78, 14, 134, 12, -8, -5, false, true],
      ["glass-arp", 78, 66, 13, 22, 6, 18, 7, false, false]
    ], routes: ["M328 313v38h139v78m-8-12 8 12 6-15", "M640 299h71v31h50m-188 150h58m11 0h8"] },
    { featured: 'seance', name: 'Someone Else', voices: [
      ["seance", 31, 42, 27, 72, -8, 17, 4, true, false],
      ["luna", 64, 25, 12, 24, 8, -12, -9, false, false],
      ["glass-arp", 76, 66, 14, 114, -12, -19, 7, true, true],
      ["poly-perc", 39, 78, 14, 148, 11, 9, -6, true, true]
    ], routes: ["M295 273h71v33h126m11 0h24m181 126h50v-43", "M368 481h86v-27h83m-10-8 10 8-13 2"] },
    { featured: 'tape-hymn', name: 'An Old Feeling', voices: [
      ["luna", 42, 25, 12, -32, 8, -12, -8, false, false],
      ["glass-arp", 77, 28, 12, 34, -10, 16, 5, false, false],
      ["finger-bass", 23, 72, 14, 142, -13, -16, -6, false, true],
      ["tape-hymn", 63, 56, 27, 88, 12, -11, 9, false, false]
    ], routes: ["M252 455h91v-22h132m48-170h87v18h96m-12-8 12 8-14 2", "M638 472h53v-38h56m-390-250h32m11 0h7"] }
  ];
  const NS = 'http://www.w3.org/2000/svg';
  function nativeAsset(source, document) {
    const revision = document?.documentElement?.dataset?.mediaRevision;
    if (typeof source !== 'string' || !/^media\/modules\/[a-z0-9-]+-native\.png(?:[?#]|$)/.test(source) ||
        typeof revision !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(revision)) return source;
    const [address, fragment] = source.split('#', 2), question = address.indexOf('?');
    const pathname = question < 0 ? address : address.slice(0, question);
    const query = new URLSearchParams(question < 0 ? '' : address.slice(question + 1));
    query.set('v', revision);
    return `${pathname}?${query}${fragment === undefined ? '' : `#${fragment}`}`;
  }
  function overlayNodes(document, composition) {
    const nodes = [];
    const routes = document.createElementNS(NS, 'svg');
    routes.setAttribute('class', 'portal-routes'); routes.setAttribute('viewBox', '0 0 1000 650');
    routes.setAttribute('preserveAspectRatio', 'none'); routes.setAttribute('aria-hidden', 'true'); routes.setAttribute('focusable', 'false');
    composition.routes.forEach((drawing, index) => {
      const route = document.createElementNS(NS, 'path'); route.setAttribute('d', drawing);
      route.setAttribute('class', index ? 'portal-green-route' : 'portal-blue-route'); routes.append(route);
    });
    nodes.push(routes);
    const nativeImage = slug => {
      const img = document.createElement('img'); img.src = nativeAsset(`media/modules/${slug}-native.png`, document);
      img.width = 128; img.height = 128; img.alt = ''; img.setAttribute('aria-hidden', 'true'); img.decoding = 'async';
      return img;
    };
    for (const [slug, x, y, size, depth, rx, ry, turn, light, fractured] of composition.voices) {
      const plane = document.createElement('span'); plane.className = 'portal-voice';
      plane.setAttribute('data-tone', light ? 'light' : 'ink');
      plane.setAttribute('data-featured', String(slug === composition.featured));
      plane.setAttribute('data-voice', slug);
      for (const [name, value] of Object.entries({ x: `${x}%`, y: `${y}%`, size: `${size}%`, z: `${depth}px`, rx: `${rx}deg`, ry: `${ry}deg`, turn: `${turn}deg` })) plane.style.setProperty(`--ink-${name}`, value);
      plane.append(nativeImage(slug));
      if (fractured) {
        const fragment = document.createElement('span'); fragment.className = 'portal-ink-fragment'; fragment.append(nativeImage(slug)); plane.append(fragment);
      }
      if (slug === composition.featured) {
        const name = document.createElement('span');
        name.className = 'portal-voice-name'; name.setAttribute('data-pen', slug);
        name.textContent = composition.name; plane.append(name);
        const Event = document.defaultView?.CustomEvent;
        if (Event) document.dispatchEvent(new Event('maestro:pen-refresh', {
          detail: { element: name, text: composition.name }
        }));
      }
      nodes.push(plane);
    }
    return nodes;
  }
  const installed = new WeakSet();

  function install(document) {
    if (!document || installed.has(document)) return;
    const frame = document.getElementById('concept-frame');
    const controls = document.getElementById('concept-controls');
    const previous = document.getElementById('concept-previous');
    const next = document.getElementById('concept-next');
    const count = document.getElementById('concept-count');
    const status = document.getElementById('concept-status');
    const ink = document.getElementById('concept-ink');
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
          const overlay = ink ? overlayNodes(document, compositions[selected]) : [];
          // The loaded node itself becomes visible; there is no second URL swap
          // that could briefly expose a broken/empty replacement image.
          frame.replaceChildren(candidate);
          if (ink) ink.replaceChildren(...overlay);
          settled = true;
          current = selected;
          number();
          frame.setAttribute('aria-busy', 'false');
          status.textContent = `Concept image ${current + 1} of ${images.length}: ${item.name}, featuring ${compositions[selected].name}. AI-generated art, not headset footage.`;
        } catch { failed(); }
      }, { once: true });
      try { candidate.src = item.src; } catch { failed(); }
    }
    previous.addEventListener('click', () => choose(cursor - 1));
    next.addEventListener('click', () => choose(cursor + 1));
    number();
    if (ink) ink.replaceChildren(...overlayNodes(document, compositions[0]));
    frame.setAttribute('aria-busy', 'false');
    controls.hidden = false;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => install(document), { once: true });
    else install(document);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { nativeAsset, images, compositions, overlayNodes, install };
})();
