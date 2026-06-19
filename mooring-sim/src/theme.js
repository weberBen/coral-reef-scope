const listeners = [];
let current = localStorage.getItem('rs-theme') || 'dark';

if (current === 'light') document.documentElement.classList.add('light-theme');

export function isDark() { return current === 'dark'; }
export function getTheme() { return current; }

export function toggleTheme() {
  current = current === 'dark' ? 'light' : 'dark';
  document.documentElement.classList.toggle('light-theme', current === 'light');
  localStorage.setItem('rs-theme', current);
  listeners.forEach(cb => cb(current));
}

export function onThemeChange(cb) {
  listeners.push(cb);
}

export function getSceneColors() {
  return current === 'dark' ? {
    clearColor: 0x030d1a,
    fogColor: 0x04182d,
    fogDensity: 0.012,
    bgStops: ['#1a3a5c', '#0a2240', '#051525', '#020a12'],
    waterDeep: [0.01, 0.05, 0.14],
    waterSurf: [0.08, 0.38, 0.58],
    waterHoriz: [0.15, 0.55, 0.72],
  } : {
    clearColor: 0x9ecfe8,
    fogColor: 0x80bdd8,
    fogDensity: 0.005,
    bgStops: ['#7ec8e3', '#93d1e8', '#a8dbee', '#c0e6f4'],
    waterDeep: [0.10, 0.38, 0.56],
    waterSurf: [0.25, 0.62, 0.80],
    waterHoriz: [0.45, 0.78, 0.90],
  };
}

export function getCoverageColors() {
  return current === 'dark' ? {
    clearColor: 0x060a12,
    bg: 0x060a12,
    grid1: 0x445566,
    grid2: 0x2a3a4a,
  } : {
    clearColor: 0xf0f4f8,
    bg: 0xf0f4f8,
    grid1: 0xcccccc,
    grid2: 0xe0e0e0,
  };
}
