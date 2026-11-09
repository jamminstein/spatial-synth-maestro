'use strict';

// Only a held hand makes contact. Pointer motion outside a gesture stays quiet.
(() => {
  const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));
  function boundedMove(start, dx, dy) {
    const x = clamp(dx, start.scene.left + 28 - start.center.x, start.scene.right - 28 - start.center.x);
    const y = clamp(dy, start.scene.top + 28 - start.center.y, start.scene.bottom - 28 - start.center.y);
    return { x: start.x + x / start.scaleX, y: start.y + y / start.scaleY };
  }
  function localPoint(matrix, x, y) {
    // Intersect a screen ray with the SVG's z=0 plane. An inverse 4x4 applied
    // to screen z=0 is NOT that intersection once CSS perspective is present.
    const p = matrix.m14 || 0, q = matrix.m24 || 0, w = matrix.m44 ?? 1;
    const a = matrix.a - x * p, c = matrix.c - x * q;
    const b = matrix.b - y * p, d = matrix.d - y * q;
    const e = x * w - matrix.e, f = y * w - matrix.f;
    const determinant = a * d - b * c;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-9) return null;
    const local = { x: (e * d - c * f) / determinant, y: (a * f - e * b) / determinant };
    return Number.isFinite(local.x) && Number.isFinite(local.y) ? local : null;
  }
  function projectionForQuad(points, width, height) {
    const [a, b, c, d] = points;
    const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x;
    const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y;
    let g = 0, h = 0;
    if (Math.abs(dx3) + Math.abs(dy3) > 1e-7) {
      const determinant = dx1 * dy2 - dx2 * dy1;
      if (Math.abs(determinant) < 1e-9) return null;
      g = (dx3 * dy2 - dx2 * dy3) / determinant;
      h = (dx1 * dy3 - dx3 * dy1) / determinant;
    }
    const matrix = { a: (b.x - a.x + g * b.x) / width, b: (b.y - a.y + g * b.y) / width,
      c: (d.x - a.x + h * d.x) / height, d: (d.y - a.y + h * d.y) / height,
      e: a.x, f: a.y, m14: g / width, m24: h / height, m44: 1 };
    const determinant = matrix.a * (matrix.d - matrix.f * matrix.m24)
      - matrix.c * (matrix.b - matrix.f * matrix.m14)
      + matrix.e * (matrix.b * matrix.m24 - matrix.d * matrix.m14);
    return Object.values(matrix).every(Number.isFinite) && Math.abs(determinant) > 1e-9 ? matrix : null;
  }
  function makeProjection(hand, document) {
    // SVG getScreenCTM omits CSS perspective/individual translations in some
    // browsers. Four invisible geometry points follow the actual painted plane.
    const width = hand.viewBox.baseVal.width, height = hand.viewBox.baseVal.height;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('aria-hidden', 'true'); group.setAttribute('opacity', '0');
    group.setAttribute('pointer-events', 'none');
    const probes = [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => {
      const probe = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      probe.setAttribute('cx', x); probe.setAttribute('cy', y); probe.setAttribute('r', '.01');
      group.appendChild(probe); return probe;
    });
    hand.appendChild(group);
    return () => projectionForQuad(probes.map(probe => {
      const rect = probe.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }), width, height);
  }
  function covered(path, rectangle, environment = globalThis, matrix = path.getScreenCTM?.()) {
    if (!rectangle.width || !rectangle.height || !path.isPointInFill) return false;
    try {
      if (!matrix) return false;
      // The painted palm/fingers, not the SVG's transparent outer rectangle.
      return [[.5,.5],[.3,.35],[.7,.35],[.3,.65],[.7,.65]].some(([x, y]) => {
        const point = localPoint(matrix, rectangle.left + rectangle.width * x, rectangle.top + rectangle.height * y);
        return Boolean(point && path.isPointInFill(new environment.DOMPoint(point.x, point.y)));
      });
    } catch { return false; }
  }
  function install(document, environment = globalThis) {
    const hands = [...document.querySelectorAll('[data-play-hand]')];
    if (!hands.length) return;
    const sound = environment.MaestroHandAudio?.create({ document, environment });
    const status = document.getElementById('hand-status');
    const mute = document.getElementById('hand-sound');
    let muted = false, active = null, frame = 0;
    const dragListeners = [];
    const listenDuringDrag = (name, callback) => {
      environment.addEventListener(name, callback, { capture: true, passive: false });
      dragListeners.push(() => environment.removeEventListener(name, callback, { capture: true }));
    };
    const states = hands.map(hand => ({ hand, x: 0, y: 0, room: hand.closest('.cover, .depth-room'), hits: new Set(), projection: makeProjection(hand, document) }));
    const say = text => { if (status) status.textContent = text; };
    const paint = state => {
      state.hand.style.setProperty('--hand-drag-x', `${state.x.toFixed(2)}px`);
      state.hand.style.setProperty('--hand-drag-y', `${state.y.toFixed(2)}px`);
    };
    function clearContacts(state) {
      for (const item of state.hits) {
        item.node.removeAttribute('data-hand-contact');
        sound?.leave(item.slug);
      }
      state.hits.clear();
    }
    function stop(announce = false) {
      if (frame) environment.cancelAnimationFrame(frame);
      frame = 0;
      const state = active; active = null;
      dragListeners.splice(0).forEach(remove => remove());
      sound?.stop();
      if (!state) return;
      paint(state); clearContacts(state);
      state.hand.dataset.grabbed = 'false';
      state.hand.setAttribute('aria-pressed', 'false');
      state.room.dataset.handGrabbed = 'false';
      try { if (state.pointer != null && state.hand.hasPointerCapture?.(state.pointer)) state.hand.releasePointerCapture(state.pointer); } catch { /* Capture may already be gone. */ }
      state.pointer = null;
      if (announce) say('Released.');
    }
    function updateContacts(state) {
      const path = state.hand.querySelector('path');
      const matrix = state.projection();
      const hits = new Set();
      for (const item of state.voices) {
        if (covered(path, item.image.getBoundingClientRect(), environment, matrix)) {
          hits.add(item); item.node.dataset.handContact = 'true';
          if (!state.hits.has(item)) sound?.contact(item.slug);
        }
      }
      for (const item of state.hits) if (!hits.has(item)) {
        item.node.removeAttribute('data-hand-contact'); sound?.leave(item.slug);
      }
      state.hits = hits;
    }
    function schedule(state) {
      if (frame) return;
      frame = environment.requestAnimationFrame(() => {
        frame = 0;
        if (active !== state) return;
        paint(state); updateContacts(state);
      });
    }
    function begin(state, pointer = null) {
      stop();
      const rect = state.hand.getBoundingClientRect();
      const parent = state.hand.parentElement;
      const parentRect = parent.getBoundingClientRect();
      state.start = { x: state.x, y: state.y, center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        scene: state.room.getBoundingClientRect(),
        scaleX: Math.max(.35, parentRect.width / (parent.clientWidth || parentRect.width)),
        scaleY: Math.max(.35, parentRect.height / (parent.clientHeight || parentRect.height)) };
      state.voices = [...state.room.querySelectorAll('[data-cover-voice], [data-hand-voice]')].map(node => ({
        node, image: node.querySelector('.ink-image > img') || node, slug: node.dataset.study || node.dataset.handVoice
      }));
      state.pointer = pointer; active = state;
      state.hand.dataset.grabbed = 'true'; state.room.dataset.handGrabbed = 'true';
      state.hand.setAttribute('aria-pressed', 'true');
      state.hand.focus({ preventScroll: true });
      sound?.arm();
      say(muted ? 'Hand grabbed. Sound is muted.' : 'Hand grabbed. Move over a drawing to play.');
      // Deliberately no contact update on a simple grab: movement starts sound.
    }
    for (const state of states) {
      const { hand } = state;
      hand.dataset.handReady = 'true'; hand.setAttribute('tabindex', '0'); hand.removeAttribute('aria-disabled');
      const move = event => {
        if (active !== state || event.pointerId !== state.pointer) return;
        if (event.pointerType === 'mouse' && event.buttons === 0) { stop(); return; }
        if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
        event.preventDefault(); event.stopPropagation();
        const dx = event.clientX - state.origin.x, dy = event.clientY - state.origin.y;
        if (Math.hypot(dx, dy) < 3) return;
        Object.assign(state, boundedMove(state.start, dx, dy)); schedule(state);
      };
      const end = event => {
        if (active === state && event.pointerId === state.pointer) {
          event.preventDefault(); event.stopPropagation(); stop();
        }
      };
      hand.addEventListener('pointerdown', event => {
        if (active?.pointer != null || event.button !== 0 || event.isPrimary === false ||
            !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
        event.preventDefault(); event.stopPropagation();
        begin(state, event.pointerId);
        state.origin = { x: event.clientX, y: event.clientY };
        listenDuringDrag('pointermove', move);
        listenDuringDrag('pointerup', end);
        listenDuringDrag('pointercancel', end);
        try { hand.setPointerCapture(event.pointerId); } catch { /* Window routing preserves the drag. */ }
      }, { passive: false });
      hand.addEventListener('lostpointercapture', end);
      hand.addEventListener('click', event => event.preventDefault());
      hand.addEventListener('keydown', event => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault(); if (event.repeat) return;
          if (active === state) stop(true); else begin(state);
        } else if (event.key === 'Escape') { event.preventDefault(); stop(true); }
        else if (event.key === 'Home') { event.preventDefault(); stop(); state.x = state.y = 0; paint(state); say('Hand returned.'); }
        else if (active === state && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) {
          event.preventDefault(); const step = event.shiftKey ? 40 : 16;
          const dx = (state.x - state.start.x) * state.start.scaleX + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0);
          const dy = (state.y - state.start.y) * state.start.scaleY + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0);
          Object.assign(state, boundedMove(state.start, dx, dy)); schedule(state);
        }
      });
      hand.addEventListener('blur', () => { if (active === state) stop(); });
    }
    if (mute) mute.disabled = false;
    mute?.addEventListener('click', () => {
      muted = !muted; stop(); sound?.setMuted(muted);
      mute.setAttribute('aria-pressed', String(muted));
      mute.setAttribute('aria-label', muted ? 'Enable hand sounds' : 'Mute hand sounds');
      say(muted ? 'Hand sounds muted.' : 'Hand sounds enabled. Grab a hand to play.');
    });
    const reset = () => { stop(); states.forEach(state => { state.x = state.y = 0; paint(state); }); };
    document.addEventListener('maestro:misprint', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    // A native film/study play gesture takes precedence, without restarting later.
    document.addEventListener('play', event => { if (event.target?.matches?.('audio, video')) stop(); }, true);
    environment.addEventListener('blur', () => stop());
    environment.addEventListener('pagehide', () => stop());
    environment.addEventListener('resize', reset, { passive: true });
    // Suppress only artwork selection/drag/callouts. Controls retain their native
    // keyboard and input behavior; links can still be activated normally.
    const artwork = '.cover, .depth-room, .concept-portal figure, .headset-widget, [data-footer-icon]';
    for (const name of ['dragstart', 'selectstart', 'contextmenu']) document.addEventListener(name, event => {
      if (event.target?.closest?.(artwork)) event.preventDefault();
    });
    return { stop, reset };
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => install(document), { once: true });
    else install(document);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { boundedMove, localPoint, projectionForQuad, covered, install };
})();
