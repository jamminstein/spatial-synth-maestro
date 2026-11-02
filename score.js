'use strict';

// A fresh print on arrival. Only an explicit click rerolls it afterwards.
// Decorative state never reads or writes the selector or either media player.
(() => {
  const imageLayers = new WeakMap();
  const nextSeed = seed => (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  function random(seed) {
    let state = Number(seed) >>> 0;
    return () => { state = nextSeed(state); return state / 4294967296; };
  }
  function freshSeed(source = globalThis.crypto) {
    if (source && typeof source.getRandomValues === 'function') {
      const value = new Uint32Array(1); source.getRandomValues(value); return value[0];
    }
    // Offline/older browsers still receive a new illustration, with no stored ID.
    return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0;
  }

  function ink(seed, sparse = false) {
    const next = random(seed);
    const centers = [[101, 129, 70, 61], [204, 106, 63, 65], [291, 151, 50, 57]];
    const marks = [];
    const add = (x, y, width, height, hole = false) => {
      x = Math.max(0, Math.min(398, Math.round(x)));
      y = Math.max(0, Math.min(238, Math.round(y)));
      marks.push({ x, y, width: Math.min(width, 400 - x), height: Math.min(height, 240 - y), hole });
    };
    // Solid failures first; ragged pixels and paper cuts interrupt their edges.
    for (let i = 0; i < 26; i++) add(70 + next() * 210, 60 + next() * 110, 17 + Math.floor(next() * 57), 6 + Math.floor(next() * 24));
    for (let i = 0; i < 700; i++) {
      const [cx, cy, sx, sy] = centers[Math.floor(next() * centers.length)];
      const bell = () => (next() + next() + next() - 1.5) / 1.5;
      add(cx + bell() * sx, cy + bell() * sy, 2 + Math.floor(next() * (i % 9 === 0 ? 54 : 16)), 1 + Math.floor(next() * 7), i % 6 === 0);
    }
    for (let i = 0; i < 14; i++) add(40 + next() * 240, 64 + next() * 124, 38 + Math.floor(next() * 100), 1 + Math.floor(next() * 3), true);
    return sparse ? marks.filter((_, index) => index % 4 === 0) : marks;
  }

  function fragments(seed, light = false) {
    const next = random(seed);
    const marks = [0, 1, 2, 3].map((_, index) => ({
      top: [12, 34, 61, 77][index] + Math.floor(next() * 8),
      height: [17, 24, 13, 12][index],
      x: +(next() * 50 - 25).toFixed(2),
      y: +(next() * 22 - 11).toFixed(2),
      stretch: +(1.15 + next() * 1.05).toFixed(2),
      negative: index === 1,
      duplicate: index === 3,
      z: [-78, 72, -28, 132][index] + Math.round(next() * 24 - 12),
      pitch: [-12, 16, -10, 22][index] + +(next() * 8 - 4).toFixed(2),
      yaw: [-20, 25, 12, -18][index] + +(next() * 12 - 6).toFixed(2)
    }));
    // The cover leaves room for its hand; elsewhere the full misprint remains.
    return light ? [marks[0], marks[3]].map(mark => ({
      ...mark, x: mark.x * .55, y: mark.y * .5, stretch: 1 + (mark.stretch - 1) * .35
    })) : marks;
  }

  function noisePlanes(seed) {
    const next = random(seed);
    return [-136, 12, 154].map((z, index) => ({
      z: z + Math.round(next() * 24 - 12),
      pitch: [-17, 8, 22][index] + +(next() * 8 - 4).toFixed(2),
      yaw: [19, -12, -23][index] + +(next() * 10 - 5).toFixed(2),
      x: +(next() * 12 - 6).toFixed(2), y: +(next() * 10 - 5).toFixed(2)
    }));
  }
  function ribbons(seed) {
    const next = random(seed);
    return [-190, -65, 24, 156, 88].map((z, index) => ({
      z: z + Math.round(next() * 28 - 14),
      x: [-4, 34, -15, 58, 10][index] + +(next() * 6 - 3).toFixed(2),
      y: [12, 48, 71, 33, 64][index] + +(next() * 8 - 4).toFixed(2),
      width: [108, 66, 90, 42, 76][index], height: [90, 45, 70, 32, 50][index],
      pitch: [35, -14, 20, 60, -22][index] + +(next() * 10 - 5).toFixed(2),
      yaw: [-10, 20, -18, 35, 10][index] + +(next() * 12 - 6).toFixed(2),
      roll: +(next() * 14 - 7).toFixed(2)
    }));
  }

  function decorate(document, seed) {
    document.querySelectorAll('[data-noise]').forEach(volume => {
      volume.replaceChildren();
      const localSeed = Number(volume.dataset.noise) ^ seed;
      const surfaces = noisePlanes(localSeed).map(plane => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'noise-plane'); svg.setAttribute('viewBox', '0 0 400 240');
        svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
        Object.entries(plane).forEach(([key, value]) => svg.style.setProperty(`--plane-${key}`, `${value}${['pitch', 'yaw'].includes(key) ? 'deg' : key === 'z' ? 'px' : '%'}`));
        volume.append(svg); return svg;
      });
      ink(localSeed, volume.dataset.noiseDensity === 'sparse').forEach((mark, index) => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        ['x', 'y', 'width', 'height'].forEach(key => rect.setAttribute(key, String(mark[key])));
        if (mark.hole) rect.setAttribute('class', 'paper-cut');
        surfaces[index % surfaces.length].append(rect);
      });
    });
    document.querySelectorAll('[data-ribbons]').forEach(world => {
      world.replaceChildren();
      ribbons(Number(world.dataset.ribbons) ^ seed).forEach((plan, index) => {
        const ribbon = document.createElement('span'); ribbon.className = 'spatial-ribbon';
        Object.entries(plan).forEach(([key, value]) => ribbon.style.setProperty(`--ribbon-${key}`, `${value}${['pitch', 'yaw', 'roll'].includes(key) ? 'deg' : ['z', 'height'].includes(key) ? 'px' : '%'}`));
        const face = document.createElement('span'); face.className = 'ribbon-face';
        const drawing = document.createElement('img');
        drawing.src = index % 2 ? 'media/modules/poly-perc-native.png' : 'media/modules/seance-native.png';
        drawing.alt = ''; drawing.width = 128; drawing.height = 128; drawing.setAttribute('aria-hidden', 'true');
        face.append(drawing); ribbon.append(face); world.append(ribbon);
      });
    });
    document.querySelectorAll('[data-shatter]').forEach(frame => {
      if (!imageLayers.has(frame)) {
        const original = frame.querySelector('img');
        if (!original) return;
        const layer = document.createElement('span');
        layer.className = 'fragment-layer'; layer.setAttribute('aria-hidden', 'true');
        frame.append(layer); imageLayers.set(frame, { original, layer });
      }
      const { original, layer } = imageLayers.get(frame);
      frame.dataset.printed = 'true'; layer.replaceChildren();
      fragments(Number(frame.dataset.shatter) ^ seed, frame.dataset.fragments === 'light').forEach(mark => {
        const slice = document.createElement('span');
        slice.className = `image-fragment${mark.negative ? ' negative' : ''}${mark.duplicate ? ' duplicate' : ''}`;
        slice.style.setProperty('--slice-top', `${mark.top}%`);
        slice.style.setProperty('--slice-bottom', `${100 - mark.top - mark.height}%`);
        slice.style.setProperty('--slice-x', `${mark.x}%`);
        slice.style.setProperty('--slice-y', `${mark.y}%`);
        slice.style.setProperty('--slice-stretch', String(mark.stretch));
        slice.style.setProperty('--slice-z', `${mark.z}px`);
        slice.style.setProperty('--slice-pitch', `${mark.pitch}deg`);
        slice.style.setProperty('--slice-yaw', `${mark.yaw}deg`);
        const copy = document.createElement('img');
        copy.src = original.getAttribute('src'); copy.alt = ''; copy.width = 128; copy.height = 128;
        copy.setAttribute('aria-hidden', 'true');
        slice.append(copy); layer.append(slice);
      });
    });
  }

  function depthPose(x, y) {
    const bounded = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    return { yaw: +(bounded(x) * 5).toFixed(3), pitch: +(-bounded(y) * 3).toFixed(3) };
  }
  function installDepth(document, environment = globalThis) {
    const reduced = environment.matchMedia?.('(prefers-reduced-motion: reduce)');
    const fine = environment.matchMedia?.('(hover: hover) and (pointer: fine)');
    document.querySelectorAll('[data-depth-scene]').forEach(room => {
      const reset = () => { room.style.setProperty('--pitch', '0deg'); room.style.setProperty('--yaw', '0deg'); };
      room.addEventListener('pointermove', event => {
        if (reduced?.matches || !fine?.matches || (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen')) return;
        const rect = room.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const pose = depthPose((event.clientX - rect.left) / rect.width * 2 - 1, (event.clientY - rect.top) / rect.height * 2 - 1);
        room.style.setProperty('--pitch', `${pose.pitch}deg`); room.style.setProperty('--yaw', `${pose.yaw}deg`);
      }, { passive: true });
      room.addEventListener('pointerleave', reset, { passive: true });
      reduced?.addEventListener('change', reset); fine?.addEventListener('change', reset);
    });
  }

  function install(document, options = {}) {
    let seed = Number.isFinite(options.seed) ? Number(options.seed) >>> 0 : freshSeed(options.crypto);
    let count = 1;
    const print = () => {
      document.documentElement.dataset.printSeed = String(seed);
      decorate(document, seed);
      const Event = document.defaultView?.CustomEvent || globalThis.CustomEvent;
      if (Event) document.dispatchEvent(new Event('maestro:misprint', { detail: { seed } }));
    };
    print(); installDepth(document, options.environment || globalThis);
    const button = document.getElementById('misprint-again');
    const status = document.getElementById('misprint-status');
    if (!button || !status) return;
    button.disabled = false;
    button.addEventListener('keydown', event => {
      if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
    });
    button.addEventListener('click', () => {
      seed = nextSeed(seed); count++; print();
      status.textContent = `Print ${String(count).padStart(2, '0')}. Illustration changed. Sound is unchanged.`;
    });
  }
  if (typeof document !== 'undefined') install(document);
  if (typeof module !== 'undefined' && module.exports) module.exports = { ink, fragments, decorate, install, nextSeed, freshSeed, depthPose, installDepth, noisePlanes, ribbons };
})();
