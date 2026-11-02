'use strict';

// Native controls own play, pause, seeking, volume, and fullscreen. Loading,
// changing drawings, scrolling, and returning to this page never start sound.
(() => {
  const film = document.getElementById('module-film');
  const audio = document.getElementById('module-audio');
  const media = [film, audio].filter(Boolean);
  media.forEach(player => {
    player.addEventListener('play', () => {
      if (player.paused) return;
      media.forEach(other => { if (other !== player) other.pause(); });
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    media.forEach(player => {
      const separate = document.pictureInPictureElement === player ||
        document.fullscreenElement === player || player.webkitDisplayingFullscreen ||
        ['fullscreen', 'picture-in-picture'].includes(player.webkitPresentationMode);
      if (!separate) player.pause();
    });
  });
  window.addEventListener('pagehide', () => media.forEach(player => player.pause()));

  const filmStatus = document.getElementById('film-status');
  const showFilmError = () => {
    filmStatus.replaceChildren(document.createTextNode('The embedded film could not load. '));
    const link = document.createElement('a');
    link.href = 'media/module-film.mp4';
    link.textContent = 'Try opening the video directly.';
    filmStatus.append(link);
  };
  film.addEventListener('error', showFilmError);
  film.querySelector('source')?.addEventListener('error', showFilmError);
  film.addEventListener('playing', () => { filmStatus.textContent = ''; });

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
      return url.origin === base.origin && url.pathname.startsWith(base.pathname) ? url.href : null;
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
  fetch('media/manifest.json', { credentials: 'omit' })
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
