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
    clearColor: 0xc5dff0,
    fogColor: 0x90c8e0,
    fogDensity: 0.005,
    bgStops: ['#87ceeb', '#a4d4e4', '#bde0ef', '#ddf0fa'],
    waterDeep: [0.06, 0.30, 0.50],
    waterSurf: [0.18, 0.58, 0.76],
    waterHoriz: [0.40, 0.75, 0.88],
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
