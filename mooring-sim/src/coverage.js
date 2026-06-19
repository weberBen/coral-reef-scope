import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import GUI from 'lil-gui';
import { getCoverageColors, isDark } from './theme.js';
import { t } from './i18n.js';

// =============================================
//  STATE
// =============================================

const state = {
  cameras: [],
  fov: 70,           // horizontal FOV of each camera
  numCameras: 5,
  ascent: 0,
  visRange: 3,       // normalized units
  zExag: 12,
  sensorRes: 1920,   // sensor resolution (pixels horizontal)
  gsdMax: 10,        // max useful GSD in mm/px
  contourSteps: 8,   // number of contour lines
  contourLevel: 0,   // 0-1 slider, selects active contour line
  contourPlay: true, // auto-sweep on by default
};

let scene, camera, renderer, controls, gui;
let reefGroup = null;
let reefMeshes = [];
let meshScale = 1;
let raycaster = new THREE.Raycaster();
let cameraMarkers = [];
let surfaceMarkers = [];   // wireframe sphere at surface (y=0)
let visMaxMarkers = [];    // small marker at max visibility altitude
let verticalLines = [];    // line from anchor to surface
let reefMeta = {};         // metadata from GLB (label, bbox, etc.)

let faceData = [];   // [{center, area, meshRef, faceIdx}]
let totalArea = 0;
let covDisplay = { pct: '0%', count: '' };
let initialized = false;
let tooltip = null;
let meshYMin = 0, meshYMax = 0;

// Depth colormaps — high contrast, many stops for fine depth discrimination
const CMAP_DARK = [
  [0.0,  [255, 240, 140]], [0.05, [240, 230, 80]],
  [0.1,  [200, 220, 50]],  [0.15, [140, 215, 60]],
  [0.2,  [80, 210, 90]],   [0.25, [40, 205, 140]],
  [0.3,  [20, 200, 180]],  [0.4,  [15, 180, 210]],
  [0.5,  [20, 150, 230]],  [0.6,  [35, 110, 220]],
  [0.7,  [50, 75, 200]],   [0.8,  [60, 45, 180]],
  [0.9,  [50, 25, 150]],   [1.0,  [30, 10, 110]],
];
const CMAP_LIGHT = [
  [0.0,  [255, 245, 160]], [0.05, [245, 235, 100]],
  [0.1,  [220, 230, 70]],  [0.15, [170, 225, 80]],
  [0.2,  [110, 215, 110]], [0.25, [60, 210, 150]],
  [0.3,  [30, 200, 180]],  [0.4,  [25, 180, 210]],
  [0.5,  [30, 155, 225]],  [0.6,  [45, 120, 210]],
  [0.7,  [55, 85, 195]],   [0.8,  [65, 55, 175]],
  [0.9,  [55, 35, 150]],   [1.0,  [40, 20, 120]],
];
function getCmap() {
  return isDark() ? CMAP_DARK : CMAP_LIGHT;
}
function depthColor(t) {
  const CMAP = getCmap();
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < CMAP.length - 1; i++) {
    const [t0, c0] = CMAP[i], [t1, c1] = CMAP[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return [(c0[0] + f * (c1[0] - c0[0])) / 255, (c0[1] + f * (c1[1] - c0[1])) / 255, (c0[2] + f * (c1[2] - c0[2])) / 255];
    }
  }
  return [60 / 255, 100 / 255, 180 / 255];
}

const AZIMUTH_BINS = 360; // angular resolution for viewshed sweep

// =============================================
//  INIT
// =============================================

