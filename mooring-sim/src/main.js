import './style.css';
import { P } from './params.js';
import { initNodes, physicsStep, computeTensions } from './physics.js';
import { initScene, handleResize } from './scene.js';
import { MooringObjects } from './objects.js';
import { setupGUI, updateReadouts } from './ui.js';
import { exportOBJ } from './export.js';
import { initTabs, onTabChange } from './tabs.js';
import { buildPresentation } from './presentation.js';
import { initCoverage } from './coverage.js';

// ---------- Initialize ----------

initTabs();
buildPresentation();

// Lazy-init coverage when tab becomes visible
let coverageLoaded = false;
onTabChange((tab) => {
  if (tab === 'coverage' && !coverageLoaded) {
    coverageLoaded = true;
    initCoverage();
  }
});
initNodes();

const { scene, camera, renderer, controls, causticLight } = initScene();
const objects = new MooringObjects(scene);

const callbacks = {
  onDepthChange() {
    initNodes();
    objects.updateDepth();
    controls.target.set(0, -P.D / 2, 0);
  },
  onReset() {
    initNodes();
  },
  onExport() {
    const group = objects.buildExportGeometry();
    exportOBJ(group);
    group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }
};

setupGUI(callbacks);

// ---------- Animation loop ----------

let lastTime = performance.now();
let accumulator = 0;
const FIXED_DT = 1 / 60;

function animate(now) {
  requestAnimationFrame(animate);

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;

  while (accumulator >= FIXED_DT) {
    if (!P.paused) {
      physicsStep();
    }
    accumulator -= FIXED_DT;
  }

  const tensions = computeTensions();
  objects.update(tensions);
  updateReadouts(tensions);

  // Animate caustic light (subtle underwater shimmer)
  const t = now * 0.001;
  causticLight.position.set(
    Math.sin(t * 0.3) * 5,
    -2 + Math.sin(t * 0.5) * 1,
    Math.cos(t * 0.4) * 5
  );
  causticLight.intensity = 0.6 + Math.sin(t * 1.2) * 0.2;

  controls.update();
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

window.addEventListener('resize', () => handleResize(camera, renderer));
