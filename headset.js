import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { attachTrackball, demandFrames } from './headset-controls.mjs';

// Local community mesh, embedded textures, direct manipulation. No animation
// mixer, idle loop, autospin, inertia, audio, CDN or remote environment map.
const surface = document.getElementById('headset-view');
const canvas = document.getElementById('headset-canvas');
const fallback = document.getElementById('headset-fallback');
const status = document.getElementById('headset-status');

if (surface && canvas && fallback && status) {
  let renderer, scene, environmentMap, model, controls, resizeObserver, frames;
  let disposed = false, failed = false, ready = false;
  const listeners = [];
  const listen = (target, event, callback, options) => {
    target.addEventListener(event, callback, options);
    listeners.push(() => target.removeEventListener(event, callback, options));
  };
  const showFallback = () => {
    failed = true;
    controls?.dispose(); controls = null;
    frames?.stop();
    canvas.hidden = true; fallback.hidden = false;
    surface.removeAttribute('tabindex'); surface.setAttribute('role', 'img');
    surface.setAttribute('aria-label', 'Apple Vision Pro headset, static rendering of the credited 3D model.');
    surface.removeAttribute('aria-describedby');
    surface.dataset.modelState = 'fallback';
    status.textContent = 'Interactive 3D is unavailable here. The headset image and availability information remain available.';
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
  function dispose() {
    if (disposed) return;
    disposed = true;
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
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    environmentMap = pmrem.fromScene(room, .06);
    scene.environment = environmentMap.texture;
    scene.environmentIntensity = .85;
    room.dispose(); pmrem.dispose();
    frames = demandFrames({
      request: callback => window.requestAnimationFrame(callback),
      cancel: handle => window.cancelAnimationFrame(handle),
      hidden: () => document.hidden || failed,
      render: () => {
        if (!model || disposed || failed) return;
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
      if (model && !disposed && !failed && !document.hidden) frames.draw();
    };
    const resize = () => {
      if (disposed || failed) return;
      const box = surface.getBoundingClientRect();
      const width = Math.max(1, Math.min(380, Math.round(box.width)));
      const height = Math.max(1, Math.min(340, Math.round(box.height)));
      renderer.setPixelRatio(Math.min(1.75, Math.max(1, window.devicePixelRatio || 1)));
      renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
      frames.draw();
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
      else redraw();
    });
    listen(window, 'pagehide', event => {
      if (event.persisted) { controls?.cancel(); frames.stop(); }
      else dispose();
    });
    listen(window, 'pageshow', event => { if (event.persisted) resize(); redraw(); });
    listen(canvas, 'webglcontextlost', event => { event.preventDefault(); showFallback(); });
    listen(fallback, 'error', () => {
      fallback.hidden = true;
      surface.dataset.imageMissing = 'true';
      status.textContent = 'Headset preview unavailable. Open vision pro below for app availability.';
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
    }, undefined, showFallback);
    resize();
  } catch { showFallback(); }
}
