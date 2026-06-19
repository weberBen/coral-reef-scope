import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { P } from './params.js';
import { getSceneColors, isDark } from './theme.js';

export function initScene() {
  const tc = getSceneColors();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(tc.clearColor);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  document.getElementById('tab-simulation').prepend(renderer.domElement);

  const scene = new THREE.Scene();

  // Underwater fog
  scene.fog = new THREE.FogExp2(tc.fogColor, tc.fogDensity);

  // Gradient background (sky above water → deep blue below)
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = 2; bgCanvas.height = 512;
  scene._bgCanvas = bgCanvas;
  _paintBgGradient(bgCanvas, tc.bgStops);
  const bgTex = new THREE.CanvasTexture(bgCanvas);
  bgTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = bgTex;

  // Camera
  const camera = new THREE.PerspectiveCamera(
    50, window.innerWidth / window.innerHeight, 0.1, 300
  );
  camera.position.set(20, -5, 18);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -P.D / 2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 120;
  controls.minDistance = 3;
  controls.update();

  // === Lights ===

  // Soft ambient fill
  scene.add(new THREE.AmbientLight(0x2244667, 0.3));

  // Sky/ground hemisphere
  scene.add(new THREE.HemisphereLight(0x6ca6d4, 0x2a3a20, 0.5));

  // Sun — warm directional with shadows
  const sun = new THREE.DirectionalLight(0xffeedd, 1.5);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -50;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 130;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // Underwater caustic light — shifts position for animation feel
  const causticLight = new THREE.PointLight(0x44aadd, 0.8, 60, 1.5);
  causticLight.position.set(0, -3, 0);
  scene.add(causticLight);

  // Secondary fill from below (bounce light from seabed)
  const fillBelow = new THREE.PointLight(0x886644, 0.2, 40);
  fillBelow.position.set(0, -P.D + 2, 0);
  scene.add(fillBelow);

  return { scene, camera, renderer, controls, causticLight };
}

export function handleResize(camera, renderer) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function _paintBgGradient(canvas, stops) {
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, stops[0]);
  grad.addColorStop(0.3, stops[1]);
  grad.addColorStop(0.7, stops[2]);
  grad.addColorStop(1, stops[3]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 512);
}

export function updateSceneTheme(scene, camera, renderer, objects) {
  const tc = getSceneColors();
  renderer.setClearColor(tc.clearColor);
  scene.fog.color.set(tc.fogColor);
  scene.fog.density = tc.fogDensity;

  // Repaint background gradient
  if (scene._bgCanvas) {
    _paintBgGradient(scene._bgCanvas, tc.bgStops);
    const old = scene.background;
    const bgTex = new THREE.CanvasTexture(scene._bgCanvas);
    bgTex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = bgTex;
    if (old && old.dispose) old.dispose();
  }

  // Update seabed tint
  if (objects && objects.seabed) {
    objects.seabed.material.color.set(isDark() ? 0x8B7355 : 0xd4b896);
  }

  // Update water shader uniforms
  if (objects && objects.waterUniforms) {
    const u = objects.waterUniforms;
    u.uDeepColor.value.set(...tc.waterDeep);
    u.uSurfColor.value.set(...tc.waterSurf);
    u.uHorizColor.value.set(...tc.waterHoriz);
  }
}
