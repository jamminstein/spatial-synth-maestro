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

// Keep pointer ownership outside the small visual surface. Native capture is
// helpful, but a failed capture must not turn a real 3D drag into image dragging.
export function attachTrackball(surface, { initial = [0, 0, 0, 1], onChange,
  document = surface.ownerDocument, window = document.defaultView }) {
  let orientation = normalize(initial), pointer = null, previous = null, bounds = null, disposed = false;
  const listeners = [], dragging = [];
  const listen = (target, name, callback, options, bag = listeners) => {
    target.addEventListener(name, callback, options);
    bag.push(() => target.removeEventListener(name, callback, options));
  };
  const consume = event => {
    if (event.cancelable !== false) event.preventDefault();
    event.stopPropagation();
  };
  const finish = () => {
    const captured = pointer;
    pointer = null; previous = null; bounds = null;
    delete surface.dataset.dragging;
    dragging.splice(0).forEach(remove => remove());
    if (captured !== null) {
      try { if (surface.hasPointerCapture?.(captured)) surface.releasePointerCapture(captured); } catch { /* Already released. */ }
    }
  };
  const inside = point => point.x >= bounds.left && point.x <= bounds.left + bounds.width &&
    point.y >= bounds.top && point.y <= bounds.top + bounds.height;
  const move = event => {
    if (disposed || event.pointerId !== pointer || !previous) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) { finish(); return; }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    consume(event);
    const next = { x: event.clientX, y: event.clientY };
    const dx = next.x - previous.x, dy = next.y - previous.y;
    if (dx === 0 && dy === 0) return;
    let turn;
    if (inside(previous) && inside(next)) {
      turn = between(ballPoint(previous.x, previous.y, bounds), ballPoint(next.x, next.y, bounds));
    } else {
      // Far outside the sphere, projection alone approaches zero sensitivity.
      // Continue the same free quaternion motion with screen-space displacement.
      const distance = Math.hypot(dx, dy), radius = Math.max(1, Math.min(bounds.width, bounds.height) * .46);
      turn = axisTurn([dy / distance, dx / distance, 0], distance / radius);
    }
    orientation = multiply(turn, orientation); previous = next;
    onChange([...orientation]);
  };
  const end = event => { if (event.pointerId === pointer) { consume(event); finish(); } };
  listen(surface, 'pointerdown', event => {
    if (disposed || pointer !== null || event.isPrimary === false || event.button !== 0 ||
        !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    const rect = surface.getBoundingClientRect();
    if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return;
    consume(event);
    pointer = event.pointerId; previous = { x: event.clientX, y: event.clientY };
    bounds = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    surface.dataset.dragging = 'true';
    // These listeners exist only for one owned drag. The same event is handled
    // once at window capture, including moves beyond the canvas/DOM bounds.
    for (const [name, callback] of [['pointermove', move], ['pointerup', end], ['pointercancel', end],
      ['dragstart', consume], ['selectstart', consume], ['contextmenu', consume]]) {
      listen(window, name, callback, { capture: true, passive: false }, dragging);
    }
    try { surface.focus({ preventScroll: true }); } catch { /* Rotation can still work without programmatic focus. */ }
    try { surface.setPointerCapture?.(pointer); } catch { /* Window routing retains the owned drag. */ }
  }, { passive: false });
  listen(surface, 'lostpointercapture', event => { if (event.pointerId === pointer) finish(); });
  listen(surface, 'keydown', event => {
    if (disposed || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? .28 : .14;
    const rotations = { ArrowLeft: [[0, 1, 0], -step], ArrowRight: [[0, 1, 0], step],
      ArrowUp: [[1, 0, 0], -step], ArrowDown: [[1, 0, 0], step],
      q: [[0, 0, 1], step], Q: [[0, 0, 1], step], e: [[0, 0, 1], -step], E: [[0, 0, 1], -step] };
    if (event.key === 'Escape') { finish(); return; }
    if (event.key !== 'Home' && !rotations[event.key]) return;
    consume(event); finish();
    orientation = event.key === 'Home' ? normalize(initial) : multiply(axisTurn(...rotations[event.key]), orientation);
    onChange([...orientation]);
  });
  listen(surface, 'blur', finish); listen(window, 'blur', finish);
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
