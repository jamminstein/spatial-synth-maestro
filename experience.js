'use strict';

// The film's ink transport progressively enhances native controls. Loading,
// changing drawings, scrolling, and returning to this page never start sound.
(() => {
  const film = document.getElementById('module-film');
  const audio = document.getElementById('module-audio');
  const filmURL = film?.querySelector('source')?.getAttribute('src') || 'media/module-film.mp4';
  const revisionValue = document.documentElement.dataset.mediaRevision;
  const mediaRevision = typeof revisionValue === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(revisionValue) ? revisionValue : '';
  const media = [film, audio].filter(Boolean);
  let cancelFilmIntent = () => {};
  const pauseMedia = player => { if (player === film) cancelFilmIntent(); player.pause(); };
  media.forEach(player => {
    player.addEventListener('play', () => {
      if (player.paused) return;
      media.forEach(other => { if (other !== player) pauseMedia(other); });
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    media.forEach(player => {
      const separate = document.pictureInPictureElement === player ||
        document.fullscreenElement === player || player.webkitDisplayingFullscreen ||
        ['fullscreen', 'picture-in-picture'].includes(player.webkitPresentationMode);
      if (!separate) pauseMedia(player);
    });
  });
  window.addEventListener('pagehide', () => media.forEach(pauseMedia));
  document.addEventListener('maestro:hand-sound', () => media.forEach(pauseMedia));

  const filmStatus = document.getElementById('film-status');
  let restoreFilmFallback = () => {};
  const showFilmError = () => {
    restoreFilmFallback();
    filmStatus.replaceChildren(document.createTextNode('The embedded film could not load. '));
    const link = document.createElement('a');
    link.href = filmURL;
    link.textContent = 'Try opening the video directly.';
    filmStatus.append(link);
  };
  film.addEventListener('error', showFilmError);
  film.querySelector('source')?.addEventListener('error', showFilmError);
  film.addEventListener('playing', () => { filmStatus.textContent = ''; });

  // Range inputs and buttons retain browser keyboard behavior. No pointer-only
  // transport, time-driven announcements, automatic playback or resume.
  function installFilmTransport() {
    const transport = document.getElementById('film-transport');
    const toggle = document.getElementById('film-toggle');
    const seek = document.getElementById('film-seek');
    const time = document.getElementById('film-time');
    const mute = document.getElementById('film-mute');
    const volume = document.getElementById('film-volume');
    const captions = document.getElementById('film-captions');
    if (![transport, toggle, seek, time, mute, volume, captions].every(Boolean) || typeof film.play !== 'function') return;
    let pending = false, wantsPlayback = false, intent = 0, failed = false, captionsFailed = false;
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    const duration = () => Number.isFinite(film.duration) && film.duration > 0 ? film.duration : 0;
    const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
    const captionTrack = () => Array.from(film.textTracks || []).find(track => ['captions', 'subtitles'].includes(track.kind));
    function sync() {
      const playing = pending || !film.paused && !film.ended;
      toggle.textContent = playing ? 'pause' : film.ended ? 'again' : 'play';
      toggle.setAttribute('aria-label', playing ? 'Pause film' : film.ended ? 'Replay film' : 'Play film');
      const length = duration();
      const current = Number.isFinite(film.currentTime) ? clamp(film.currentTime, 0, length || 42) : 0;
      seek.disabled = !length;
      seek.max = String(length || 42);
      seek.value = String(current);
      seek.setAttribute('aria-valuetext', `${clock(current)} of ${clock(length || 42)}`);
      time.textContent = `${clock(current)} / ${clock(length || 42)}`;
      const level = Number.isFinite(film.volume) ? clamp(film.volume, 0, 1) : 1;
      const quiet = film.muted || level === 0;
      volume.value = String(level);
      volume.setAttribute('aria-valuetext', `${Math.round(level * 100)} percent${film.muted ? ', muted' : ''}`);
      mute.textContent = quiet ? 'quiet' : 'sound';
      mute.setAttribute('aria-label', quiet ? 'Unmute film' : 'Mute film');
      mute.setAttribute('aria-pressed', String(quiet));
      const track = captionTrack();
      captions.disabled = captionsFailed || !track;
      captions.setAttribute('aria-pressed', String(track?.mode === 'showing'));
      captions.setAttribute('aria-label', track?.mode === 'showing' ? 'Hide sound descriptions' : 'Show sound descriptions');
    }
    cancelFilmIntent = () => { intent++; pending = false; wantsPlayback = false; sync(); };
    restoreFilmFallback = () => {
      cancelFilmIntent(); film.pause(); failed = true;
      film.controls = true; transport.hidden = true;
    };
    toggle.addEventListener('click', () => {
      if (failed) return;
      if (pending || !film.paused && !film.ended) { cancelFilmIntent(); film.pause(); sync(); return; }
      const request = ++intent;
      wantsPlayback = true; pending = true;
      filmStatus.textContent = '';
      sync();
      try {
        if (film.ended && duration()) film.currentTime = 0;
        Promise.resolve(film.play()).then(() => {
          if (request !== intent) { if (!wantsPlayback) film.pause(); return; }
          pending = false; sync();
        }).catch(() => {
          if (request !== intent) return;
          cancelFilmIntent(); film.pause(); sync();
          filmStatus.textContent = 'Playback did not start. Press Play to try again, or open the film directly.';
          const link = document.createElement('a');
          link.href = filmURL; link.textContent = ' Open the film.'; filmStatus.append(link);
        });
      } catch {
        cancelFilmIntent(); film.pause(); sync();
        filmStatus.textContent = 'Playback is unavailable here. Use the native player or open the film directly.';
        showFilmError();
      }
    });
    seek.addEventListener('input', () => {
      const length = duration(), value = Number(seek.value);
      if (!length || !Number.isFinite(value)) { sync(); return; }
      try { film.currentTime = clamp(value, 0, length); }
      catch { filmStatus.textContent = 'This part of the film is not ready to seek yet. Try again when it has loaded.'; }
      sync();
    });
    mute.addEventListener('click', () => {
      const quiet = film.muted || film.volume === 0;
      try {
        if (quiet && film.volume === 0) film.volume = .5;
        film.muted = !quiet;
      } catch { filmStatus.textContent = 'Use your device volume controls to change the sound level.'; }
      sync();
    });
    volume.addEventListener('input', () => {
      const value = Number(volume.value);
      if (!Number.isFinite(value)) { sync(); return; }
      try { film.volume = clamp(value, 0, 1); if (value > 0) film.muted = false; }
      catch { filmStatus.textContent = 'Use your device volume controls to change the sound level.'; }
      sync();
    });
    captions.addEventListener('click', () => {
      const track = captionTrack();
      if (track && !captionsFailed) track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
      sync();
    });
    ['play', 'playing', 'pause', 'loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'volumechange'].forEach(event => film.addEventListener(event, sync));
    film.addEventListener('ended', () => { cancelFilmIntent(); sync(); });
    film.textTracks?.addEventListener?.('addtrack', sync);
    film.textTracks?.addEventListener?.('change', sync);
    film.querySelector('track')?.addEventListener('error', () => {
      captionsFailed = true; sync();
      filmStatus.textContent = 'Sound descriptions could not load. The written descriptions are available with each instrument below.';
    });
    film.querySelector('track')?.addEventListener('load', () => { captionsFailed = false; sync(); });
    sync();
    transport.hidden = false;
    film.controls = false;
  }
  try { installFilmTransport(); } catch { restoreFilmFallback(); }

  const study = document.getElementById('sound-study');
  const select = document.getElementById('module-select');
  const previous = document.getElementById('module-previous');
  const next = document.getElementById('module-next');
  document.querySelectorAll('[data-study]').forEach(link => {
    link.addEventListener('click', () => {
      const selected = modules.findIndex(item => item.slug === link.dataset.study);
      if (selected >= 0) choose(selected, true);
    });
  });
  const image = document.getElementById('module-image');
  const status = document.getElementById('module-status');
  const direct = document.getElementById('module-direct');
  let modules = [];
  let index = 0;
  // Same-site static assets only. Manifest text is never interpreted as HTML.
  const localAsset = path => {
    if (typeof path !== 'string' || !path || path.includes('..')) return null;
    try {
      const url = new URL(path, document.baseURI);
      const base = new URL('./', document.baseURI);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
      if (mediaRevision) url.searchParams.set('v', mediaRevision);
      return url.href;
    } catch { return null; }
  };
  const setPenText = (id, text) => {
    const element = document.getElementById(id);
    element.textContent = text;
    document.dispatchEvent(new CustomEvent('maestro:pen-refresh', {
      detail: { element, text, seed: Number(document.documentElement.dataset.printSeed) || 0 }
    }));
  };
  function choose(selected, announce = false) {
    if (!modules.length || !Number.isInteger(selected)) return;
    index = (selected + modules.length) % modules.length;
    const item = modules[index];
    audio.pause();
    status.textContent = '';
    select.value = String(index);
    image.src = item.image;
    image.alt = item.alt || `${item.name}: the app’s native ink drawing.`;
    setPenText('module-name', item.name);
    document.getElementById('module-selection').textContent = announce ? `${item.name} selected. Press Play to listen.` : '';
    document.getElementById('module-role').textContent = item.role || 'An instrument voice';
    setPenText('module-description', item.description || 'a thought, still sounding.');
    document.getElementById('module-count').textContent = `${index + 1} / ${modules.length}`;
    document.getElementById('module-image-caption').textContent = item.imageCaption || 'Native instrument drawing';
    audio.setAttribute('aria-label', `Listen to ${item.name}`);
    document.getElementById('module-sound').textContent = item.soundDescription || '';
    if (item.audio) {
      audio.src = item.audio;
      audio.hidden = false;
      direct.href = item.audio;
      direct.hidden = true;
      direct.setAttribute('aria-label', `Open the ${item.name} audio file`);
      document.getElementById('module-hint').textContent = item.audioNote || 'Selection stays quiet. Press Play.';
    } else {
      audio.removeAttribute('src');
      audio.load();
      audio.hidden = true;
      direct.hidden = true;
      document.getElementById('module-hint').textContent = item.audioNote || 'This drawing is a control or visual companion; it has no individual sound sample.';
    }
  }
  select.addEventListener('change', () => choose(Number(select.value)));
  previous.addEventListener('click', () => choose(index - 1, true));
  next.addEventListener('click', () => choose(index + 1, true));
  audio.addEventListener('error', () => {
    if (audio.getAttribute('src')) {
      status.textContent = 'This sample could not load. Try the direct audio link below, or choose another drawing.';
      direct.hidden = false;
    }
  });
  audio.addEventListener('playing', () => { status.textContent = ''; });
  image.addEventListener('error', () => {
    if (image.getAttribute('src') === 'orchestra.svg') return;
    image.src = 'orchestra.svg';
    image.alt = 'An illustrated group of instruments. This individual drawing could not load.';
  });
  fetch('media/manifest.json', { credentials: 'omit', cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error('Manifest unavailable');
      return response.json();
    })
    .then(manifest => {
      const list = Array.isArray(manifest) ? manifest : manifest.modules;
      if (!Array.isArray(list)) throw new Error('Invalid manifest');
      modules = list.slice(0, 100).filter(item => item && typeof item.name === 'string')
        .map(item => ({ ...item, image: localAsset(item.image), audio: localAsset(item.audio) }))
        .filter(item => item.image);
      if (!modules.length) throw new Error('No instruments');
      select.replaceChildren(...modules.map((item, i) => {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = item.name;
        return option;
      }));
      [select, previous, next].forEach(control => { control.disabled = false; });
      if (typeof manifest.film?.caption === 'string') document.getElementById('film-caption').textContent = manifest.film.caption;
      if (typeof manifest.film?.description === 'string') document.getElementById('film-description').textContent = manifest.film.description;
      choose(0);
    })
    .catch(() => {
      select.options[0].textContent = 'Sound studies unavailable';
      status.textContent = 'The sound studies could not load. Please reload this page, or visit the support guide.';
    })
    .finally(() => { study.setAttribute('aria-busy', 'false'); });
})();
