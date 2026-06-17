import GUI from 'lil-gui';
import { P, N, mbl } from './params.js';
import { nodes, forces, getMaxAngle } from './physics.js';

export function setupGUI(callbacks) {
  const container = document.getElementById('tab-simulation');
  const gui = new GUI({ title: 'Parametres', width: 310, container });
  gui.domElement.style.position = 'absolute';
  gui.domElement.style.bottom = '8px';
  gui.domElement.style.right = '8px';

  // --- Deployment ---
  const deploy = gui.addFolder('Deroulement');
  deploy.add(P, 'targetL', 2, 60, 0.5).name('Cable cible (m)').listen();
  deploy.add(P, 'deploySpeed', 0.1, 3, 0.1).name('Vitesse (m/s)');
  deploy.add({
    deployMax() { P.targetL = Math.min(P.D + 2, 60); }
  }, 'deployMax').name('Deployer max ▲');
  deploy.add({
    retract() { P.targetL = 2; }
  }, 'retract').name('Rembobiner tout ▼');
  deploy.add({
    lock() {
      P.targetL = P.L;
      console.log(`Bloque a L=${P.L.toFixed(1)}m`);
    }
  }, 'lock').name('Bloquer ⏸');
  deploy.open();

  // --- Environment ---
  const env = gui.addFolder('Environnement');
  env.add(P, 'cur', 0, 2.5, 0.05).name('Courant surface (m/s)');
  env.add(P, 'curDir', 0, 360, 5).name('Direction courant (°)');
  env.add(P, 'prof', {
    'Lineaire (→0 au fond)': 'lin',
    'Uniforme': 'uni',
    'Concentre en surface': 'surf'
  }).name('Profil courant');
  env.add(P, 'wh', 0, 4, 0.1).name('Houle hauteur (m)');
  env.add(P, 'wt', 3, 14, 0.5).name('Houle periode (s)');
  env.add(P, 'wind', 0, 25, 1).name('Vent surface (m/s)');
  env.add(P, 'D', 10, 60, 1).name('Profondeur site (m)').onChange(callbacks.onDepthChange);
  env.close();

  // --- Cable ---
  const cable = gui.addFolder('Cable');
  cable.add(P, 'dia', 3, 24, 0.5).name('Diametre (mm)');
  cable.add(P, 'mat', {
    'Polyester (1380)': 'poly',
    'Nylon (1140)': 'nylon',
    'Dyneema (975)': 'dyn',
    'Acier (7850)': 'steel'
  }).name('Materiau');
  cable.add(P, 'cdN', 0.5, 2.0, 0.05).name('Cd normal');
  cable.add(P, 'cdT', 0.01, 0.3, 0.01).name('Cd tangentiel');
  cable.close();

  // --- Device & floats ---
  const device = gui.addFolder('Dispositif & Flotteurs');
  device.add(P, 'dm', 2, 60, 1).name('Masse dispositif (kg)');
  device.add(P, 'db', 10, 400, 5).name('Flottabilite nette (N)');
  device.add(P, 'fn', 0, 8, 1).name('Nb flotteurs intermed.');
  device.add(P, 'fb', 10, 200, 5).name('Flottabilite/flotteur (N)');
  device.open();

  // --- Display ---
  const display = gui.addFolder('Affichage');
  display.add(P, 'showForces').name('Fleches de force');
  display.add(P, 'showVertRef').name('Ligne verticale ref.');
  display.add(P, 'showCurrentGrid').name('Fleches de courant');
  display.add({ exportOBJ: callbacks.onExport }, 'exportOBJ').name('Exporter OBJ');
  display.close();

  // --- Actions ---
  const actions = gui.addFolder('Actions');
  actions.add(P, 'paused').name('Pause');
  actions.add({ reset: callbacks.onReset }, 'reset').name('Reinitialiser');
  actions.close();

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
  setText('ro-speed', deploying ? P.deploySpeed.toFixed(1) + ' m/s' : 'arret');

  // Status badge (cable never breaks — just warn on low safety factor)
  const status = document.getElementById('status');
  if (sf < 2) {
    status.className = 'status warn';
    status.textContent = 'ATTENTION — securite faible';
  } else {
    status.className = 'status ok';
    status.textContent = 'OK';
  }

  // Large angle display
  const angleEl = document.getElementById('angle-value');
  if (angleEl) {
    angleEl.textContent = maxAng.toFixed(1) + '\u00b0';
    angleEl.className = 'angle-value ' + (maxAng < 5 ? 'good' : maxAng < 15 ? 'medium' : 'bad');
  }
}
