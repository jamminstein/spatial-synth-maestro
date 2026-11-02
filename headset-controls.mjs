// Pure quaternion trackball + scoped input. No renderer, network or audio here.
export const normalize = values => {
  const length = Math.hypot(...values);
  return Number.isFinite(length) && length > 1e-10 ? values.map(value => value / length) : [0, 0, 0, 1];
};
export function multiply(a, b) {
  return normalize([
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ]);
}
export function axisTurn(axis, radians) {
  const half = radians / 2, sine = Math.sin(half);
  return normalize([axis[0] * sine, axis[1] * sine, axis[2] * sine, Math.cos(half)]);
}
export function ballPoint(x, y, rect) {
  if (![x, y, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) return [0, 0, 1];
  const radius = Math.max(1, Math.min(rect.width, rect.height) * .46);
  const px = (x - rect.left - rect.width / 2) / radius;
  const py = (rect.top + rect.height / 2 - y) / radius;
  const distance = px * px + py * py;
  const pz = distance <= .5 ? Math.sqrt(1 - distance) : .5 / Math.sqrt(distance);
  const length = Math.hypot(px, py, pz);
  return [px / length, py / length, pz / length];
}
export function between(a, b) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (dot < -.999999) {
    const axis = Math.abs(a[0]) < .8 ? [0, a[2], -a[1]] : [-a[2], 0, a[0]];
    return normalize([...axis, 0]);
  }
  return normalize([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0], 1 + dot]);
}

export function attachTrackball(surface, { initial = [0, 0, 0, 1], onChange, document = surface.ownerDocument, window = document.defaultView }) {
  let orientation = normalize(initial), pointer = null, previous = null, disposed = false;
  const listeners = [];
  const listen = (target, event, callback, options) => {
    target.addEventListener(event, callback, options);
    listeners.push(() => target.removeEventListener(event, callback, options));
  };
  const publish = () => { if (!disposed) onChange([...orientation]); };
  const finish = () => {
    const captured = pointer;
    pointer = null; previous = null;
    delete surface.dataset.dragging;
    if (captured !== null) {
      try { if (surface.hasPointerCapture(captured)) surface.releasePointerCapture(captured); } catch { /* Capture may already be lost. */ }
    }
  };
  listen(surface, 'pointerdown', event => {
    if (disposed || pointer !== null || event.isPrimary === false || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    pointer = event.pointerId;
    previous = ballPoint(event.clientX, event.clientY, surface.getBoundingClientRect());
    surface.dataset.dragging = 'true';
    surface.focus({ preventScroll: true });
    try { surface.setPointerCapture(pointer); } catch { finish(); }
  });
  listen(surface, 'pointermove', event => {
    if (disposed || event.pointerId !== pointer || !previous) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) { finish(); return; }
    event.preventDefault(); event.stopPropagation();
    const next = ballPoint(event.clientX, event.clientY, surface.getBoundingClientRect());
    orientation = multiply(between(previous, next), orientation);
    previous = next;
    publish();
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    listen(surface, eventName, event => { if (event.pointerId === pointer) finish(); });
  }
  listen(surface, 'keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? .28 : .14;
    const rotations = { ArrowLeft: [[0, 1, 0], -step], ArrowRight: [[0, 1, 0], step],
      ArrowUp: [[1, 0, 0], -step], ArrowDown: [[1, 0, 0], step],
      q: [[0, 0, 1], step], Q: [[0, 0, 1], step], e: [[0, 0, 1], -step], E: [[0, 0, 1], -step] };
    if (event.key === 'Escape') { finish(); return; }
    if (event.key !== 'Home' && !rotations[event.key]) return;
    event.preventDefault(); event.stopPropagation(); finish();
    orientation = event.key === 'Home' ? normalize(initial) : multiply(axisTurn(...rotations[event.key]), orientation);
    publish();
  });
  listen(surface, 'dragstart', event => event.preventDefault());
  listen(surface, 'blur', finish);
  listen(window, 'blur', finish);
  listen(document, 'visibilitychange', () => { if (document.hidden) finish(); });
  return { cancel: finish, get quaternion() { return [...orientation]; },
    dispose() { if (disposed) return; finish(); disposed = true; listeners.forEach(remove => remove()); } };
}

// At most one queued frame. The callback never schedules itself, even while a
// pointer is held still. Reduced-motion has no idle/inertial motion to disable.
export function demandFrames({ request, cancel, hidden, render }) {
  let pending = null, disposed = false;
  const stop = () => { if (pending !== null) cancel(pending); pending = null; };
  return {
    draw() {
      if (disposed || hidden() || pending !== null) return;
      pending = request(() => { pending = null; if (!disposed && !hidden()) render(); });
    },
    stop,
    dispose() { stop(); disposed = true; }
  };
}