export function initCoverage() {
  if (initialized) return;
  initialized = true;

  const container = document.getElementById('tab-coverage');
  container.innerHTML = `<div id="coverage-loading" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--t3);font-size:16px;z-index:5">${t('covLoading')}</div>`;

  const cc = getCoverageColors();
  renderer = new THREE.WebGLRenderer({ antialias: true });
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(cc.clearColor);
  container.prepend(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(cc.bg);

  camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 1000);
  camera.position.set(8, 12, 8);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  scene.add(new THREE.AmbientLight(0x8899aa, 1.2));
  const d1 = new THREE.DirectionalLight(0xffffff, 1.8);
  d1.position.set(5, 10, 8);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xaabbcc, 0.8);
  d2.position.set(-5, -3, 4);
  scene.add(d2);
  const d3 = new THREE.DirectionalLight(0x667788, 0.5);
  d3.position.set(0, -8, 0);
  scene.add(d3);

  scene._grid = new THREE.GridHelper(20, 40, cc.grid1, cc.grid2);
  scene.add(scene._grid);

  const loader = new GLTFLoader();
  loader.load('/data/reef.glb', (gltf) => {
    // Extract metadata from GLB (stored in mesh extras by trimesh)
    let extras = {};
    gltf.scene.traverse(child => {
      if (child.isMesh && child.userData) {
        Object.assign(extras, child.userData);
      }
    });
    // Also check asset-level extras
    try {
      const assetExtras = gltf.parser.json.asset?.extras || {};
      Object.assign(extras, assetExtras);
    } catch(e) {}
    // Also check mesh-level extras in raw JSON
    try {
      const meshes = gltf.parser.json.meshes || [];
      for (const m of meshes) {
        if (m.extras) Object.assign(extras, m.extras);
      }
    } catch(e) {}

    reefMeta = {
      label: extras.label || '',
      location: extras.location || '',
      bbox: extras.bbox || null,
      resolution: extras.resolution || null,
      source: extras.source || '',
    };
    console.log('Reef metadata:', reefMeta);

    const root = gltf.scene;
    root.rotation.x = -Math.PI / 2;
    root.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const horizMax = Math.max(size.x, size.z);
    meshScale = 10 / (horizMax || 1);

    reefGroup = new THREE.Group();
    root.position.sub(center);
    reefGroup.add(root);
    reefGroup.scale.set(meshScale, meshScale * state.zExag, meshScale);
    scene.add(reefGroup);

    reefGroup.updateMatrixWorld(true);
    let yMin = Infinity, yMax = -Infinity;
    reefGroup.traverse(child => {
      if (!child.isMesh) return;
      reefMeshes.push(child);
      const pos = child.geometry.attributes.position;
      child.updateMatrixWorld(true);
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
        if (v.y < yMin) yMin = v.y;
        if (v.y > yMax) yMax = v.y;
      }
    });
    meshYMin = yMin;
    meshYMax = yMax;

    for (const child of reefMeshes) {
      const pos = child.geometry.attributes.position;
      const v = new THREE.Vector3();
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
        const t = (v.y - yMin) / ((yMax - yMin) || 1);
        const [r, g, b] = depthColor(t);
        colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
      }
      child.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      child.material = new THREE.MeshPhongMaterial({
        vertexColors: true, side: THREE.DoubleSide, shininess: 20,
      });
      child.userData.baseColors = new Float32Array(colors);

    }

    precomputeFaces();

    // Depth-weighted barycenter: deeper faces attract the focus more
    const nb = new THREE.Box3().setFromObject(reefGroup);
    const meshSize = nb.getSize(new THREE.Vector3());

    let bx = 0, by = 0, bz = 0, bw = 0;
    for (const f of faceData) {
      const depthBelow = meshYMax - f.center.y;
      const weight = f.area * depthBelow * depthBelow;
      bx += f.center.x * weight;
      by += f.center.y * weight;
      bz += f.center.z * weight;
      bw += weight;
    }
    const focusTarget = bw > 0
      ? new THREE.Vector3(bx / bw, by / bw, bz / bw)
      : nb.getCenter(new THREE.Vector3());

    controls.target.copy(focusTarget);

    // Find principal axis of deep features (covariance eigenvector)
    let covXX = 0, covXZ = 0, covZZ = 0;
    for (const f of faceData) {
      const depthBelow = meshYMax - f.center.y;
      const w = f.area * depthBelow;
      const dx = f.center.x - focusTarget.x;
      const dz = f.center.z - focusTarget.z;
      covXX += dx * dx * w;
      covXZ += dx * dz * w;
      covZZ += dz * dz * w;
    }
    // View perpendicular to principal spread axis for best overview
    const principalAngle = 0.5 * Math.atan2(2 * covXZ, covXX - covZZ);
    const azimuth = principalAngle + Math.PI / 2;
    const tiltAngle = 35 * Math.PI / 180;
    const camDist = Math.max(meshSize.x, meshSize.z) * 0.7;

    camera.position.set(
      focusTarget.x + Math.cos(azimuth) * Math.cos(tiltAngle) * camDist,
      focusTarget.y + Math.sin(tiltAngle) * camDist,
      focusTarget.z + Math.sin(azimuth) * Math.cos(tiltAngle) * camDist
    );
    controls.update();

    container.querySelector('#coverage-loading')?.remove();
    console.log('Reef: faces=' + faceData.length + ' area=' + totalArea.toFixed(1));

    // Display reef label with GPS on hover
    if (reefMeta.label) {
      const bb = reefMeta.bbox;
      const gpsText = bb ? `${((bb[1]+bb[3])/2).toFixed(4)}, ${((bb[0]+bb[2])/2).toFixed(4)}` : '';
      const labelEl = document.createElement('div');
      labelEl.id = 'reef-label';
      labelEl.style.cssText = 'position:absolute;top:60px;left:16px;z-index:10;cursor:default';
      labelEl.innerHTML = `
        <div style="font-size:18px;font-weight:700;color:var(--t1)">${reefMeta.label}</div>
        <div style="font-size:12px;color:var(--t3);margin-top:2px">${reefMeta.location || ''}</div>
        <div class="reef-label-gps" style="font-size:11px;color:var(--cyan);margin-top:4px;opacity:0;transition:opacity .2s">${gpsText}</div>
      `;
      labelEl.addEventListener('mouseenter', () => {
        labelEl.querySelector('.reef-label-gps').style.opacity = '1';
      });
      labelEl.addEventListener('mouseleave', () => {
        labelEl.querySelector('.reef-label-gps').style.opacity = '0';
      });
      labelEl.style.cursor = 'pointer';
      labelEl.addEventListener('click', () => {
        const cx = bb ? ((bb[0] + bb[2]) / 2) : 0;
        const cy = bb ? ((bb[1] + bb[3]) / 2) : 0;
        window.open(`https://allencoralatlas.org/atlas/#14.00/${cy.toFixed(4)}/${cx.toFixed(4)}`, '_blank');
      });
      container.appendChild(labelEl);
    }

    // Apply light colormap if needed at load time
    if (!isDark()) repaintDepthColors();

    // Build contour lines
    buildAllContourLines();

    // Start auto-demo loop
    startAutoDemo();
  }, null, err => {
    console.error('GLB error:', err);
    const el = container.querySelector('#coverage-loading');
    if (el) el.textContent = 'Erreur: ' + err.message;
  });

  renderer.domElement.addEventListener('click', (e) => { stopAutoDemo(); onClickPlace(e); });
  renderer.domElement.addEventListener('mousemove', onMouseMove);

  tooltip = document.createElement('div');
  tooltip.style.cssText = 'position:absolute;padding:6px 12px;background:var(--panel-bg);border:1px solid rgba(56,189,248,0.3);border-radius:8px;color:var(--cyan-l);font-size:12px;pointer-events:none;display:none;z-index:20;font-family:Inter,sans-serif;white-space:nowrap';
  container.appendChild(tooltip);

  // Top bar: cameras count + coverage stats + legend
  const topBar = document.createElement('div');
  topBar.id = 'cov-topbar';
  topBar.style.cssText = 'position:absolute;top:60px;left:50%;transform:translateX(-50%);display:flex;gap:20px;align-items:center;z-index:10;pointer-events:none;flex-wrap:wrap;justify-content:center;max-width:calc(100% - 320px);padding:0 8px';
  topBar.innerHTML = `
    <div class="cov-stat" data-tip="${t('covTipCam')}">
      <div class="cov-label">${t('covCameras')}</div>
      <div id="camera-count" class="cov-num" style="color:var(--t1)">0</div>
    </div>
    <div class="cov-stat" data-tip="${t('covTipGround')}">
      <div class="cov-label">${t('covGround')}</div>
      <div id="coverage-value" class="cov-num" style="color:var(--green)">0%</div>
    </div>
    <div class="cov-stat" data-tip="${t('covTipSurface')}">
      <div class="cov-label">${t('covSurface')}</div>
      <div id="ascent-coverage-value" class="cov-num" style="color:var(--green)">0%</div>
    </div>
    <div class="cov-stat" data-tip="${t('covTipGsd')}">
      <div class="cov-label">${t('covGsdMean')}</div>
      <div id="gsd-value" class="cov-num" style="color:var(--t1)">--</div>
    </div>
  `;
  container.appendChild(topBar);

  // Inject styles for stat tooltips
  const style = document.createElement('style');
  style.textContent = `
    .cov-stat { text-align:center; position:relative; cursor:default; pointer-events:auto; }
    .cov-label { font-size:10px; text-transform:uppercase; letter-spacing:1.5px; color:var(--t3); margin-bottom:2px; }
    .cov-num { font-size:36px; font-weight:800; font-variant-numeric:tabular-nums; text-shadow:0 2px 20px rgba(0,0,0,.5); transition:color .3s; }
    .light-theme .cov-num { text-shadow: 0 2px 10px rgba(0,0,0,.08); }
    @media (max-width: 900px) {
      .cov-num { font-size: 22px; }
      .cov-label { font-size: 8px; letter-spacing: 1px; }
      #cov-topbar { max-width: 100% !important; top: 52px; gap: 8px 20px; display: grid !important; grid-template-columns: 1fr 1fr; }
      #tab-coverage > .lil-gui { display: none; }
      #tab-coverage > .lil-gui.show { display: block; top: 140px !important; bottom: auto !important; right: 8px; max-height: 55vh; overflow-y: auto; }
      .cov-toggle-bar { display: flex !important; }
      #reef-label { top: auto !important; bottom: 50px !important; left: 12px !important; }
    }
    .cov-stat::after {
      content: attr(data-tip);
      position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
      margin-top: 8px; padding: 8px 14px; max-width: 240px; width: max-content;
      background: var(--panel-bg-strong); border: 1px solid rgba(56,189,248,0.25);
      border-radius: 8px; color: var(--t3); font-size: 11px; line-height: 1.5;
      white-space: normal; text-align: left; pointer-events: none;
      opacity: 0; transition: opacity 0.2s; z-index: 30;
    }
    .cov-stat:hover::after { opacity: 1; }
  `;
  container.appendChild(style);

  setupGUI(container);

  let lastLogPos = '';
  let lastAnimTime = performance.now();
  (function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = (now - lastAnimTime) / 1000;
    lastAnimTime = now;
    if (state.contourPlay && !mouseOverMesh && contourLines.length > 0) {
      state.contourLevel = (state.contourLevel + dt * 0.5) % 1;
    }
    updateContourLevel();
    controls.update();
    renderer.render(scene, camera);

    // Log camera orientation when it changes
    const p = camera.position;
    const t = controls.target;
    const dx = p.x - t.x, dy = p.y - t.y, dz = p.z - t.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const tilt = Math.asin(dy / dist) * 180 / Math.PI;
    const azimuth = Math.atan2(dz, dx) * 180 / Math.PI;
    const key = `${azimuth.toFixed(0)},${tilt.toFixed(0)},${dist.toFixed(1)}`;
    if (key !== lastLogPos) {
      lastLogPos = key;
      console.log(`Camera: azimuth=${azimuth.toFixed(1)}° tilt=${tilt.toFixed(1)}° dist=${dist.toFixed(1)}`);
    }
  })();

  window.addEventListener('resize', () => {
    const cw = container.clientWidth || window.innerWidth;
    const ch = container.clientHeight || window.innerHeight;
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    renderer.setSize(cw, ch);
  });
}

