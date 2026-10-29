/* Kaplan runner in 3D for the "How it works" section.
 * Built once into js/vendor/turbine3d.min.js (three.js bundled in, one IIFE), with three@0.169.0
 * installed anywhere on NODE_PATH:
 *   npx esbuild js/3d/turbine3d.src.js --bundle --minify --format=iife --target=es2019 --outfile=js/vendor/turbine3d.min.js
 * The model (assets/3d/kaplan.glb) is meshopt-compressed: gltf-transform meshopt <src.glb> kaplan.glb
 * main.js loads that file only on desktops, near the section, without reduced motion.
 * Exposes window.GESTurbine.mount(canvas, glbUrl, onProgress(0..1)) → Promise<{ setRunning(bool) }>. */
import { WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, MeshStandardMaterial, Box3, Vector3, Group, SRGBColorSpace, ACESFilmicToneMapping, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

function mount(canvas, url, onProgress) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new Scene();
  // A soft studio room for reflections: bare lights alone leave metal nearly black.
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const camera = new PerspectiveCamera(32, 1, 0.01, 100);
  scene.add(new HemisphereLight(0xe4f1ff, 0x1d3557, 0.5));
  const key = new DirectionalLight(0xffffff, 2.0); key.position.set(3, 4, 5); scene.add(key);
  const rim = new DirectionalLight(0x46c6f7, 2.4); rim.position.set(-4, 1, -3); scene.add(rim);

  // The model ships with one untextured material: light brushed steel with a faint brand-blue cast.
  const steel = new MeshStandardMaterial({ color: 0x9aa9ba, metalness: 0.9, roughness: 0.38, envMapIntensity: 0.32 });

  const spin = new Group(); scene.add(spin);
  let w = 0, h = 0;
  const size = () => {
    const r = canvas.getBoundingClientRect();
    if (r.width === w && r.height === h) return;
    w = r.width; h = r.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
  };

  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url, (e) => { if (onProgress && e.total) onProgress(e.loaded / e.total); }).then((gltf) => {
    const model = gltf.scene;
    model.traverse((o) => { if (o.isMesh) o.material = steel; });
    // Centre on the origin and scale to a unit sphere so the camera framing never depends on the file.
    const box = new Box3().setFromObject(model);
    const c = box.getCenter(new Vector3()), s = box.getSize(new Vector3());
    const k = 1 / Math.max(s.x, s.y, s.z);
    model.position.sub(c).multiplyScalar(k); model.scale.setScalar(k);
    spin.add(model);
    camera.position.set(0, 0.3, 1.75); camera.lookAt(0, 0, 0);
    spin.rotation.x = 0.25;

    let running = false, raf = 0, last = 0, dragX = 0, vel = 0;
    let down = null;
    canvas.addEventListener('pointerdown', (e) => { down = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (down === null) return; dragX += (e.clientX - down) * 0.01; vel = (e.clientX - down) * 0.01; down = e.clientX; });
    const up = () => { down = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

    const frame = (now) => {
      raf = 0;
      if (!running) return;
      const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
      size();
      spin.rotation.y += dt * 0.55 + dragX; dragX = 0;
      if (down === null) { spin.rotation.y += vel; vel *= 0.92; }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    size(); renderer.render(scene, camera);
    return {
      setRunning(on) {
        running = on;
        if (on && !raf) { last = 0; raf = requestAnimationFrame(frame); }
      },
    };
  });
}

window.GESTurbine = { mount };
