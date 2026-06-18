// Physical constants
export const g = 9.81;
export const rhoW = 1025;       // seawater density kg/m3
export const rhoAir = 1.225;    // air density kg/m3
export const N = 24;            // number of cable segments

// Cable material library: density (kg/m3), ultimate tensile stress (Pa)
export const MAT = {
  poly:  { rho: 1380, sig: 250e6,  label: 'Polyester (1380 kg/m\u00b3)' },
  nylon: { rho: 1140, sig: 280e6,  label: 'Nylon (1140 kg/m\u00b3)' },
  dyn:   { rho: 975,  sig: 1500e6, label: 'Dyneema (975 \u2014 flotte)' },
  steel: { rho: 7850, sig: 1400e6, label: 'Acier (7850 kg/m\u00b3)' }
};

// Simulation parameters (mutable, shared across modules)
export const P = {
  // Deployment
  L: 5,                // current cable length (m)
  targetL: 5,          // target cable length (m)
  deploySpeed: 0.5,    // payout speed (m/s)

  // Environment
  cur: 0.6,            // surface current speed (m/s)
  curDir: 0,           // current direction (degrees, 0 = +X)
  prof: 'lin',         // current depth profile: lin, uni, surf
  wh: 1.2,             // significant wave height (m)
  wt: 7,               // wave period (s)
  wind: 5,             // wind speed (m/s)
  D: 30,               // site depth (m)

  // Cable
  dia: 10,             // diameter (mm)
  mat: 'poly',         // material key
  cdN: 1.2,            // normal drag coefficient
  cdT: 0.1,            // tangential drag coefficient

  // Device & floats
  dm: 18,              // device mass in air (kg)
  db: 80,              // device net buoyancy (N) — positive = floats up
  fn: 5,               // number of intermediate floats
  fb: 60,             // buoyancy per intermediate float (N)

  // Display toggles
  showForces: false,
  showVertRef: true,
  showCurrentGrid: true,
  paused: false
};

// Derived quantities
export function restLen() { return P.L / N; }
export function cableArea() { const d = P.dia / 1000; return Math.PI * d * d / 4; }
export function mbl() { return MAT[P.mat].sig * cableArea(); }