// =============================================
//  HOVER: TOOLTIP + CONTOUR LINE
// =============================================

let contourY = null;       // current contour Y level (normalized)
let contourThrottle = 0;

function onMouseMove(event) {
  if (!tooltip) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  // Check all camera-related markers
  if (cameraMarkers.length > 0) {
    raycaster.setFromCamera(mouse, camera);
    const allMarkers = [...cameraMarkers, ...surfaceMarkers, ...visMaxMarkers];
    const camHits = raycaster.intersectObjects(allMarkers, false);
    if (camHits.length > 0) {
      const obj = camHits[0].object;
      let idx = cameraMarkers.indexOf(obj);
      let label = '';
      if (idx >= 0) {
        label = 'Anchor: ' + state.cameras[idx].realDepth.toFixed(1) + ' m';
      } else {
        idx = surfaceMarkers.indexOf(obj);
        if (idx >= 0) {
          label = 'Surface: 0 m';
        } else {
          idx = visMaxMarkers.indexOf(obj);
          if (idx >= 0) {
            const markerY = visMaxMarkers[idx].position.y;
            const frac = (markerY - meshYMin) / ((meshYMax - meshYMin) || 1);
            const depth = -(1 - frac) * 19.5;
            label = 'Max visibility: ' + depth.toFixed(1) + ' m';
          }
        }
      }
      if (label) {
        tooltip.textContent = label;
        tooltip.style.display = 'block';
        const tx = Math.min(event.clientX - rect.left + 15, rect.width - 200);
        tooltip.style.left = Math.max(8, tx) + 'px';
        tooltip.style.top = (event.clientY - rect.top - 30) + 'px';
        return;
      }
    }
  }

  // Check mesh surface for contour + geo coords
  {
    raycaster.setFromCamera(mouse, camera);
    const meshHits = raycaster.intersectObjects(reefMeshes, true);
    if (meshHits.length > 0 && tooltip) {
      const hitPt = meshHits[0].point;
      const depthFrac = (hitPt.y - meshYMin) / ((meshYMax - meshYMin) || 1);
      const realDepth = -(1 - depthFrac) * 19.5;

      // Compute geo coordinates from normalized XZ position
      let geoText = '';
      if (reefMeta.bbox && reefGroup) {
        const bb = reefMeta.bbox;
        if (!reefGroup._cachedBox) {
          reefGroup._cachedBox = new THREE.Box3().setFromObject(reefGroup);
        }
        const nmin = reefGroup._cachedBox.min;
        const nmax = reefGroup._cachedBox.max;
        const xFrac = (hitPt.x - nmin.x) / ((nmax.x - nmin.x) || 1);
        const zFrac = (hitPt.z - nmin.z) / ((nmax.z - nmin.z) || 1);
        const lon = bb[0] + xFrac * (bb[2] - bb[0]);
        const lat = bb[1] + zFrac * (bb[3] - bb[1]);
        geoText = ' | ' + lat.toFixed(4) + ', ' + lon.toFixed(4);
      }

      tooltip.textContent = realDepth.toFixed(1) + ' m' + geoText;
      tooltip.style.display = 'block';
      tooltip.style.left = (event.clientX - rect.left + 15) + 'px';
      tooltip.style.top = (event.clientY - rect.top - 10) + 'px';

      // Pause animation, show contour at mouse position
      mouseOverMesh = true;
      const now = performance.now();
      if (now - contourThrottle > 50) {
        contourThrottle = now;
        if (contourY === null || Math.abs(hitPt.y - contourY) > 0.05) {
          contourY = hitPt.y;
          paintContour(hitPt.y);
        }
      }
      return;
    }
  }

  // Nothing hovered: resume animation
  if (mouseOverMesh) {
    mouseOverMesh = false;
    contourY = null;
    clearContour();
  }
  tooltip.style.display = 'none';
}

