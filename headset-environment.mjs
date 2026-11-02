// Exact, bounded transport for the existing Three r187 RoomEnvironment PMREM.
// Pixels remain linear RGBA half-float; only redundant channels/byte layout are packed.
export const ENVIRONMENT_BYTES = 1048352;
const PIXELS = 524160, HEADER = 32, BASE = 256, LEVELS = 6;
const MAGIC = [83, 83, 77, 69, 78, 86, 48, 49]; // SSMENV01
const cancelled = () => Object.assign(new Error('Environment loading cancelled'), { name: 'AbortError' });

export function* createEnvironmentDecoder(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength !== ENVIRONMENT_BYTES || MAGIC.some((value, index) => bytes[index] !== value)) throw Error('Invalid lighting asset');
  const header = new DataView(bytes.buffer, bytes.byteOffset, HEADER);
  if (header.getUint32(8, true) !== BASE || header.getUint32(12, true) !== LEVELS ||
      header.getUint32(16, true) !== PIXELS || header.getUint32(20, true) !== PIXELS * 2 ||
      header.getUint32(24, true) !== 7 || header.getUint32(28, true) !== 187) throw Error('Unsupported lighting layout');
  const pixels = new Uint16Array(PIXELS * 4);
  let index = 0;
  for (let level = 0; level < LEVELS; level++) {
    const width = BASE >> level;
    for (let face = 0; face < 6; face++) for (let local = 0; local < width * width; local++, index++) {
      const residual = bytes[HEADER + index] | (bytes[HEADER + PIXELS + index] << 8);
      const previous = local >= width ? pixels[(index - width) * 4] : 0;
      const value = (residual + previous) & 65535;
      if ((value & 0x8000) || (value & 0x7c00) === 0x7c00) throw Error('Invalid lighting value');
      const offset = index * 4;
      pixels[offset] = value; pixels[offset + 1] = value; pixels[offset + 2] = value; pixels[offset + 3] = 0x3c00;
      if ((index & 16383) === 16383) yield index + 1;
    }
  }
  return pixels;
}

// Synchronous form is for offline bit-roundtrip checks. The website advances
// the same decoder in bounded tasks, pausing it when hidden or disposed.
export function decodeEnvironment(input) {
  const decoder = createEnvironmentDecoder(input);
  let result;
  do { result = decoder.next(); } while (!result.done);
  return result.value;
}

export function createEnvironmentTexture(THREE, pixels) {
  if (THREE.REVISION !== '187' || !(pixels instanceof Uint16Array) || pixels.length !== PIXELS * 4) throw Error('Unsupported lighting renderer');
  const faces = Array.from({ length: 6 }, () => ({ width: BASE, height: BASE, mipmaps: [] }));
  let offset = 0;
  for (let level = 0; level < LEVELS; level++) {
    const width = BASE >> level, count = width * width * 4;
    for (let face = 0; face < 6; face++) {
      faces[face].mipmaps.push({ width, height: width, data: pixels.subarray(offset, offset + count) }); offset += count;
    }
  }
  // Three's explicit-mip cube container supports uncompressed RGBA half-floats.
  // Data already compensates the imported cube's X reflection; no reconvolution.
  const texture = new THREE.CompressedCubeTexture(faces, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.name = 'Precomputed existing room lighting';
  texture.mapping = THREE.CubeReflectionMapping; texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false; texture.flipY = false; texture.isPMREMTexture = true; texture.needsUpdate = true;
  return texture;
}

async function readBounded(stream, signal) {
  if (!stream?.getReader) throw Error('Streaming lighting load unavailable');
  const reader = stream.getReader(), chunks = [];
  let length = 0;
  const abort = () => { reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw cancelled();
      const { done, value } = await reader.read();
      if (signal?.aborted) throw cancelled();
      if (done) break;
      length += value.byteLength;
      if (length > ENVIRONMENT_BYTES) throw Error('Lighting asset exceeds its bound');
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    try { await reader.cancel(); } catch { /* A failed/cancelled stream needs no further work. */ }
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort); reader.releaseLock();
  }
}

export async function fetchEnvironmentBytes(url, signal) {
  if (signal?.aborted) throw cancelled();
  if (typeof DecompressionStream !== 'function') throw Error('Lighting decompression unavailable');
  const response = await fetch(url, { signal, credentials: 'omit' });
  if (!response.ok) throw Error('Lighting download failed');
  const advertised = Number(response.headers.get('Content-Length'));
  if (advertised > ENVIRONMENT_BYTES) { await response.body?.cancel(); throw Error('Lighting asset exceeds its bound'); }
  const bytes = await readBounded(response.body, signal);
  // Some hosts transparently serve gzip with Content-Encoding. Avoid decoding twice.
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return readBounded(stream, signal);
}
