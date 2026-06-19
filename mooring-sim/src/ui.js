import GUI from 'lil-gui';
import { P, N, mbl } from './params.js';
import { nodes, forces, getMaxAngle } from './physics.js';
import { t } from './i18n.js';

let currentGui = null;

export function rebuildSimGUI(callbacks) {
  if (currentGui) {
    currentGui.destroy();
    document.querySelector('#tab-simulation .sim-toggle-bar')?.remove();
  }
  return setupGUI(callbacks);
}

export function setupGUI(callbacks) {
  const container = document.getElementById('tab-simulation');
  const gui = new GUI({ title: t('guiParams'), width: 310, container });
  gui.domElement.style.position = 'absolute';
  gui.domElement.style.bottom = '8px';
  gui.domElement.style.right = '8px';

  // --- Deployment ---
  const deploy = gui.addFolder(t('guiDeploy'));
  deploy.add(P, 'targetL', 2, 60, 0.5).name(t('guiTargetL')).listen();
  deploy.add(P, 'deploySpeed', 0.1, 3, 0.1).name(t('guiDeploySpeed'));
  deploy.add({
    deployMax() { P.targetL = Math.min(P.D + 2, 60); }
  }, 'deployMax').name(t('guiDeployMax'));
  deploy.add({
    retract() { P.targetL = 2; }
  }, 'retract').name(t('guiRetract'));
  deploy.add({
    lock() {
      P.targetL = P.L;
      console.log(`Bloque a L=${P.L.toFixed(1)}m`);
    }
  }, 'lock').name(t('guiLock'));
  deploy.open();

  // --- Environment ---
  const env = gui.addFolder(t('guiEnv'));
  env.add(P, 'cur', 0, 2.5, 0.05).name(t('guiCurrent'));
  env.add(P, 'curDir', 0, 360, 5).name(t('guiCurrentDir'));
  env.add(P, 'prof', {
    [t('guiProfileLin')]: 'lin',
    [t('guiProfileUni')]: 'uni',
    [t('guiProfileSurf')]: 'surf'
  }).name(t('guiCurrentProfile'));
  env.add(P, 'wh', 0, 4, 0.1).name(t('guiWaveH'));
  env.add(P, 'wt', 3, 14, 0.5).name(t('guiWaveT'));
  env.add(P, 'wind', 0, 25, 1).name(t('guiWind'));
  env.add(P, 'D', 10, 60, 1).name(t('guiDepth')).onChange(callbacks.onDepthChange);
  env.close();

  // --- Cable ---
  const cable = gui.addFolder(t('guiCable'));
  cable.add(P, 'dia', 3, 24, 0.5).name(t('guiDia'));
  cable.add(P, 'mat', {
    'Polyester (1380)': 'poly',
    'Nylon (1140)': 'nylon',
    'Dyneema (975)': 'dyn',
    'Acier (7850)': 'steel'
  }).name(t('guiMat'));
  cable.add(P, 'cdN', 0.5, 2.0, 0.05).name(t('guiCdN'));
  cable.add(P, 'cdT', 0.01, 0.3, 0.01).name(t('guiCdT'));
  cable.close();

  // --- Device & floats ---
  const device = gui.addFolder(t('guiDevice'));
  device.add(P, 'dm', 2, 60, 1).name(t('guiMass'));
  device.add(P, 'db', 10, 400, 5).name(t('guiBuoyancy'));
  device.add(P, 'fn', 0, 8, 1).name(t('guiFloatN'));
  device.add(P, 'fb', 10, 200, 5).name(t('guiFloatB'));
  device.open();

  // --- Display ---
  const display = gui.addFolder(t('guiDisplay'));
  display.add(P, 'showForces').name(t('guiForces'));
  display.add(P, 'showVertRef').name(t('guiVertRef'));
  display.add(P, 'showCurrentGrid').name(t('guiCurrentGrid'));
  display.add({ exportOBJ: callbacks.onExport }, 'exportOBJ').name(t('guiExport'));
  display.close();

  // --- Actions ---
  const actions = gui.addFolder(t('guiActions'));
  actions.add(P, 'paused').name(t('guiPause'));
  actions.add({ reset: callbacks.onReset }, 'reset').name(t('guiReset'));
  actions.close();

  // --- Mobile toggle bar ---
  const toggleBar = document.createElement('div');
  toggleBar.className = 'sim-toggle-bar';
  toggleBar.innerHTML = `
    <button class="sim-toggle-btn" data-panel="readouts">${t('guiData')}</button>
    <button class="sim-toggle-btn" data-panel="angle">${t('guiAngle')}</button>
    <button class="sim-toggle-btn" data-panel="gui">${t('guiControls')}</button>
  `;
  container.appendChild(toggleBar);

  toggleBar.querySelectorAll('.sim-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      btn.classList.toggle('active');
      if (panel === 'readouts') document.getElementById('readouts')?.classList.toggle('show');
      if (panel === 'angle') document.getElementById('angle-display')?.classList.toggle('show');
      if (panel === 'gui') {
        gui.domElement.classList.toggle('show');
        if (gui.domElement.classList.contains('show')) deploy.open();
      }
    });
  });

  // --- Auto demo loop (mobile) ---
  const isMobile = window.innerWidth <= 900;
  if (isMobile) {
    // Close all folders except deploy
    env.close(); cable.close(); device.close(); display.close(); actions.close();
  }

  // Auto loop: deploy → wait → retract → wait → repeat
  let autoPhase = 'deploy';
  let autoTimer = 0;
  const SURFACE_WAIT = 3; // seconds at surface before retract

  setInterval(() => {
    if (P.paused) return;
    const atTarget = Math.abs(P.L - P.targetL) < 0.5;
    const atSurface = nodes[N] && nodes[N].y > -1;
    const atBottom = P.L <= 3;

    if (autoPhase === 'deploy') {
      if (!atTarget) return; // still deploying
      if (atSurface) {
        autoPhase = 'wait-surface';
        autoTimer = 0;
      }
    } else if (autoPhase === 'wait-surface') {
      autoTimer += 0.1;
      if (autoTimer >= SURFACE_WAIT) {
        P.targetL = 2;
        autoPhase = 'retract';
      }
    } else if (autoPhase === 'retract') {
      if (atBottom) {
        autoPhase = 'wait-bottom';
        autoTimer = 0;
      }
    } else if (autoPhase === 'wait-bottom') {
      autoTimer += 0.1;
      if (autoTimer >= 2) {
        P.targetL = Math.min(P.D + 2, 60);
        autoPhase = 'deploy';
      }
    }
  }, 100);

  // Start with deploy
  P.targetL = Math.min(P.D + 2, 60);

  currentGui = gui;
  return gui;
}