// =============================================
//  TRUE CONTOUR LINES (plane-mesh intersection)
// =============================================

let contourLines = [];      // THREE.LineSegments objects in scene
let activeContourLine = null; // the bright animated one
let mouseOverMesh = false;

// Extract contour line segments at a given Y level by intersecting all triangles
function extractContour(yLevel) {
  const segments = [];
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();

  for (const mesh of reefMeshes) {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const idx = geo.index;
    mesh.updateMatrixWorld(true);
    const mat = mesh.matrixWorld;
    const count = idx ? idx.count / 3 : pos.count / 3;

    for (let f = 0; f < count; f++) {
      if (idx) {
        va.fromBufferAttribute(pos, idx.getX(f * 3)).applyMatrix4(mat);
        vb.fromBufferAttribute(pos, idx.getX(f * 3 + 1)).applyMatrix4(mat);
        vc.fromBufferAttribute(pos, idx.getX(f * 3 + 2)).applyMatrix4(mat);
      } else {
        va.fromBufferAttribute(pos, f * 3).applyMatrix4(mat);
        vb.fromBufferAttribute(pos, f * 3 + 1).applyMatrix4(mat);
        vc.fromBufferAttribute(pos, f * 3 + 2).applyMatrix4(mat);
      }

      // Find which edges cross yLevel
      const pts = [];
      const edges = [[va, vb], [vb, vc], [vc, va]];
      for (const [p1, p2] of edges) {
        if ((p1.y - yLevel) * (p2.y - yLevel) < 0) {
          const t = (yLevel - p1.y) / (p2.y - p1.y);
          pts.push(new THREE.Vector3(
            p1.x + t * (p2.x - p1.x),
            yLevel,
            p1.z + t * (p2.z - p1.z)
          ));
        }
      }
      if (pts.length === 2) {
        segments.push(pts[0], pts[1]);
      }
    }
  }
  return segments;
}

function createContourLineObject(segments, color, linewidth, opacity) {
  if (segments.length === 0) return null;
  const geo = new THREE.BufferGeometry().setFromPoints(segments);
  const mat = new THREE.LineBasicMaterial({
    color, transparent: opacity < 1, opacity, depthTest: true,
  });
  const line = new THREE.LineSegments(geo, mat);
  line.renderOrder = 10;
  return line;
}

function buildAllContourLines() {
  clearAllContourLines();
  lastActiveIdx = -1;
  mouseOverMesh = false;
  state.contourPlay = true;
  state.contourLevel = 0;
  const range = meshYMax - meshYMin;
  if (range < 0.01 || reefMeshes.length === 0) return;
  const spacing = range / state.contourSteps;

  for (let y = meshYMin + spacing * 0.5; y < meshYMax; y += spacing) {
    const segs = extractContour(y);
    const subtle = createContourLineObject(segs, 0xffffff, 1, 0.15);
    const bright = createContourLineObject(segs, 0xffffff, 2, 0.8);
    if (subtle && bright) {
      scene.add(subtle);
      bright.visible = false;
      scene.add(bright);
      contourLines.push({ subtle, bright, y });
    }
  }
}

function clearAllContourLines() {
  for (const cl of contourLines) {
    scene.remove(cl.subtle); cl.subtle.geometry.dispose(); cl.subtle.material.dispose();
    scene.remove(cl.bright); cl.bright.geometry.dispose(); cl.bright.material.dispose();
  }
  contourLines = [];
  if (activeContourLine) {
    scene.remove(activeContourLine);
    activeContourLine.geometry.dispose();
    activeContourLine.material.dispose();
    activeContourLine = null;
  }
}

let lastActiveIdx = -1;

function updateContourLevel() {
  if (!state.contourPlay || mouseOverMesh || contourLines.length === 0) return;
  const idx = Math.min(Math.floor(state.contourLevel * contourLines.length), contourLines.length - 1);
  if (idx === lastActiveIdx) return;
  lastActiveIdx = idx;

  for (let i = 0; i < contourLines.length; i++) {
    contourLines[i].bright.visible = (i === idx);
    contourLines[i].subtle.visible = (i !== idx);
  }
}

function paintContour(targetY) {
  // Hide all pre-built lines, show a single contour at mouse Y
  for (const cl of contourLines) {
    cl.subtle.visible = false;
    cl.bright.visible = false;
  }
  if (activeContourLine) {
    scene.remove(activeContourLine);
    activeContourLine.geometry.dispose();
    activeContourLine.material.dispose();
  }
  const segs = extractContour(targetY);
  activeContourLine = createContourLineObject(segs, 0xffffff, 2, 0.8);
  if (activeContourLine) scene.add(activeContourLine);
}

function clearContour() {
  if (activeContourLine) {
    scene.remove(activeContourLine);
    activeContourLine.geometry.dispose();
    activeContourLine.material.dispose();
    activeContourLine = null;
  }
  // Restore pre-built lines visibility
  lastActiveIdx = -1;
}

// =============================================
//  FACE PRECOMPUTATION
// =============================================

