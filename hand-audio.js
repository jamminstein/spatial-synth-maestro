'use strict';

// A touch-sized excerpt of the actual native recording, never a replacement synth.
// Nothing is fetched, decoded or connected until an explicit hand gesture arms it.
(() => {
  const SLUGS = new Set(['luna', 'glass-arp', 'finger-bass', 'poly-perc', 'seance', 'tape-hymn']);
  const CUE_SECONDS = .78, ATTACK = .025, RELEASE = .055, GAIN = .12;
  const MAX_VOICES = 3, MAX_CUES = 8, ARM_MS = 12000, INTENT_MS = 1600, COOLDOWN_MS = 950;

  function create({ document, environment = globalThis }) {
    const silent = new URLSearchParams(environment.location?.search || '').get('hand-audio') === 'silent';
    const revision = document.documentElement?.dataset?.mediaRevision || '';
    const mediaRevision = /^[a-zA-Z0-9_-]{1,64}$/.test(revision) ? revision : '';
    const contacts = new Map(), buffers = new Map(), loading = new Map(), lastCue = new Map(), voices = new Set();
    let context = null, ready = Promise.resolve(false), armed = false, muted = false;
    let generation = 0, armedAt = 0, cues = 0, armTimer = null;
    const now = () => environment.performance?.now() ?? Date.now();
    const timer = (fn, ms) => environment.setTimeout(fn, ms);
    const clear = id => { if (id !== null) environment.clearTimeout(id); };

    function clean(voice) {
      if (voice.finished) return;
      voice.finished = true;
      clear(voice.timer);
      voice.source.onended = null;
      try { voice.source.disconnect(); } catch { /* Already detached. */ }
      try { voice.gain.disconnect(); } catch { /* Already detached. */ }
      voices.delete(voice);
    }
    function gainAt(voice, time) {
      const age = Math.max(0, time - voice.at);
      if (age < ATTACK) return GAIN * age / ATTACK;
      if (age > voice.duration - RELEASE) return GAIN * Math.max(0, (voice.duration - age) / RELEASE);
      return GAIN;
    }
    function release(voice, immediately = false) {
      if (voice.finished) return;
      if (immediately || context?.state !== 'running') {
        try { voice.source.stop(); } catch { /* A failed start needs only detaching. */ }
        clean(voice);
        return;
      }
      if (voice.released) return;
      voice.released = true;
      const at = context.currentTime;
      try {
        voice.gain.gain.cancelScheduledValues(at);
        voice.gain.gain.setValueAtTime(gainAt(voice, at), at);
        voice.gain.gain.linearRampToValueAtTime(0, at + RELEASE);
        voice.source.stop(at + RELEASE);
        clear(voice.timer);
        // Wall-clock cleanup also prevents an interrupted context retaining a tail
        // that could reappear during a later, unrelated gesture.
        voice.timer = timer(() => clean(voice), RELEASE * 1000 + 25);
      } catch { clean(voice); }
    }
    function cancel(immediately = false) {
      armed = false;
      generation++;
      contacts.clear();
      clear(armTimer); armTimer = null;
      for (const voice of [...voices]) release(voice, immediately);
    }
    function current(slug, intent) {
      const elapsed = now() - armedAt;
      return armed && !muted && !document.hidden && intent.generation === generation &&
        contacts.get(slug) === intent && elapsed >= 0 && elapsed < ARM_MS && now() <= intent.expires;
    }
    function prepareContext() {
      if (!context || context.state === 'closed') {
        const AudioContext = environment.AudioContext || environment.webkitAudioContext;
        if (!AudioContext) return false;
        const created = new AudioContext();
        context = created;
        created.addEventListener?.('statechange', () => {
          if (context === created && created.state !== 'running') cancel(true);
        });
      }
      // resume must be invoked inside pointerdown/Space, before any fetch awaits.
      ready = context.state === 'running' ? Promise.resolve(true) :
        Promise.resolve(context.resume()).then(() => context.state === 'running', () => false);
      return true;
    }
    function arm() {
      cancel(true);
      if (muted || document.hidden) return false;
      armed = true; armedAt = now(); cues = 0;
      const epoch = generation;
      armTimer = timer(() => { if (generation === epoch) cancel(); }, ARM_MS);
      if (silent) return true; // No context constructor, graph connection, or network in QA.
      try { if (prepareContext()) return true; } catch { /* Unsupported or blocked audio stays quiet. */ }
      cancel(true);
      return false;
    }
    function load(slug, owner) {
      if (buffers.has(slug)) return Promise.resolve(buffers.get(slug));
      if (loading.has(slug)) return loading.get(slug);
      const request = (async () => {
        const url = new URL(`media/modules/${slug}.m4a`, document.baseURI);
        if (mediaRevision) url.searchParams.set('v', mediaRevision);
        const response = await environment.fetch(url.href, { credentials: 'same-origin' });
        if (!response.ok || Number(response.headers?.get('content-length')) > 1048576) return null;
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > 1048576) return null;
        const buffer = await owner.decodeAudioData(bytes);
        if (!Number.isFinite(buffer.duration) || buffer.duration < .25 || buffer.duration > 12 ||
            buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2) return null;
        buffers.set(slug, buffer); // Six fixed assets are the entire cache budget.
        return buffer;
      })().catch(() => null);
      loading.set(slug, request);
      request.then(() => { if (loading.get(slug) === request) loading.delete(slug); });
      return request;
    }
    function cue(slug, intent, buffer, owner) {
      if (!buffer || context !== owner || owner.state !== 'running' || !current(slug, intent) ||
          voices.size >= MAX_VOICES || cues >= MAX_CUES || now() - (lastCue.get(slug) ?? -Infinity) < COOLDOWN_MS) return;
      // The page cancels pending film/audio playback here, before any cue starts.
      const event = new environment.CustomEvent('maestro:hand-sound', { detail: { slug }, cancelable: true });
      if (!document.dispatchEvent(event) || !current(slug, intent)) return;
      let voice;
      try {
        const source = owner.createBufferSource(), gain = owner.createGain();
        const at = owner.currentTime, offset = Math.min(.18, buffer.duration / 4);
        const duration = Math.min(CUE_SECONDS, buffer.duration - offset);
        voice = { slug, source, gain, at, duration, timer: null, finished: false, released: false };
        source.buffer = buffer;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(GAIN, at + ATTACK);
        gain.gain.setValueAtTime(GAIN, at + duration - RELEASE);
        gain.gain.linearRampToValueAtTime(0, at + duration);
        source.connect(gain); gain.connect(owner.destination);
        voices.add(voice);
        source.onended = () => clean(voice);
        source.start(at, offset, duration);
        source.stop(at + duration);
        lastCue.set(slug, now()); cues++;
        voice.timer = timer(() => clean(voice), duration * 1000 + 100);
      } catch { if (voice) release(voice, true); }
    }
    function contact(slug) {
      if (!SLUGS.has(slug) || !armed || muted || document.hidden || contacts.has(slug)) return false;
      const intent = { generation, expires: now() + INTENT_MS };
      contacts.set(slug, intent);
      if (!current(slug, intent)) return false;
      if (silent) return true;
      const owner = context, resumed = ready;
      if (!owner || cues >= MAX_CUES || now() - (lastCue.get(slug) ?? -Infinity) < COOLDOWN_MS) return false;
      Promise.all([resumed, load(slug, owner)]).then(([running, buffer]) => {
        if (running) cue(slug, intent, buffer, owner);
      }).catch(() => { /* A failed sample is silent, never an oscillator fallback. */ });
      return true;
    }
    function leave(slug) {
      contacts.delete(slug);
      for (const voice of voices) if (voice.slug === slug) release(voice);
    }
    function setMuted(value) {
      muted = Boolean(value);
      if (muted) cancel(true);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(true); });
    document.addEventListener('play', event => {
      if (['AUDIO', 'VIDEO'].includes(String(event.target?.tagName || event.target?.nodeName || '').toUpperCase())) cancel(true);
    }, true);
    environment.addEventListener?.('pagehide', () => cancel(true));
    environment.addEventListener?.('blur', () => cancel(true));
    return Object.freeze({ arm, contact, leave, stop: () => cancel(), setMuted });
  }
  globalThis.MaestroHandAudio = Object.freeze({ create });
})();
