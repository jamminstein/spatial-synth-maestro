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
  // Keep every rectangle and its depth assignment. Same-winding subpaths use
  // nonzero fill, so overlapping ink and mask cuts retain their vector union.
  function noisePaths(marks) {
    const planes = Array.from({ length: 3 }, () => ({ ink: [], holes: [] }));
    marks.forEach((mark, index) => {
      planes[index % 3][mark.hole ? 'holes' : 'ink'].push(`M${mark.x} ${mark.y}h${mark.width}v${mark.height}h${-mark.width}Z`);
    });
    return planes.map(plane => ({ ink: plane.ink.join(''), holes: plane.holes.join('') }));
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

  const coverStates = new WeakMap();
  const voiceIDs = ['luna', 'glass-arp', 'finger-bass', 'poly-perc', 'seance', 'tape-hymn'];
  const coverFamilies = [
    [[17, 20, 15], [77, 34, 14], [87, 60, 13], [70, 86, 14], [26, 82, 15], [9, 52, 13]],
    [[28, 18, 14], [76, 34, 15], [85, 61, 14], [68, 86, 15], [22, 83, 13], [10, 49, 14]],
    [[16, 23, 16], [63, 20, 13], [86, 51, 15], [77, 85, 13], [31, 85, 14], [10, 60, 14]],
    [[20, 18, 13], [69, 28, 14], [87, 61, 14], [58, 86, 15], [18, 82, 14], [10, 49, 14]]
  ];
  const mobileCoverFamilies = [
    [[22, 24, 28], [79, 35, 27], [83, 61, 27], [73, 86, 27], [23, 84, 28], [17, 54, 27]],
    [[25, 23, 29], [77, 37, 28], [82, 63, 26], [69, 86, 29], [20, 82, 27], [18, 52, 26]],
    [[21, 27, 27], [72, 25, 27], [82, 50, 29], [77, 84, 26], [23, 86, 28], [16, 59, 28]],
    [[23, 24, 27], [73, 33, 29], [82, 61, 27], [68, 86, 28], [21, 82, 28], [17, 53, 26]]
  ];
  const overlap = (a, b, gap = 0) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  function coverComposition(seed, width, height, options = {}) {
    const next = random(seed ^ 0x99f31ac7), family = (seed >>> 0) % 4, mobile = width <= 580;
    const margin = mobile ? 12 : 20, caption = mobile ? 76 : 80, gap = mobile ? 12 : 18;
    const safeZones = [
      { x: Math.max(0, width - (mobile ? 160 : 230)), y: 0, width: mobile ? 160 : 230, height: mobile ? 190 : 245 },
      mobile ? { x: 0, y: 0, width: 164, height: 88 } : { x: 0, y: height - 80, width: 195, height: 80 }
    ];
    let shift = options.shift ?? ((seed >>> 5) % 6);
    if (options.shift === undefined && shift === options.previousShift) shift = (shift + 3) % 6;
    const slots = (mobile ? mobileCoverFamilies : coverFamilies)[family].map(([cx, cy, size], index) => {
      const boxWidth = clamp(width * (size + next() * 2 - 1) / 100, mobile ? 84 : 108, mobile ? 162 : 172);
      return { slot: index, width: boxWidth, height: boxWidth + caption,
        x: clamp(width * (cx + next() * 2.4 - 1.2) / 100 - boxWidth / 2, margin, width - margin - boxWidth),
        y: clamp(height * (cy + next() * 2.4 - 1.2) / 100 - (boxWidth + caption) / 2, margin, height - (mobile ? margin : 100) - boxWidth - caption) };
    });
    // Resolve only vertical conflicts; there is no frame-by-frame layout movement.
    const placed = [];
    for (const box of [...slots].sort((a, b) => a.y - b.y)) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const obstacle = [...safeZones, ...placed].find(other => overlap(box, other, gap));
        if (!obstacle) break;
        box.y = obstacle.y + obstacle.height + gap;
      }
      placed.push(box);
    }
    const voices = voiceIDs.map((id, index) => {
      const slot = slots[(index + shift) % 6];
      return { ...slot, id, roll: +(next() * 54 - 27).toFixed(2), pitch: +(next() * 38 - 19).toFixed(2),
        yaw: +(next() * 54 - 27).toFixed(2), z: [-112, 145, -65, 175, 55, -140][slot.slot],
        follow: [-.55, .85, -.3, 1.05, .45, -.7][slot.slot] };
    });
    const handBases = [[52, 51, 38, 60, -18, 1], [49, 52, 42, 58, 22, -1], [43, 53, 35, 64, -27, 1], [59, 49, 42, 55, 14, -1]];
    const [hx, hy, hw, hh, roll, flip] = handBases[family];
    const handWidth = Math.min(width * (mobile ? [65, 70, 62, 67][family] : hw) / 100, 510);
    const handHeight = Math.min(height * (mobile ? [48, 49, 52, 46][family] : hh) / 100, 660);
    const hand = { x: width * (hx + next() * 3 - 1.5) / 100 - handWidth / 2, y: height * hy / 100 - handHeight / 2,
      width: handWidth, height: handHeight, roll: +(roll + next() * 12 - 6).toFixed(2), flip,
      pitch: [9, -12, 16, -5][family], yaw: [-22, 19, -14, 25][family], z: mobile ? 90 : 150 };
    const noiseCenters = [[49, 69], [39, 61], [55, 44], [66, 68]][family];
    const noiseWidth = Math.min(width * (mobile ? 25 : 15) / 100, 180);
    const noise = { x: width * noiseCenters[0] / 100 - noiseWidth / 2, y: height * noiseCenters[1] / 100 - noiseWidth * .3,
      width: noiseWidth, height: noiseWidth * .65, roll: +(next() * 80 - 40).toFixed(2), z: [-70, 80, -105, 125][family] };
    const routes = [0, 2, 4].map((slotIndex, index) => {
      const slot = slots[slotIndex], x = clamp((slot.x + slot.width * .65) / width * 1400 + next() * 70 - 35, 90, 1140);
      const y = clamp((slot.y + slot.width * .5) / height * 1000 + next() * 95 - 45, 140, 875);
      const dx = 55 + next() * 110, dy = (next() > .5 ? 1 : -1) * (18 + next() * 45);
      return { d: `M${x.toFixed(1)} ${y.toFixed(1)}h${(dx * .4).toFixed(1)}m18 0h${(dx * .2).toFixed(1)}v${dy.toFixed(1)}h${(dx * .25).toFixed(1)}`, blue: index === 1 };
    });
    return { family, shift, mobile, width, height, margin, safeZones, voices, hand, noise, routes };
  }
  function applyCover(stage, seed) {
    const rect = stage.getBoundingClientRect();
    if (rect.width < 280 || rect.height < 700) return;
    let state = coverStates.get(stage);
    if (!state) {
      state = { voices: [...stage.querySelectorAll('[data-cover-voice]')], hand: stage.querySelector('[data-cover-hand]'),
        noise: stage.querySelector('[data-cover-noise]'), routes: stage.querySelector('[data-cover-routes]') };
      coverStates.set(stage, state);
    }
    if (state.seed === seed && state.width === rect.width && state.height === rect.height) return;
    const options = state.seed === seed ? { shift: state.shift } : { previousShift: state.shift };
    const plan = coverComposition(seed, rect.width, rect.height, options);
    state.seed = seed; state.shift = plan.shift; state.width = rect.width; state.height = rect.height;
    stage.dataset.coverFamily = String(plan.family);
    const set = (node, prefix, properties) => {
      if (!node) return;
      for (const [key, value] of Object.entries(properties)) {
        const unit = ['roll', 'pitch', 'yaw'].includes(key) ? 'deg' : ['flip', 'follow'].includes(key) ? '' : 'px';
        node.style.setProperty(`--${prefix}-${key}`, `${value}${unit}`);
      }
    };
    for (const node of state.voices) {
      const voice = plan.voices.find(item => item.id === node.dataset.study);
      if (voice) { const { id, slot, ...properties } = voice; set(node, 'cover-voice', properties); }
    }
    set(state.hand, 'cover-hand', plan.hand); set(state.noise, 'cover-noise', plan.noise);
    if (state.routes) {
      state.routes.replaceChildren(...plan.routes.map(route => {
        const path = stage.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', route.d); if (route.blue) path.setAttribute('class', 'blue-route'); return path;
      }));
    }
  }
  function installCoverResize(document, environment = globalThis) {
    const stages = [...document.querySelectorAll('[data-cover-stage]')];
    const refresh = stage => { const state = coverStates.get(stage); if (state) applyCover(stage, state.seed); };
    if (typeof environment.ResizeObserver === 'function') {
      const observer = new environment.ResizeObserver(entries => entries.forEach(entry => refresh(entry.target)));
      stages.forEach(stage => observer.observe(stage));
    } else environment.addEventListener?.('resize', () => stages.forEach(refresh), { passive: true });
  }

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
  function decorate(document, seed) {
    document.querySelectorAll('[data-cover-stage]').forEach(stage => applyCover(stage, seed));
    document.querySelectorAll('[data-noise]').forEach((volume, volumeIndex) => {
      const localSeed = Number(volume.dataset.noise) ^ seed;
      const paths = noisePaths(ink(localSeed, volume.dataset.noiseDensity === 'sparse'));
      const surfaces = noisePlanes(localSeed).map((plane, planeIndex) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'noise-plane'); svg.setAttribute('viewBox', '0 0 400 240');
        svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
        Object.entries(plane).forEach(([key, value]) => svg.style.setProperty(`--plane-${key}`, `${value}${['pitch', 'yaw'].includes(key) ? 'deg' : key === 'z' ? 'px' : '%'}`));
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        const maskID = `ink-cut-${volumeIndex}-${planeIndex}`;
        mask.setAttribute('id', maskID); mask.setAttribute('maskUnits', 'userSpaceOnUse');
        mask.setAttribute('x', '0'); mask.setAttribute('y', '0'); mask.setAttribute('width', '400'); mask.setAttribute('height', '240');
        const paper = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        paper.setAttribute('width', '400'); paper.setAttribute('height', '240'); paper.setAttribute('fill', 'white');
        mask.append(paper); defs.append(mask);
        const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'g'); drawing.setAttribute('mask', `url(#${maskID})`);
        for (const [kind, target, className] of [['ink', drawing, 'ink-mark'], ['holes', mask, 'ink-hole']]) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('class', className); path.setAttribute('d', paths[planeIndex][kind]);
          path.setAttribute('fill-rule', 'nonzero');
          if (kind === 'holes') path.setAttribute('fill', 'black');
          target.append(path);
        }
        svg.append(defs); svg.append(drawing); return svg;
      });
      volume.replaceChildren(...surfaces);
    });
    document.querySelectorAll('[data-ribbons]').forEach(world => {
      world.replaceChildren();
      ribbons(Number(world.dataset.ribbons) ^ seed).forEach((plan, index) => {
        const ribbon = document.createElement('span'); ribbon.className = 'spatial-ribbon';
        Object.entries(plan).forEach(([key, value]) => ribbon.style.setProperty(`--ribbon-${key}`, `${value}${['pitch', 'yaw', 'roll'].includes(key) ? 'deg' : ['z', 'height'].includes(key) ? 'px' : '%'}`));
        const face = document.createElement('span'); face.className = 'ribbon-face';
        const drawing = document.createElement('img');
        drawing.src = nativeAsset(index % 2 ? 'media/modules/poly-perc-native.png' : 'media/modules/seance-native.png', document);
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
      const source = nativeAsset(original.getAttribute('src'), document);
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
        copy.src = source; copy.alt = ''; copy.width = 128; copy.height = 128;
        copy.setAttribute('aria-hidden', 'true');
        slice.append(copy); layer.append(slice);
      });
    });
  }

  function depthPose(x, y) {
    const bounded = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    return { yaw: +(bounded(x) * 5).toFixed(3), pitch: +(-bounded(y) * 3).toFixed(3) };
  }
  function coverDepthPose(x, y) {
    const bounded = value => Number.isFinite(value) ? clamp(value, -1, 1) : 0;
    return { yaw: +(bounded(x) * 11).toFixed(3), pitch: +(-bounded(y) * 7).toFixed(3),
      x: +(bounded(x) * 32).toFixed(3), y: +(bounded(y) * 22).toFixed(3) };
  }
  function installDepth(document, environment = globalThis) {
    const reduced = environment.matchMedia?.('(prefers-reduced-motion: reduce)');
    const fine = environment.matchMedia?.('(hover: hover) and (pointer: fine)');
    document.querySelectorAll('[data-depth-scene]').forEach(room => {
      const wide = room.dataset.depthResponse === 'cover';
      const reset = () => { room.style.setProperty('--pitch', '0deg'); room.style.setProperty('--yaw', '0deg');
        if (wide) { room.style.setProperty('--cover-follow-x', '0px'); room.style.setProperty('--cover-follow-y', '0px'); } };
      room.addEventListener('pointermove', event => {
        if (reduced?.matches || !fine?.matches || (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen')) return;
        const rect = room.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const pose = (wide ? coverDepthPose : depthPose)((event.clientX - rect.left) / rect.width * 2 - 1, (event.clientY - rect.top) / rect.height * 2 - 1);
        room.style.setProperty('--pitch', `${pose.pitch}deg`); room.style.setProperty('--yaw', `${pose.yaw}deg`);
        if (wide) { room.style.setProperty('--cover-follow-x', `${pose.x}px`); room.style.setProperty('--cover-follow-y', `${pose.y}px`); }
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
    print(); installDepth(document, options.environment || globalThis); installCoverResize(document, options.environment || globalThis);
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
  if (typeof module !== 'undefined' && module.exports) module.exports = { nativeAsset, ink, fragments, decorate, install, nextSeed, freshSeed, depthPose, installDepth, noisePlanes, noisePaths, ribbons, coverComposition, coverDepthPose };
})();