function precomputeFaces() {
  faceData = [];
  totalArea = 0;
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();

  for (const mesh of reefMeshes) {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const idx = geo.index;
    mesh.updateMatrixWorld(true);
    const mat = mesh.matrixWorld;
    const count = idx ? idx.count / 3 : pos.count / 3;

    for (let f = 0; f < count; f++) {
      if (idx) {
        va.fromBufferAttribute(pos, idx.getX(f * 3)).applyMatrix4(mat);
        vb.fromBufferAttribute(pos, idx.getX(f * 3 + 1)).applyMatrix4(mat);
        vc.fromBufferAttribute(pos, idx.getX(f * 3 + 2)).applyMatrix4(mat);
      } else {
        va.fromBufferAttribute(pos, f * 3).applyMatrix4(mat);
        vb.fromBufferAttribute(pos, f * 3 + 1).applyMatrix4(mat);
        vc.fromBufferAttribute(pos, f * 3 + 2).applyMatrix4(mat);
      }
      const center = va.clone().add(vb).add(vc).divideScalar(3);
      const ab = new THREE.Vector3().subVectors(vb, va);
      const ac = new THREE.Vector3().subVectors(vc, va);
      const area = ab.cross(ac).length() * 0.5;

      if (area > 1e-8 && center.y < meshYMax - 0.01) {
        // Only underwater faces (exclude surface at y ≈ meshYMax)
        faceData.push({ center, area, meshRef: mesh, faceIdx: f });
        totalArea += area;
      }
    }
  }
}

// =============================================
//  CLICK TO PLACE
// =============================================

function onClickPlace(event) {
  if (reefMeshes.length === 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(reefMeshes, true);
  if (hits.length === 0) return;
  addCamera(hits[0].point.clone());
}

function addCamera(normPos) {
  const depthFrac = (normPos.y - meshYMin) / ((meshYMax - meshYMin) || 1);
  const realDepth = -(1 - depthFrac) * 19.5;
  state.cameras.push({ anchorPos: normPos.clone(), realDepth });

  const x = normPos.x, z = normPos.z;
  const anchorY = normPos.y + 0.08;
  const surfaceY = meshYMax + 0.5;

  // Max visibility altitude: where turbidity cuts off useful range
  // effRange = visRange * max(0.3, 1 - depthFrac*0.6)
  // Useful above ~30% of range → altitude where depthFrac ≈ 0.5
  const visMaxY = anchorY + (surfaceY - anchorY) * 0.6;

  // 1. Anchor marker (orange, solid)
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.5 })
  );
  marker.position.set(x, anchorY, z);
  scene.add(marker);
  cameraMarkers.push(marker);

  // 2. Surface marker (cyan, wireframe)
  const surfMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.6 })
  );
  surfMarker.position.set(x, surfaceY, z);
  scene.add(surfMarker);
  surfaceMarkers.push(surfMarker);

  // 3. Max visibility marker (yellow, small)
  const visMarker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.08, 0),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.7 })
  );
  visMarker.position.set(x, visMaxY, z);
  scene.add(visMarker);
  visMaxMarkers.push(visMarker);

  // 4. Vertical line connecting all three
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x, anchorY, z),
    new THREE.Vector3(x, visMaxY, z),
    new THREE.Vector3(x, surfaceY, z),
  ]);
  const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({
    color: 0x38bdf8, dashSize: 0.15, gapSize: 0.08, transparent: true, opacity: 0.35
  }));
  line.computeLineDistances();
  scene.add(line);
  verticalLines.push(line);

  updateCameraCount();
  computeCoverage();
}

function updateCameraCount() {
  const el = document.getElementById('camera-count');
  if (el) el.textContent = state.cameras.length;
}

// =============================================
//  VIEWSHED COVERAGE (R2 angular sweep, no raycasting)
// =============================================
//
// For each camera, compute azimuth + elevation angle to every face.
// Sort faces by azimuth bin then by distance. For each bin, sweep
// near-to-far and track the max elevation angle (horizon). A face
// is visible if its elevation exceeds the current horizon.

function computeCoverage() {
  if (faceData.length === 0 || state.cameras.length === 0) return;

  console.time('viewshed-r2');

  const visibleFaces = new Set();
  const range2 = state.visRange * state.visRange;

  for (const cam of state.cameras) {
    const cx = cam.anchorPos.x;
    const cz = cam.anchorPos.z;
    // Y position: interpolate anchor → surface
    const surfY = meshYMax + 0.5;
    const cy = cam.anchorPos.y + (surfY - cam.anchorPos.y) * state.ascent + 0.1;

    // Camera looks mostly horizontally with some vertical range
    // maxLookDown: how far below horizontal the camera sees (radians)
    // maxLookUp: how far above horizontal
    const maxLookDown = -45 * Math.PI / 180; // 45 deg below horizontal
    const maxLookUp = 30 * Math.PI / 180;    // 30 deg above horizontal

    // For each face, compute azimuth bin, distance, elevation angle
    const entries = [];
    for (let fi = 0; fi < faceData.length; fi++) {
      const fc = faceData[fi].center;
      const dx = fc.x - cx;
      const dz = fc.z - cz;
      const dy = fc.y - cy;
      const hDist2 = dx * dx + dz * dz;
      const dist2 = hDist2 + dy * dy;

      if (dist2 > range2) continue;

      const hDist = Math.sqrt(hDist2);
      const elevAngle = Math.atan2(dy, hDist);

      // Skip faces outside vertical FOV
      if (elevAngle < maxLookDown || elevAngle > maxLookUp) continue;

      const azimuth = Math.atan2(dz, dx);
      const azBin = ((azimuth / Math.PI * 0.5 + 0.5) * AZIMUTH_BINS) | 0;

      entries.push({ fi, azBin: Math.min(azBin, AZIMUTH_BINS - 1), dist: Math.sqrt(dist2), elevAngle });
    }

    // Sort by azimuth bin, then by distance (near first)
    entries.sort((a, b) => a.azBin - b.azBin || a.dist - b.dist);

    // R2 sweep: per azimuth bin, sweep near→far, track max elevation (horizon)
    // A face is visible only if its elevation angle EXCEEDS the current horizon.
    // A nearby hill raises the horizon → everything behind at lower angle is hidden.
    const horizon = new Float32Array(AZIMUTH_BINS).fill(maxLookDown);

    for (const e of entries) {
      const bin = e.azBin;
      if (e.elevAngle > horizon[bin]) {
        visibleFaces.add(e.fi);
        // This face raises the horizon in its direction
        horizon[bin] = e.elevAngle;
      }
      // Terrain also blocks adjacent bins (faces have width)
      if (bin > 0) horizon[bin - 1] = Math.max(horizon[bin - 1], e.elevAngle * 0.7);
      if (bin < AZIMUTH_BINS - 1) horizon[bin + 1] = Math.max(horizon[bin + 1], e.elevAngle * 0.7);
    }
  }

  // Stats
  let coveredArea = 0;
  for (const fi of visibleFaces) coveredArea += faceData[fi].area;
  const pct = totalArea > 0 ? (coveredArea / totalArea * 100) : 0;
  covDisplay.pct = pct.toFixed(1) + '%';
  updateCoverageDisplay(pct);

  // Also compute ascent (photogrammetric) coverage
  const ascentPct = computeAscentCoverage(visibleFaces);

  console.timeEnd('viewshed-r2');

  paintCoverage(visibleFaces);
}

