import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { attachTrackball, demandFrames } from './headset-controls.mjs?v=20261109-hands5';
import { createEnvironmentDecoder, createEnvironmentTexture, fetchEnvironmentBytes } from './headset-environment.mjs';

// Local community mesh, embedded textures, direct manipulation. No animation
// mixer, idle loop, autospin, inertia, audio, CDN or remote environment map.
const surface = document.getElementById('headset-view');
const canvas = document.getElementById('headset-canvas');
const fallback = document.getElementById('headset-fallback');
const status = document.getElementById('headset-status');

if (surface && canvas && fallback && status) {
  let renderer, scene, environmentMap, model, controls, resizeObserver, frames;
  let disposed = false, failed = false, ready = false, preparing = false, prepared = false;
  const environmentAbort = new AbortController();
  let environmentLoading = false, environmentFailed = false, environmentBytes = null;
  let environmentDecoder = null, environmentChannel = null, environmentTaskQueued = false;
  const listeners = [];
  const listen = (target, event, callback, options) => {
    target.addEventListener(event, callback, options);
    listeners.push(() => target.removeEventListener(event, callback, options));
  };
  // Protect the actual-model preview while WebGL is still loading as well.
  for (const element of [surface, canvas, fallback]) element.setAttribute('draggable', 'false');
  const preventNative = event => {
    if (event.cancelable !== false) event.preventDefault();
    event.stopPropagation();
  };
  for (const name of ['dragstart', 'selectstart', 'contextmenu']) {
    listen(surface, name, preventNative, { capture: true, passive: false });
  }
  const showFallback = () => {
    failed = true;
    environmentAbort.abort(); clearEnvironmentPreparation();
    controls?.dispose(); controls = null;
    frames?.stop();
    canvas.hidden = true; fallback.hidden = false;
    surface.removeAttribute('tabindex'); surface.setAttribute('role', 'img');
    surface.setAttribute('aria-label', 'Apple Vision Pro headset, static rendering of the credited 3D model.');
    surface.removeAttribute('aria-describedby');
    surface.dataset.modelState = 'fallback';
    status.textContent = 'Interactive 3D is unavailable here. A static rendering of the headset is shown.';
  };
  function disposeObject(object) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    object?.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    textures.forEach(texture => { texture.source?.data?.close?.(); texture.dispose(); });
    materials.forEach(material => material.dispose());
    geometries.forEach(geometry => geometry.dispose());
  }
  function clearEnvironmentPreparation() {
    environmentBytes = null; environmentDecoder = null; environmentTaskQueued = false;
    environmentChannel?.port1.close(); environmentChannel?.port2.close(); environmentChannel = null;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    environmentAbort.abort(); clearEnvironmentPreparation();
    controls?.dispose(); resizeObserver?.disconnect(); frames?.dispose();
    listeners.forEach(remove => remove());
    disposeObject(model);
    environmentMap?.dispose(); renderer?.dispose();
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true,
      premultipliedAlpha: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 30);
    camera.position.set(0, 0, 4.05); camera.lookAt(0, 0, 0);
    const pivot = new THREE.Group(); scene.add(pivot);
    // The exported GLB faces +Z, with +Y up. This is an initial view, not an
    // orbit limit: quaternion interaction can turn the entire model through 360°.
    // Match the actual-model fallback's photographed three-quarter direction.
    const home = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(
      new THREE.Vector3(-1.7, .85, 1.15), new THREE.Vector3(), new THREE.Vector3(0, 1, 0))).invert();
    pivot.quaternion.copy(home);
    scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x807b72, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 3.5); key.position.set(-3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xdce9ff, 1.5); fill.position.set(4, 1, 2); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 2.4); rim.position.set(1, 3, -4); scene.add(rim);
    scene.environmentIntensity = .85;
    function finishEnvironment(resource) {
      environmentMap = resource;
      scene.environment = resource.texture || resource;
      clearEnvironmentPreparation();
      prepareModel();
    }
    function advanceEnvironment() {
      if (disposed || failed || document.hidden || !environmentDecoder) return;
      try {
        const next = environmentDecoder.next();
        if (next.done) { finishEnvironment(createEnvironmentTexture(THREE, next.value)); return; }
        // Finite preparation only: yield after at most16,384 texels so the page
        // can paint/respond. A hidden page retains its cursor without polling.
        if (!environmentChannel) {
          environmentChannel = new MessageChannel();
          environmentChannel.port1.onmessage = () => {
            environmentTaskQueued = false; advanceEnvironment();
          };
        }
        environmentTaskQueued = true; environmentChannel.port2.postMessage(0);
      } catch {
        clearEnvironmentPreparation(); environmentFailed = true; prepareEnvironment();
      }
    }
    function prepareEnvironment() {
      if (disposed || failed || document.hidden || environmentMap || environmentTaskQueued) return;
      if (environmentDecoder) { advanceEnvironment(); return; }
      if (environmentBytes) {
        environmentDecoder = createEnvironmentDecoder(environmentBytes); environmentBytes = null;
        advanceEnvironment(); return;
      }
      if (environmentFailed) {
        // Preserve the original lighting path on older browsers or a failed,
        // unsupported or corrupt asset. This fallback may compile synchronously.
        let room, pmrem;
        try {
          room = new RoomEnvironment(); pmrem = new THREE.PMREMGenerator(renderer);
          finishEnvironment(pmrem.fromScene(room, .06));
        } catch { showFallback(); }
        finally { room?.dispose(); pmrem?.dispose(); }
        return;
      }
      if (environmentLoading) return;
      environmentLoading = true;
      fetchEnvironmentBytes(new URL('media/headset-room.pmrem.gz', base), environmentAbort.signal).then(bytes => {
        environmentLoading = false;
        if (disposed || failed) return;
        environmentBytes = bytes; prepareEnvironment();
      }, () => {
        environmentLoading = false;
        if (disposed || failed) return;
        environmentFailed = true; prepareEnvironment();
      });
    }
    frames = demandFrames({
      request: callback => window.requestAnimationFrame(callback),
      cancel: handle => window.cancelAnimationFrame(handle),
      hidden: () => document.hidden || failed,
      render: () => {
        if (!model || !prepared || disposed || failed) return;
        try {
          // Render into the hidden canvas first. Keep the actual-model preview
          // visible through shader/texture preparation, including a failed frame.
          renderer.render(scene, camera);
          if (ready || disposed || failed) return;
          controls = attachTrackball(surface, { initial: home.toArray(), onChange: quaternion => {
            pivot.quaternion.fromArray(quaternion); frames.draw();
          } });
          surface.setAttribute('tabindex', '0'); surface.setAttribute('role', 'group');
          surface.setAttribute('aria-label', 'Apple Vision Pro, rotatable 3D model');
          surface.setAttribute('aria-describedby', 'headset-instructions');
          canvas.hidden = false; fallback.hidden = true;
          ready = true;
          surface.dataset.modelState = 'ready';
          status.textContent = '3D headset ready. Drag to turn, or focus it for keyboard controls.';
        } catch { showFallback(); }
      }
    });
    const redraw = () => {
      if (prepared && !disposed && !failed && !document.hidden) frames.draw();
    };
    function prepareModel() {
      if (!model || prepared || preparing || disposed || failed || document.hidden) return;
      if (!environmentMap) { prepareEnvironment(); return; }
      preparing = true;
      surface.dataset.modelState = 'preparing';
      const failedPreparation = () => {
        preparing = false;
        if (!disposed && !failed) showFallback();
      };
      try {
        // Let supported drivers compile the exact scene's shaders in parallel.
        // The static preview stays visible; input cannot force an early draw.
        const compilation = typeof renderer.compileAsync === 'function' ? renderer.compileAsync(scene, camera) : undefined;
        Promise.resolve(compilation).then(() => {
          preparing = false;
          if (disposed || failed) return;
          prepared = true;
          redraw();
        }, failedPreparation);
      } catch { failedPreparation(); }
    }
    const resize = () => {
      if (disposed || failed) return;
      const box = surface.getBoundingClientRect();
      const width = Math.max(1, Math.min(380, Math.round(box.width)));
      const height = Math.max(1, Math.min(340, Math.round(box.height)));
      renderer.setPixelRatio(Math.min(1.75, Math.max(1, window.devicePixelRatio || 1)));
      renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
      redraw();
    };
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(resize); resizeObserver.observe(surface);
    } else listen(window, 'resize', resize);
    // Refresh the fixed canvas when page compositing changes. The existing
    // scheduler coalesces event bursts and never queues another frame itself.
    listen(window, 'scroll', redraw, { passive: true });
    listen(window, 'scrollend', redraw, { passive: true });
    listen(document, 'maestro:misprint', redraw);
    listen(document, 'visibilitychange', () => {
      if (document.hidden) { controls?.cancel(); frames.stop(); }
      else { prepareEnvironment(); prepareModel(); redraw(); }
    });
    listen(window, 'pagehide', event => {
      if (event.persisted) { controls?.cancel(); frames.stop(); }
      else dispose();
    });
    listen(window, 'pageshow', event => { if (event.persisted) resize(); prepareEnvironment(); prepareModel(); redraw(); });
    listen(canvas, 'webglcontextlost', event => { event.preventDefault(); showFallback(); });
    listen(fallback, 'error', () => {
      fallback.hidden = true;
      surface.dataset.imageMissing = 'true';
      status.textContent = 'Headset preview unavailable. Spatial Synth Maestro is coming to Apple Vision Pro.';
    });
    const manager = new THREE.LoadingManager();
    const base = new URL('./', document.baseURI);
    manager.setURLModifier(value => {
      if (value.startsWith('blob:') || value.startsWith('data:image/')) return value;
      const url = new URL(value, base);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw Error('Headset assets must be local');
      return url.href;
    });
    const loader = new GLTFLoader(manager);
    surface.dataset.modelState = 'loading';
    prepareEnvironment();
    loader.load(new URL('media/vision-pro.glb', base).href, gltf => {
      if (disposed || failed) { disposeObject(gltf.scene); return; }
      model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) { showFallback(); return; }
      model.position.sub(sphere.center);
      const normalized = new THREE.Group(); normalized.add(model);
      normalized.scale.setScalar(1 / sphere.radius);
      pivot.add(normalized);
      model.traverse(node => {
        if (node.isMesh) {
          node.castShadow = false; node.receiveShadow = false;
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            if (material && 'envMapIntensity' in material) material.envMapIntensity = .95;
          }
        }
      });
      resize();
      prepareModel();
    }, undefined, showFallback);
    resize();
  } catch { showFallback(); }
}
