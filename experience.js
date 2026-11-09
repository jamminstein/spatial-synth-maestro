'use strict';

// The film's ink transport progressively enhances native controls. Chapter
// selection, scrolling, loading and returning never start sound.
(() => {
  const film = document.getElementById('module-film');
  const filmURL = film?.querySelector('source')?.getAttribute('src') || 'media/module-film.mp4';
  const media = [film].filter(Boolean);
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
      filmStatus.textContent = 'Sound descriptions could not load. Try reloading the film to restore its written sound descriptions.';
    });
    film.querySelector('track')?.addEventListener('load', () => { captionsFailed = false; sync(); });
    sync();
    transport.hidden = false;
    film.controls = false;
  }
  try { installFilmTransport(); } catch { restoreFilmFallback(); }

  // The six drawings now point into the film instead of duplicating its player.
  // Selecting a chapter always pauses; only the explicit Play control starts it.
  let chapter = null;
  const applyChapter = () => {
    if (chapter === null || !Number.isFinite(film.duration) || film.duration <= 0) return;
    try {
      film.currentTime = Math.max(0, Math.min(chapter, film.duration));
      chapter = null;
    } catch { /* Metadata can precede a seekable range; retry on canplay. */ }
  };
  document.querySelectorAll('[data-film-start]').forEach(link => {
    link.addEventListener('click', () => {
      const seconds = Number(link.dataset.filmStart);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 42) return;
      pauseMedia(film);
      chapter = seconds;
      applyChapter();
      filmStatus.textContent = 'Chapter selected. Press Play.';
    });
  });
  film.addEventListener('loadedmetadata', applyChapter);
  film.addEventListener('canplay', applyChapter);
})();