// =============================================
//  ASCENT COVERAGE (photogrammetric)
// =============================================
// Each camera ascends from anchor to surface, looking DOWN.
// At each altitude step, compute the downward FOV cone.
// Visibility decreases with depth (turbidity).
// Union of all visible faces across the ascent = photogrammetric coverage.

function computeAscentCoverage(groundFaces) {
  if (faceData.length === 0 || state.cameras.length === 0) {
    updateAscentDisplay(0);
    updateUsefulDisplay(0);
    updateGsdDisplay(null);
    return 0;
  }

  const halfAngle = (state.fov / 2) * Math.PI / 180;
  const cosHalf = Math.cos(halfAngle);
  const DOWN = new THREE.Vector3(0, -1, 0);
  const toFace = new THREE.Vector3();
  const ascentSteps = 10;

  // Real-world scale: mesh is ~7500m wide normalized to ~10 units
  const metersPerUnit = 7500 / 10;

  // GSD = altitude_m * 2 * tan(fov/2) / sensor_pixels
  // altitude in real meters = (camY - faceY) * metersPerUnit / zExag
  const tanHalf = Math.tan(halfAngle);

  const allVisible = new Set(groundFaces);
  const usefulVisible = new Set(); // only faces seen during ascent with good GSD + visibility
  let gsdSum = 0;
  let gsdCount = 0;

  for (const cam of state.cameras) {
    const anchorY = cam.anchorPos.y;
    const surfaceY = meshYMax + 0.5;

    for (let s = 0; s <= ascentSteps; s++) {
      const t = s / ascentSteps;
      const camY = anchorY + (surfaceY - anchorY) * t;

      const depthFrac = 1 - (camY - meshYMin) / ((meshYMax - meshYMin) || 1);
      const effRange = state.visRange * Math.max(0.3, 1 - depthFrac * 0.6);

      const cx = cam.anchorPos.x;
      const cz = cam.anchorPos.z;

      for (let fi = 0; fi < faceData.length; fi++) {
        if (allVisible.has(fi) && usefulVisible.has(fi)) continue;
        const fc = faceData[fi].center;

        toFace.set(fc.x - cx, fc.y - camY, fc.z - cz);
        const dist = toFace.length();
        if (dist > effRange) continue;
        if (toFace.y >= 0) continue;

        toFace.normalize();
        if (toFace.dot(DOWN) < cosHalf) continue;

        // Compute GSD for this face from this altitude
        const altNorm = camY - fc.y; // normalized altitude above face
        const altMeters = altNorm * metersPerUnit / state.zExag;
        const footprint = altMeters * 2 * tanHalf; // width in meters at face distance
        const gsd = (footprint / state.sensorRes) * 1000; // mm/px

        // Turbidity: visibility range in meters decreases with depth
        const camDepthMeters = Math.abs(camY - meshYMax) * metersPerUnit / state.zExag;
        const visibilityMeters = Math.max(2, 30 - camDepthMeters * 0.8); // 30m at surface, decreases with depth
        const distMeters = dist * metersPerUnit / state.zExag;

        allVisible.add(fi);

        // Useful = GSD ok AND within turbidity visibility range
        if (gsd <= state.gsdMax && distMeters <= visibilityMeters) {
          usefulVisible.add(fi);
        }

        gsdSum += gsd;
        gsdCount++;
      }
    }
  }

  // All photogrammetric coverage
  let coveredArea = 0;
  for (const fi of allVisible) coveredArea += faceData[fi].area;
  const pct = totalArea > 0 ? (coveredArea / totalArea * 100) : 0;
  updateAscentDisplay(pct);

  // Useful coverage (GSD <= threshold)
  let usefulArea = 0;
  for (const fi of usefulVisible) usefulArea += faceData[fi].area;
  const usefulPct = totalArea > 0 ? (usefulArea / totalArea * 100) : 0;
  updateUsefulDisplay(usefulPct);

  // Average GSD
  const avgGsd = gsdCount > 0 ? gsdSum / gsdCount : 0;
  updateGsdDisplay(avgGsd);

  return pct;
}

function updateAscentDisplay(pct) {
  const el = document.getElementById('ascent-coverage-value');
  if (!el) return;
  el.textContent = pct.toFixed(1) + '%';
  el.style.color = pct < 20 ? 'var(--red-s)' : pct < 60 ? 'var(--yellow)' : 'var(--green)';
}

function updateUsefulDisplay(pct) {
  const el = document.getElementById('useful-coverage-value');
  if (!el) return;
  el.textContent = pct.toFixed(1) + '%';
  el.style.color = pct < 20 ? 'var(--red-s)' : pct < 60 ? 'var(--yellow)' : 'var(--green)';
}

function updateGsdDisplay(gsd) {
  const el = document.getElementById('gsd-value');
  if (!el) return;
  if (gsd === null || gsd === 0) { el.textContent = '--'; el.style.color = 'var(--t1)'; return; }
  el.textContent = gsd < 10 ? gsd.toFixed(1) + 'mm' : (gsd / 10).toFixed(1) + 'cm';
  el.style.color = gsd <= state.gsdMax ? 'var(--green)' : gsd <= state.gsdMax * 2 ? 'var(--yellow)' : 'var(--red-s)';
}