// === Readout updates ===

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export function updateReadouts(tensions) {
  const dv = nodes[N];
  const dep = Math.max(0, -dv.y);
  const hgt = dv.y + P.D;
  const exc = Math.hypot(dv.x, dv.z);
  const maxAng = getMaxAngle();
  const M = mbl();
  const sf = tensions.maxT > 1 ? M / tensions.maxT : 99;

  setText('ro-depth', dep.toFixed(1) + ' m');
  setText('ro-h', hgt.toFixed(1) + ' m');
  setText('ro-exc', exc.toFixed(2) + ' m');
  setText('ro-ang', maxAng.toFixed(0) + '\u00b0');
  setText('ro-tmax', Math.round(tensions.maxT) + ' N');
  setText('ro-av', Math.round(tensions.anchorV) + ' N');
  setText('ro-ah', Math.round(tensions.anchorH) + ' N');
  setText('ro-at', Math.round(tensions.anchorT) + ' N');
  setText('ro-mbl', Math.round(M) + ' N');
  setText('ro-sf', sf >= 99 ? '\u2014' : sf.toFixed(2) + ' x');
  setText('ro-cable', P.L.toFixed(1) + ' m');

  const deploying = Math.abs(P.targetL - P.L) > 0.1;
  setText('ro-speed', deploying ? P.deploySpeed.toFixed(1) + ' m/s' : t('simSpeedStop'));

  // Status badge (cable never breaks — just warn on low safety factor)
  const status = document.getElementById('status');
  if (sf < 2) {
    status.className = 'status warn';
    status.textContent = t('simStatusWarn');
  } else {
    status.className = 'status ok';
    status.textContent = t('simStatusOk');
  }

  // Large angle display
  const angleEl = document.getElementById('angle-value');
  if (angleEl) {
    angleEl.textContent = maxAng.toFixed(1) + '\u00b0';
    angleEl.className = 'angle-value ' + (maxAng < 5 ? 'good' : maxAng < 15 ? 'medium' : 'bad');
  }
}
