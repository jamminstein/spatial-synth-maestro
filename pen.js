'use strict';

// An original pen alphabet: coordinates below describe hand motions, not font
// outlines. Every print chooses letter forms, then redraws their centre lines
// and pressure. There is deliberately no text rasterizer or font dependency.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const MAX_CHARACTERS = 240;
  const originals = new WeakMap();
  const installed = new WeakSet();
  const alphabet = Object.create(null);
  const define = (letter, width, ...forms) => {
    alphabet[letter] = { width, forms: forms.map(form => form.split(';').map(stroke =>
      stroke.trim().split(/\s+/).map(point => point.split(',').map(Number)))) };
  };

  // Lowercase: loops may be left open; exits overshoot; some letters have a
  // second schoolbook or cursive construction, not just another transformation.
  define('a', 8, '6,5 3,4 1,7 1,10 3,12 6,10 6,5 6,12 8,11', '6,6 5,4 2,4 0,7 1,11 4,12 6,9;6,4 7,12 9,10');
  define('b', 8, '1,12 2,1 1,0 0,5 1,12;1,7 4,4 7,6 7,10 4,12 1,11', '2,0 0,12 2,8 5,5 7,7 6,11 3,12 1,10');
  define('c', 7, '6,5 4,4 1,6 0,10 3,12 6,11', '6,6 5,4 2,5 0,8 1,11 4,12 7,10');
  define('d', 8, '6,5 3,4 1,6 0,10 3,12 6,9;6,1 7,0 6,12 9,10', '6,5 3,4 1,7 1,11 4,12 6,8 7,0 5,2 5,10 7,12');
  define('e', 7, '1,8 6,6 4,4 1,6 0,9 2,12 5,12 7,10', '0,7 6,7 5,4 2,4 0,7 0,10 3,12 6,11');
  define('f', 6, '1,16 2,4 4,0 6,1;0,6 6,5', '0,15 3,2 5,0 6,2 4,4 1,4;0,7 6,6');
  define('g', 8, '6,5 3,4 1,6 1,10 3,12 6,9;6,4 6,14 4,17 1,16 1,14', '6,5 3,4 0,7 1,11 4,11 6,7 5,15 3,17 0,15 7,13');
  define('h', 8, '1,12 2,0;1,8 4,4 6,5 6,11 8,12', '0,12 2,1 1,0 0,6 1,10 4,5 6,5 7,12');
  define('i', 4, '1,5 1,11 3,12 4,10;2,1 2.4,1.4', '0,5 2,4 1,11 3,12;2,0 3,1');
  define('j', 5, '3,5 3,14 1,17 -1,15;4,1 4.5,1.5', '2,4 4,4 3,15 1,17 -1,14;4,0 5,1');
  define('k', 8, '1,0 1,12;7,4 1,9 4,8 7,12', '2,0 0,12;7,5 2,8 5,9 7,13');
  define('l', 5, '2,0 1,10 2,12 5,11', '1,11 3,3 2,0 0,3 0,9 2,12 5,11');
  define('m', 12, '0,5 1,12 1,7 4,4 5,6 5,12 6,7 9,5 10,7 11,12', '0,12 1,4 2,7 4,5 6,6 5,12;6,8 9,4 11,6 11,12');
  define('n', 8, '0,5 1,12 1,7 4,4 6,5 7,12', '0,12 1,4 2,7 4,5 6,6 6,11 8,12');
  define('o', 8, '6,5 3,4 1,6 0,9 2,12 5,12 7,9 6,5 4,4', '4,4 1,5 0,9 2,12 6,11 7,7 4,4 2,5');
  define('p', 8, '1,5 0,17;1,7 4,4 7,6 7,10 4,12 1,10', '0,16 2,4 2,7 5,5 7,7 6,11 3,12 1,10');
  define('q', 8, '6,5 3,4 1,6 0,10 3,12 6,8;6,4 5,16 8,14', '7,5 3,4 0,7 1,11 4,11 6,7 6,16;4,14 8,14');
  define('r', 7, '1,5 0,12 1,8 4,4 6,5', '0,12 1,5 2,8 4,5 6,6 7,5');
  define('s', 7, '6,5 3,4 1,6 2,8 5,9 6,11 3,13 0,11', '7,5 4,4 1,5 0,7 5,10 5,12 2,12 0,10');
  define('t', 6, '3,1 2,10 3,12 6,10;0,5 6,5', '4,0 1,10 2,12 5,11;0,6 6,4');
  define('u', 8, '1,5 0,10 2,12 5,10 6,5 5,11 8,12', '0,4 0,10 2,12 5,11 6,4;6,5 6,12 8,10');
  define('v', 8, '0,4 3,12 7,4', '0,5 2,12 4,10 7,4');
  define('w', 12, '0,5 2,12 5,6 6,12 9,11 12,4', '0,4 1,11 3,12 6,5 6,11 8,12 11,4');
  define('x', 8, '0,5 7,12;7,4 0,12', '1,4 3,8 6,12;7,5 4,7 0,13');
  define('y', 8, '0,5 2,11 5,10 7,4;7,4 4,15 1,17 -1,15', '0,4 3,12 7,4 5,13 3,16 0,17');
  define('z', 7, '0,5 7,4 1,12 7,12', '0,5 6,5 3,8 5,9 6,12 3,15 0,14');

  // Capitals use separately drawn skeletons. Narrow stems and oversized bowls
  // disagree intentionally with their lowercase neighbours.
  define('A', 10, '0,12 4,0 6,1 10,13;2,8 8,7', '0,12 5,0 9,12;1,8 8,8;0,12 2,12');
  define('B', 9, '1,12 1,0 6,0 8,3 6,6 1,6 6,6 9,9 7,12 1,12', '1,0 0,12;1,0 7,1 8,4 2,6 7,7 8,10 5,12 0,11');
  define('C', 10, '9,2 6,0 2,2 0,7 2,11 6,13 9,10', '9,3 7,0 3,1 0,5 1,11 5,12 10,10');
  define('D', 10, '1,12 1,0 5,0 9,4 9,9 6,12 1,12', '1,1 0,12;0,0 6,1 9,5 8,10 4,12 0,11');
  define('E', 9, '8,0 1,0 0,12 8,12;1,6 7,5', '9,1 2,0 0,12 9,11;1,6 6,7');
  define('F', 9, '1,12 1,0 9,1;1,6 7,5', '0,13 2,0 9,0;1,6 7,7');
  define('G', 11, '9,2 6,0 2,2 0,7 2,11 7,12 10,8 6,7 10,7 10,13', '9,1 4,0 1,3 0,8 3,12 8,11 9,7 6,7');
  define('H', 10, '1,0 0,12;9,0 8,12;0,7 9,5', '0,0 1,13;9,1 8,12;1,6 8,7');
  define('I', 6, '0,0 6,0;3,0 2,12;0,12 6,12', '3,0 2,12;1,1 5,0;0,12 5,11');
  define('J', 9, '1,0 9,0 7,10 4,13 1,11 0,8', '8,0 8,9 6,12 2,12 0,9;5,0 10,1');
  define('K', 10, '1,0 0,12;9,0 1,7 5,6 10,12', '0,0 1,13;10,1 1,8;4,6 9,13');
  define('L', 9, '1,0 0,12 9,12', '2,0 0,11 1,13 9,11');
  define('M', 13, '0,12 1,0 6,8 11,0 12,12', '0,13 0,0 6,10 12,1 13,13');
  define('N', 11, '0,12 1,0 10,12 10,0', '0,13 0,1 2,1 9,12 10,0');
  define('O', 11, '8,1 4,0 1,3 0,9 4,13 9,11 11,5 8,1', '5,0 1,2 0,7 2,12 7,12 10,9 10,3 6,0 3,1');
  define('P', 10, '1,12 1,0 6,0 9,3 8,6 1,7', '0,13 1,1 7,0 10,3 8,7 1,6');
  define('Q', 11, '8,1 4,0 1,3 0,9 4,13 9,11 11,5 8,1;6,9 12,15', '5,0 1,2 0,8 3,12 8,11 10,7 8,1 5,0;6,10 11,14');
  define('R', 11, '1,13 1,0 6,0 9,3 7,6 1,7;4,7 10,13', '0,12 1,0 8,1 9,4 6,7 1,6;4,7 8,12 11,11');
  define('S', 10, '9,2 6,0 2,1 0,4 3,6 7,7 9,10 6,13 1,12 0,10', '9,1 4,0 1,2 1,5 8,8 9,11 5,13 0,11');
  define('T', 11, '0,0 11,1;6,1 5,13', '0,2 11,0;6,0 4,13');
  define('U', 11, '0,0 0,8 2,12 6,13 9,10 10,0', '1,0 0,9 3,12 7,11 9,8 10,0');
  define('V', 11, '0,0 4,12 6,11 11,0', '0,1 5,13 10,0');
  define('W', 15, '0,0 2,12 7,3 9,13 15,0', '0,0 2,11 4,12 7,2 10,12 12,9 15,0');
  define('X', 11, '0,0 10,12;10,0 0,13', '1,0 4,6 10,13;11,0 6,5 0,12');
  define('Y', 11, '0,0 5,6 11,0;5,6 4,13', '0,1 5,8 10,0;5,8 4,12');
  define('Z', 10, '0,1 10,0 0,12 10,12', '0,0 9,1 1,11 10,13;2,7 8,6');
  define('0', 9, '5,0 1,2 0,8 2,12 6,12 8,8 8,3 5,0;1,10 7,3');
  define('1', 6, '0,3 4,0 3,12;0,12 6,12');
  define('2', 9, '0,3 2,0 6,0 8,3 6,6 0,12 9,12');
  define('3', 9, '0,1 5,0 8,3 5,6 3,6 7,7 8,10 5,13 0,11');
  define('4', 9, '6,0 0,8 9,8;7,1 6,13');
  define('5', 9, '8,0 1,0 0,6 5,5 8,8 7,12 2,13 0,10');
  define('6', 9, '7,0 3,2 0,7 0,11 4,13 7,11 7,7 4,6 0,8');
  define('7', 9, '0,0 9,0 3,13;2,7 7,6');
  define('8', 9, '4,6 1,4 2,1 6,0 8,3 4,6 0,9 2,12 6,12 8,9 4,6');
  define('9', 9, '8,6 5,7 1,6 0,3 3,0 7,1 8,6 6,11 2,13');
  define('.', 3, '1,11 1.5,11.5');
  define(',', 3, '2,11 1,14');
  define(':', 3, '1,5 1.4,5.4;1,11 1.5,11.4');
  define(';', 3, '1,5 1.4,5.4;2,11 1,14');
  define('!', 4, '2,0 1,8;1,11 1.5,11.5');
  define('?', 8, '0,3 2,0 6,0 8,3 5,6 3,8;3,11 3.5,11.5');
  define("'", 3, '2,0 1,3');
  define('"', 5, '1,0 0,3;4,0 3,3');
  define('-', 6, '0,7 6,6');
  define('–', 9, '0,7 9,6');
  define('—', 14, '0,7 14,6');
  define('/', 8, '7,-1 0,14');
  define('\\', 8, '0,-1 7,14');
  define('(', 5, '4,-1 1,3 0,9 3,15');
  define(')', 5, '0,-1 4,5 3,11 0,15');
  define('[', 5, '4,0 0,0 0,13 4,13');
  define(']', 5, '0,0 4,0 4,13 0,13');
  define('+', 9, '0,7 9,6;5,2 4,11');
  define('=', 9, '0,4 9,4;0,9 9,8');
  define('&', 11, '10,12 2,4 3,0 6,1 6,4 0,9 1,12 5,13 10,7');
  define('#', 10, '3,0 1,13;8,0 6,13;0,5 10,4;0,9 10,8');
  define('*', 8, '1,2 7,8;7,2 1,8;4,0 4,10');
  define('→', 15, '0,7 14,7;9,2 14,7 9,12');
  define('←', 15, '15,7 0,7;5,2 0,7 5,12');
  define('↗', 11, '0,12 10,1;3,1 10,1 10,8');
  define('↘', 11, '0,1 10,12;3,12 10,12 10,5');
  define('·', 3, '1,7 1.5,7.5');
  define('…', 10, '1,11 1.5,11.5;5,11 5.5,11.5;9,11 9.5,11.5');
  define('_', 9, '0,13 9,13');
  define('%', 11, '10,0 0,12;2,0 0,2 2,4 4,2 2,0;8,8 6,10 8,12 10,10 8,8');
  define('@', 13, '8,5 5,4 3,7 4,10 7,10 8,5 8,10 11,9 12,5 10,1 5,0 1,3 0,9 4,13 10,12');

  const aliases = { '’': "'", '‘': "'", '“': '"', '”': '"', '−': '–', '‑': '-', ' ': ' ' };
  const accents = {
    '\u0301': [[[3, 2], [6, -1]]], '\u0300': [[[2, -1], [5, 2]]],
    '\u0302': [[[1, 2], [4, -1], [7, 2]]], '\u0303': [[[0, 1], [2, -1], [5, 1], [7, -1]]],
    '\u0308': [[[2, 0], [2.4, .4]], [[6, 0], [6.5, .4]]],
    '\u030a': [[[4, -2], [2, -1], [2, 1], [5, 1], [6, -1], [4, -2]]],
    '\u0327': [[[4, 12], [3, 14], [5, 15], [3, 17]]]
  };
  const fallback = { width: 9, forms: [[[[1, 2], [7, 1], [8, 11], [1, 12], [1, 2]], [[1, 2], [8, 11]]]] };

  const uint = value => Number.isFinite(Number(value)) ? Number(value) >>> 0 : 0;
  function hash(text) {
    let value = 2166136261;
    for (const character of String(text)) { value ^= character.codePointAt(0); value = Math.imul(value, 16777619); }
    return value >>> 0;
  }
  function random(seed) {
    let state = uint(seed);
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = Math.imul(state ^ state >>> 15, state | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }
  const round = value => +value.toFixed(3);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function glyphFor(character) {
    const letter = aliases[character] || character;
    const decomposition = Array.from(letter.normalize('NFD'));
    const base = decomposition.shift();
    return { base, skeleton: alphabet[base] || fallback,
      accentStrokes: decomposition.flatMap(mark => accents[mark] || []),
      supported: !!alphabet[base] && decomposition.every(mark => !!accents[mark]) };
  }

  // Unevenly sampled Catmull-Rom pen motions retain a few angular hesitations.
  function sample(points, next) {
    if (points.length < 2) return points;
    const result = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
      const steps = Math.max(3, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) * 1.25));
      for (let step = 0; step < steps; step++) {
        const t = step / steps, t2 = t * t, t3 = t2 * t;
        const wobble = .045 + next() * .075;
        const point = [0, 1].map(axis => .5 * ((2 * b[axis]) + (-a[axis] + c[axis]) * t +
          (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * t2 +
          (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * t3) + (next() - .5) * wobble);
        result.push(point);
      }
    }
    result.push(points[points.length - 1]);
    return result;
  }

  // Filled ribbons put pressure into the geometry: fat pauses, dry exits and
  // uneven sides survive even when the surrounding CSS has no fonts loaded.
  function ribbon(points, next, pressure, kind = 'ink') {
    if (points.length < 2) return null;
    const left = [], right = [];
    const phase = next() * Math.PI * 2;
    for (let index = 0; index < points.length; index++) {
      const previous = points[Math.max(0, index - 1)], following = points[Math.min(points.length - 1, index + 1)];
      const dx = following[0] - previous[0], dy = following[1] - previous[1];
      const length = Math.hypot(dx, dy) || 1;
      const progress = index / (points.length - 1);
      const taper = .48 + .52 * Math.sin(Math.PI * progress) ** .35;
      const width = pressure * taper * (.65 + .32 * Math.sin(progress * 8 + phase) + next() * .28);
      const normal = [-dy / length, dx / length];
      left.push([points[index][0] + normal[0] * width, points[index][1] + normal[1] * width]);
      right.push([points[index][0] - normal[0] * width * .8, points[index][1] - normal[1] * width * .8]);
    }
    const outline = [...left, ...right.reverse()];
    return { kind, opacity: kind === 'retrace' ? .42 + next() * .32 : .83 + next() * .17,
      d: `M${outline.map(point => point.map(round).join(',')).join('L')}Z`, points: outline };
  }

  function plan(text, seed = 0) {
    text = String(text);
    if (Array.from(text).length > MAX_CHARACTERS) return null;
    const next = random(uint(seed) ^ hash(text));
    const paths = [], glyphs = [], accidents = [];
    const push = path => { if (path) paths.push(path); };
    let y = 11, longest = 0, lines = 1;
    for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
      let x = 9, drift = 0, previousExit = null;
      const writingSlope = (next() - .5) * .032;
      const characters = Array.from(line.normalize('NFC'));
      const words = [];
      let wordStart = null;
      characters.forEach((character, index) => {
        if (/\p{L}/u.test(character)) { if (wordStart === null) wordStart = index; }
        else if (wordStart !== null) { if (index - wordStart >= 3) words.push([wordStart, index]); wordStart = null; }
      });
      if (wordStart !== null && characters.length - wordStart >= 3) words.push([wordStart, characters.length]);
      const wrongSpaces = new Map();
      let fractureIndex = -1;
      if (words.length) {
        const [start, end] = words[Math.floor(next() * words.length)];
        const middle = clamp(start + Math.floor((end - start) * (.4 + next() * .2)), start + 1, end - 1);
        // One interruption, not global letter spacing. A false word boundary is
        // followed by a crowded recovery; the original text has no added space.
        wrongSpaces.set(middle, 4.5 + next() * 7);
        if (middle + 1 < end) wrongSpaces.set(middle + 1, -2 - next() * 3.8);
        else if (middle > start + 1) wrongSpaces.set(middle - 1, -1.5 - next() * 2.8);
        fractureIndex = middle;
      }
      for (const [characterIndex, original] of characters.entries()) {
        const character = aliases[original] || original;
        if (/\s/.test(character)) { x += 3.4 + next() * 3.6; previousExit = null; continue; }
        if (wrongSpaces.has(characterIndex)) {
          const amount = wrongSpaces.get(characterIndex);
          x += amount;
          accidents.push({ kind: amount > 0 ? 'false-space' : 'collision', line: lines - 1, index: characterIndex, amount: round(amount) });
          previousExit = null;
        }
        const { skeleton, accentStrokes, supported, base } = glyphFor(character);
        const variant = Math.floor(next() * skeleton.forms.length);
        const width = .78 + next() * .43, height = .88 + next() * .24;
        const slant = (next() - .48) * .33;
        drift = clamp(drift + (next() - .5) * 1.45, -2.1, 2.1);
        const baseline = y + drift + x * writingSlope;
        const pressure = .26 + next() * .29;
        let first = null, last = null;
        const strokes = [...skeleton.forms[variant], ...accentStrokes];
        for (let index = 0; index < strokes.length; index++) {
          const isAccent = index >= skeleton.forms[variant].length;
          const upperAccentOffset = isAccent && base !== base.toLowerCase() ? -4 : 0;
          const joints = strokes[index].map(([px, py]) => [
            x + px * width + slant * (12 - py) + (next() - .5) * .62,
            baseline + (py + upperAccentOffset) * height + (next() - .5) * .65
          ]);
          const centre = sample(joints, next);
          if (!isAccent) { if (!first) first = centre[0]; last = centre[centre.length - 1]; }
          const fractured = characterIndex === fractureIndex && index === 0 && centre.length > 14;
          const dry = !isAccent && centre.length > 16 && next() < .27;
          if (fractured) {
            const begin = Math.floor(centre.length * .31), end = Math.floor(centre.length * .64);
            const offsetX = (next() < .5 ? -1 : 1) * (2.3 + next() * 2.7);
            const offsetY = (next() - .5) * 3.6;
            push(ribbon(centre.slice(0, begin), next, pressure, 'lift'));
            push(ribbon(centre.slice(begin + 1, end).map(([px, py]) => [px + offsetX, py + offsetY]), next, pressure * 1.15, 'fracture'));
            push(ribbon(centre.slice(end + 1), next, pressure, 'lift'));
            accidents.push({ kind: 'stroke-fracture', line: lines - 1, index: characterIndex, dx: round(offsetX), dy: round(offsetY) });
          } else if (dry) {
            const split = Math.floor(centre.length * (.3 + next() * .38));
            const gap = 1 + Math.floor(next() * 3);
            push(ribbon(centre.slice(0, split), next, pressure, 'lift'));
            push(ribbon(centre.slice(split + gap), next, pressure * (.65 + next() * .5), 'lift'));
          } else push(ribbon(centre, next, pressure));
          if (!isAccent && centre.length > 10 && next() < .25) {
            const start = Math.floor(centre.length * next() * .35);
            const end = Math.min(centre.length, start + Math.ceil(centre.length * (.25 + next() * .5)));
            const retrace = centre.slice(start, end).reverse().map(([px, py]) => [px + .22 + next() * .35, py - .3 + next() * .4]);
            push(ribbon(retrace, next, pressure * .5, 'retrace'));
          }
        }
        // Rare, imperfect connections: the pen changes its mind halfway there.
        if (previousExit && first && next() < .17 && /[a-z]/.test(base)) {
          const join = sample([previousExit, [x - .6, baseline + 11.7], [x + .5, baseline + 9.7], first], next);
          push(ribbon(join, next, pressure * .42, 'join'));
        }
        glyphs.push({ character: original, variant, supported, x: round(x), baseline: round(baseline), width: round(width), height: round(height) });
        previousExit = last;
        x += skeleton.width * width + .8 + next() * 1.9;
      }
      longest = Math.max(longest, x + 10);
      y += 29;
      lines++;
    }
    const height = (lines - 1) * 29 + 9;
    // Compute actual bounds too: a long wandering baseline or accent can never
    // be silently clipped by the SVG viewport.
    const allPoints = paths.flatMap(path => path.points);
    const minX = Math.min(0, ...allPoints.map(point => point[0] - 2));
    const minY = Math.min(0, ...allPoints.map(point => point[1] - 2));
    const maxX = Math.max(longest, ...allPoints.map(point => point[0] + 2));
    const maxY = Math.max(height, ...allPoints.map(point => point[1] + 2));
    for (const path of paths) { delete path.points; path.opacity = round(path.opacity); }
    return { text, seed: uint(seed), width: round(Math.max(1, maxX - minX)), height: round(Math.max(1, maxY - minY)),
      viewBox: [round(minX), round(minY), round(Math.max(1, maxX - minX)), round(Math.max(1, maxY - minY))], paths, glyphs, accidents };
  }

  function sourceText(element) {
    if (originals.has(element)) return originals.get(element);
    const read = node => node.nodeType === 3 ? node.textContent : node.tagName === 'BR' ? '\n' :
      node.childNodes?.length ? Array.from(node.childNodes).map(read).join('') : node.textContent || '';
    const text = read(element);
    originals.set(element, text);
    return text;
  }

  function render(document, element, seed, replacement) {
    if (!element || typeof element.replaceChildren !== 'function') return false;
    if (typeof replacement === 'string') originals.set(element, replacement);
    const text = sourceText(element);
    const drawing = plan(text, uint(seed) ^ hash(element.dataset?.pen || ''));
    if (!drawing || !text.trim()) {
      element.textContent = text;
      return false;
    }
    const readable = document.createElement('span');
    readable.className = 'pen-readable sr-only';
    readable.textContent = text;
    // Self-contained semantic preservation even if a stylesheet is delayed.
    readable.setAttribute('style', 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'pen-drawing');
    svg.setAttribute('viewBox', drawing.viewBox.join(' '));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('data-pen-fractured', String(drawing.paths.some(stroke => stroke.kind === 'fracture')));
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('width', String(drawing.width));
    svg.setAttribute('height', String(drawing.height));
    svg.setAttribute('style', `display:inline-block;width:${round(drawing.width / 20)}em;height:auto;max-width:100%;vertical-align:middle;overflow:visible;pointer-events:none;user-select:none`);
    for (const stroke of drawing.paths) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('class', `pen-stroke${stroke.kind === 'fracture' ? ' pen-stroke-fracture' : ''}`);
      path.setAttribute('d', stroke.d);
      path.setAttribute('opacity', String(stroke.opacity));
      svg.append(path);
    }
    element.replaceChildren(readable, svg);
    return true;
  }

  function install(document) {
    if (!document || installed.has(document)) return;
    installed.add(document);
    let seed = uint(document.documentElement?.dataset?.printSeed);
    let initialDrawn = false;
    const drawAll = () => {
      document.querySelectorAll('[data-pen]').forEach(element => render(document, element, seed));
      initialDrawn = true;
    };
    document.addEventListener('maestro:misprint', event => {
      seed = uint(event.detail?.seed);
      drawAll();
    });
    document.addEventListener('maestro:pen-refresh', event => {
      const detail = event.detail || {};
      if (typeof detail.text !== 'string' || !detail.element || detail.element.ownerDocument !== document || !detail.element.hasAttribute('data-pen')) return;
      render(document, detail.element, detail.seed === undefined ? seed : uint(detail.seed), detail.text);
    });
    // The following deferred score script supplies the fresh initial seed.
    // Leave semantic text intact until then, with a standalone DOM-ready fallback.
    if (document.readyState === 'loading' || document.currentScript?.defer) {
      document.addEventListener('DOMContentLoaded', () => { if (!initialDrawn) drawAll(); }, { once: true });
    }
    else drawAll();
  }

  if (typeof document !== 'undefined') install(document);
  if (typeof module !== 'undefined' && module.exports) module.exports = { plan, glyphFor, hash, render, install, MAX_CHARACTERS };
})();