function paintCoverage(visibleFaces) {
  // Build per-mesh lookup
  const meshFaceMap = new Map();
  for (let fi = 0; fi < faceData.length; fi++) {
    const f = faceData[fi];
    if (!meshFaceMap.has(f.meshRef)) meshFaceMap.set(f.meshRef, []);
    meshFaceMap.get(f.meshRef).push({ fi, faceIdx: f.faceIdx });
  }

  for (const mesh of reefMeshes) {
    const colors = mesh.geometry.attributes.color;
    const base = mesh.userData.baseColors;
    if (!colors || !base) continue;
    colors.array.set(base); // reset

    const faces = meshFaceMap.get(mesh) || [];
    const idx = mesh.geometry.index;

    for (const { fi, faceIdx } of faces) {
      if (!visibleFaces.has(fi)) continue;
      for (let v = 0; v < 3; v++) {
        const vi = idx ? idx.getX(faceIdx * 3 + v) : faceIdx * 3 + v;
        // Tint visible faces pure red (#ff0000)
        const tint = 0.85;
        colors.array[vi * 3]     = base[vi * 3]     * (1 - tint) + (255 / 255) * tint;
        colors.array[vi * 3 + 1] = base[vi * 3 + 1] * (1 - tint) + (0 / 255) * tint;
        colors.array[vi * 3 + 2] = base[vi * 3 + 2] * (1 - tint) + (0 / 255) * tint;
      }
    }
    colors.needsUpdate = true;
  }
}

// =============================================
//  GREEDY OPTIMIZATION (with raycasting)
// =============================================

function viewshedForPosition(cx, cy, cz, excludeSet) {
  const visible = new Set();
  const range2 = state.visRange * state.visRange;
  const maxLookDown = -45 * Math.PI / 180;
  const maxLookUp = 30 * Math.PI / 180;
  const entries = [];

  for (let fi = 0; fi < faceData.length; fi++) {
    if (excludeSet && excludeSet.has(fi)) continue;
    const fc = faceData[fi].center;
    const dx = fc.x - cx, dz = fc.z - cz, dy = fc.y - cy;
    const dist2 = dx * dx + dz * dz + dy * dy;
    if (dist2 > range2) continue;
    const hDist = Math.sqrt(dx * dx + dz * dz);
    const elevAngle = Math.atan2(dy, hDist);
    if (elevAngle < maxLookDown || elevAngle > maxLookUp) continue;
    const azBin = ((Math.atan2(dz, dx) / Math.PI * 0.5 + 0.5) * AZIMUTH_BINS) | 0;
    entries.push({ fi, azBin: Math.min(azBin, AZIMUTH_BINS - 1), dist: Math.sqrt(dist2), elevAngle, area: faceData[fi].area });
  }

  entries.sort((a, b) => a.azBin - b.azBin || a.dist - b.dist);
  const horizon = new Float32Array(AZIMUTH_BINS).fill(maxLookDown);

  let totalNewArea = 0;
  for (const e of entries) {
    const bin = e.azBin;
    if (e.elevAngle > horizon[bin]) {
      visible.add(e.fi);
      totalNewArea += e.area;
      horizon[bin] = e.elevAngle;
    }
    if (bin > 0) horizon[bin - 1] = Math.max(horizon[bin - 1], e.elevAngle * 0.7);
    if (bin < AZIMUTH_BINS - 1) horizon[bin + 1] = Math.max(horizon[bin + 1], e.elevAngle * 0.7);
  }
  return { visible, totalNewArea };
}

async function optimizePlacement() {
  clearCameras();
  if (faceData.length === 0) return;

  // Fewer candidates for speed (100 instead of 300)
  const step = Math.max(1, Math.floor(faceData.length / 100));
  const candidates = [];
  for (let i = 0; i < faceData.length; i += step) {
    candidates.push(faceData[i].center.clone());
  }

  covDisplay.pct = 'Computing...';
  covDisplay.count = '';

  const globalCovered = new Set();

  for (let n = 0; n < state.numCameras; n++) {
    // Yield to UI between each camera placement
    await new Promise(r => setTimeout(r, 0));

    let bestScore = -1, bestIdx = -1;

    // Score candidates in batches to avoid freeze
    const batchSize = 20;
    for (let start = 0; start < candidates.length; start += batchSize) {
      const end = Math.min(start + batchSize, candidates.length);
      for (let ci = start; ci < end; ci++) {
        const c = candidates[ci];
        const { totalNewArea } = viewshedForPosition(c.x, c.y + 0.1, c.z, globalCovered);
        if (totalNewArea > bestScore) { bestScore = totalNewArea; bestIdx = ci; }
      }
      // Yield every batch
      if (end < candidates.length) await new Promise(r => setTimeout(r, 0));
    }

    if (bestIdx < 0 || bestScore <= 0) break;

    const pos = candidates[bestIdx].clone();
    addCamera(pos);
    covDisplay.pct = 'Camera ' + (n + 1) + '/' + state.numCameras + '...';

    const { visible } = viewshedForPosition(pos.x, pos.y + 0.1, pos.z, null);
    for (const fi of visible) globalCovered.add(fi);

    candidates.splice(bestIdx, 1);
  }
}

function updateCoverageDisplay(pct) {
  const el = document.getElementById('coverage-value');
  if (!el) return;
  el.textContent = pct.toFixed(1) + '%';
  el.style.color = pct < 20 ? 'var(--red-s)' : pct < 60 ? 'var(--yellow)' : 'var(--green)';
}

function clearCameras() {
  for (const m of cameraMarkers) { scene.remove(m); m.geometry.dispose(); }
  for (const m of surfaceMarkers) { scene.remove(m); m.geometry.dispose(); }
  for (const m of visMaxMarkers) { scene.remove(m); m.geometry.dispose(); }
  for (const l of verticalLines) { scene.remove(l); l.geometry.dispose(); }
  cameraMarkers = [];
  surfaceMarkers = [];
  visMaxMarkers = [];
  verticalLines = [];
  state.cameras = [];

  for (const mesh of reefMeshes) {
    const colors = mesh.geometry.attributes.color;
    const base = mesh.userData.baseColors;
    if (colors && base) { colors.array.set(base); colors.needsUpdate = true; }
  }
  covDisplay.pct = '0%';
  updateCoverageDisplay(0);
  updateAscentDisplay(0);
  updateUsefulDisplay(0);
  updateGsdDisplay(null);
  updateCameraCount();
}

// =============================================
//  ASCENT
// =============================================

function updateAscent() {
  // Markers move toward surface
  for (let i = 0; i < state.cameras.length; i++) {
    const cam = state.cameras[i];
    const surfY = meshYMax + 0.5;
    const newY = cam.anchorPos.y + (surfY - cam.anchorPos.y) * state.ascent + 0.08;
    cameraMarkers[i].position.set(cam.anchorPos.x, newY, cam.anchorPos.z);
  }
  computeCoverage();
}

// =============================================
//  GUI
// =============================================

// =============================================
//  AUTO DEMO (place random → optimize → clear → repeat)
// =============================================

let autoRunning = false;

async function startAutoDemo() {
  if (autoRunning || faceData.length === 0) return;
  autoRunning = true;

  while (autoRunning) {
    // Phase 1: place 3-6 random cameras
    const numRandom = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numRandom; i++) {
      const fi = Math.floor(Math.random() * faceData.length);
      addCamera(faceData[fi].center.clone());
      await new Promise(r => setTimeout(r, 600));
      if (!autoRunning) return;
    }

    // Wait
    await new Promise(r => setTimeout(r, 2000));
    if (!autoRunning) return;

    // Phase 2: clear and optimize
    clearCameras();
    await new Promise(r => setTimeout(r, 500));
    if (!autoRunning) return;

    const savedNum = state.numCameras;
    state.numCameras = numRandom;
    await optimizePlacement();
    state.numCameras = savedNum;
    if (!autoRunning) return;

    // Wait to show result
    await new Promise(r => setTimeout(r, 4000));
    if (!autoRunning) return;

    // Phase 3: clear and restart
    clearCameras();
    await new Promise(r => setTimeout(r, 1000));
  }
}

function stopAutoDemo() {
  autoRunning = false;
}

function setupGUI(container) {
  gui = new GUI({ title: t('covTitle'), width: 300, container });
  gui.domElement.style.position = 'absolute';
  gui.domElement.style.top = '60px';
  gui.domElement.style.right = '8px';

  const params = gui.addFolder(t('covCamera'));
  params.add(state, 'visRange', 0.5, 8, 0.1).name(t('covRange')).onChange(computeCoverage);
  params.add(state, 'sensorRes', 640, 4096, 1).name(t('covSensorRes')).onChange(computeCoverage);
  params.add(state, 'gsdMax', 1, 20, 0.5).name(t('covGsdMax')).onChange(computeCoverage);
  params.add(state, 'zExag', 1, 20, 0.5).name(t('covZExag')).onChange(v => {
    if (reefGroup) {
      reefGroup.scale.y = meshScale * v;
      reefGroup.updateMatrixWorld(true);
      precomputeFaces();
      computeCoverage();
    }
  });
  params.open();

  const contour = gui.addFolder(t('covContours'));
  contour.add(state, 'contourSteps', 2, 20, 1).name(t('covNbLines')).onChange(buildAllContourLines);
  contour.add(state, 'contourLevel', 0, 1, 0.01).name(t('covDepthSlider')).listen();
  contour.add({ toggle() {
    state.contourPlay = !state.contourPlay;
    // Reset all lines
    for (const cl of contourLines) { cl.subtle.visible = true; cl.bright.visible = false; }
    if (activeContourLine) {
      scene.remove(activeContourLine);
      activeContourLine.geometry.dispose();
      activeContourLine.material.dispose();
      activeContourLine = null;
    }
    lastActiveIdx = -1;
    state.contourLevel = 0;
  } }, 'toggle').name(t('covPlayPause'));
  contour.open();

  const optim = gui.addFolder(t('covOptim'));
  optim.add(state, 'numCameras', 1, 100, 1).name(t('covNbCam'));
  optim.add({ optimize() { stopAutoDemo(); optimizePlacement(); } }, 'optimize').name(t('covOptimize'));
  optim.add({ clear() { stopAutoDemo(); clearCameras(); } }, 'clear').name(t('covClear'));
  optim.open();

  // Mobile toggle button for GUI panel
  const toggleBar = document.createElement('div');
  toggleBar.className = 'cov-toggle-bar';
  toggleBar.style.cssText = 'display:none;position:absolute;bottom:12px;left:50%;transform:translateX(-50%);z-index:15';
  toggleBar.innerHTML = `<button class="sim-toggle-btn" id="cov-toggle-ctrl">${t('guiControls')}</button>`;
  container.appendChild(toggleBar);

  document.getElementById('cov-toggle-ctrl')?.addEventListener('click', (e) => {
    e.target.classList.toggle('active');
    gui.domElement.classList.toggle('show');
  });
}

export function rebuildCoverageI18n() {
  if (!renderer || !scene) return;
  const container = document.getElementById('tab-coverage');

  // Update topbar labels
  container.querySelectorAll('.cov-label').forEach((el, i) => {
    const keys = ['covCameras', 'covGround', 'covSurface', 'covGsdMean'];
    if (keys[i]) el.textContent = t(keys[i]);
  });
  container.querySelectorAll('.cov-stat').forEach((el, i) => {
    const keys = ['covTipCam', 'covTipGround', 'covTipSurface', 'covTipGsd'];
    if (keys[i]) el.dataset.tip = t(keys[i]);
  });

  // Rebuild GUI
  if (gui) {
    gui.destroy();
    setupGUI(container);
  }
}

export function updateCoverageTheme() {
  if (!renderer || !scene) return;
  const cc = getCoverageColors();
  renderer.setClearColor(cc.clearColor);
  scene.background.set(cc.bg);

  // Rebuild grid
  if (scene._grid) {
    scene.remove(scene._grid);
    scene._grid.geometry.dispose();
    const m = scene._grid.material;
    if (Array.isArray(m)) m.forEach(mat => mat.dispose());
    else m.dispose();
  }
  scene._grid = new THREE.GridHelper(20, 40, cc.grid1, cc.grid2);
  scene.add(scene._grid);

  // Repaint depth map vertex colors
  repaintDepthColors();

  // Rebuild contour lines with theme-appropriate colors
  buildAllContourLines();
}

function repaintDepthColors() {
  if (reefMeshes.length === 0) return;
  const v = new THREE.Vector3();
  for (const mesh of reefMeshes) {
    const pos = mesh.geometry.attributes.position;
    const colors = mesh.geometry.attributes.color;
    if (!pos || !colors) continue;
    mesh.updateMatrixWorld(true);
    const newBase = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const t = (v.y - meshYMin) / ((meshYMax - meshYMin) || 1);
      const [r, g, b] = depthColor(t);
      newBase[i * 3] = r; newBase[i * 3 + 1] = g; newBase[i * 3 + 2] = b;
    }
    mesh.userData.baseColors = newBase;
    colors.array.set(newBase);
    colors.needsUpdate = true;
  }
  // Re-apply coverage overlay if cameras are placed
  if (state.cameras.length > 0) computeCoverage();
}
