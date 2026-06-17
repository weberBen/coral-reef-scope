import { g, rhoW, rhoAir, N, MAT, P, restLen, cableArea } from './params.js';

export let simTime = 0;
export const nodes = [];

// Per-node force breakdown (for visualization)
export const forces = []; // [{buoyancy, drag, wave, wind, total: {x,y,z}}]

// =============================================
//  INITIALIZATION
// =============================================

export function initNodes() {
  nodes.length = 0;
  forces.length = 0;
  const rl = restLen();
  for (let i = 0; i <= N; i++) {
    const y = -P.D + i * rl;
    const cy = Math.min(y, -0.2);
    nodes.push({ x: 0, y: cy, z: 0, px: 0, py: cy, pz: 0 });
    forces.push({ buoyancy: 0, drag: 0, wave: 0, wind: 0, total: { x: 0, y: 0, z: 0 } });
  }
  simTime = 0;
}

// =============================================
//  ENVIRONMENTAL FIELDS
// =============================================

export function currentAt(y) {
  const D = P.D;
  const f = Math.max(0, Math.min(1, (y + D) / D));
  let p;
  if (P.prof === 'lin') p = f;
  else if (P.prof === 'surf') p = f * f * f;
  else p = 1;
  let mag = P.cur * p;
  if (y > -2) mag += P.wind * 0.03 * (y + 2) / 2;
  const dir = P.curDir * Math.PI / 180;
  return { x: mag * Math.cos(dir), z: mag * Math.sin(dir) };
}

export function waveVel(x, y, z) {
  if (P.wh <= 0.01) return { x: 0, y: 0, z: 0 };
  const w = 2 * Math.PI / P.wt;
  const k = w * w / g;
  const a = P.wh / 2;
  const dir = P.curDir * Math.PI / 180;
  const ph = k * (x * Math.cos(dir) + z * Math.sin(dir)) - w * simTime;
  const decay = Math.exp(k * Math.max(y, -P.D));
  return {
    x: a * w * decay * Math.cos(ph) * Math.cos(dir),
    y: a * w * decay * Math.sin(ph),
    z: a * w * decay * Math.cos(ph) * Math.sin(dir)
  };
}

export function surfEta(x, z) {
  if (P.wh <= 0.01) return 0;
  const w = 2 * Math.PI / P.wt;
  const k = w * w / g;
  const dir = P.curDir * Math.PI / 180;
  return (P.wh / 2) * Math.sin(k * (x * Math.cos(dir) + z * Math.sin(dir)) - w * simTime);
}

// =============================================
//  FORCES (computed separately for visualization)
// =============================================

function computeForces() {
  const A = cableArea();
  const rl = restLen();
  const mat = MAT[P.mat];
  const dt = 1 / 60;
  const cableNetPerSeg = (rhoW - mat.rho) * A * rl * g;

  const floatNodes = new Set();
  for (let j = 1; j <= P.fn; j++) floatNodes.add(Math.round(j * N / (P.fn + 1)));

  for (let i = 0; i <= N; i++) {
    forces[i].buoyancy = 0;
    forces[i].drag = 0;
    forces[i].wave = 0;
    forces[i].wind = 0;
    forces[i].total.x = 0;
    forces[i].total.y = 0;
    forces[i].total.z = 0;
  }

  for (let i = 1; i <= N; i++) {
    const nd = nodes[i];
    let fx = 0, fy = 0, fz = 0;

    // --- Buoyancy (cable segment + float + device) ---
    let buoy = cableNetPerSeg;
    if (floatNodes.has(i)) buoy += P.fb;
    if (i === N) buoy += P.db;
    fy += buoy;
    forces[i].buoyancy = buoy;

    // --- Velocity ---
    const vx = (nd.x - nd.px) / dt;
    const vy = (nd.y - nd.py) / dt;
    const vz = (nd.z - nd.pz) / dt;

    // --- Water velocity ---
    const cur = currentAt(nd.y);
    const wav = waveVel(nd.x, nd.y, nd.z);

    // Relative velocity (water - node)
    const rx = cur.x + wav.x - vx;
    const ry = wav.y - vy;
    const rz = cur.z + wav.z - vz;

    // --- Tangent direction ---
    const a = nodes[Math.max(0, i - 1)];
    const b = nodes[Math.min(N, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;

    // --- Morison drag ---
    const vt = rx * tx + ry * ty + rz * tz;
    const nx = rx - vt * tx, ny = ry - vt * ty, nz = rz - vt * tz;
    const nm = Math.hypot(nx, ny, nz);
    const d = P.dia / 1000;
    const Ap = d * rl;
    const kn = 0.5 * rhoW * P.cdN * Ap * nm;
    const kt = 0.5 * rhoW * P.cdT * Math.PI * Ap * Math.abs(vt);
    const dragX = kn * nx + kt * vt * tx;
    const dragY = kn * ny + kt * vt * ty;
    const dragZ = kn * nz + kt * vt * tz;
    fx += dragX; fy += dragY; fz += dragZ;
    forces[i].drag = Math.hypot(dragX, dragY, dragZ);

    // --- Wave contribution magnitude ---
    forces[i].wave = Math.hypot(wav.x, wav.y, wav.z) * 0.5 * rhoW * P.cdN * Ap;

    // --- Wind on device near surface ---
    if (i === N && nd.y > -1) {
      const windDir = P.curDir * Math.PI / 180;
      const wf = 0.5 * rhoAir * 0.9 * 0.15 * P.wind * P.wind;
      const windX = wf * Math.cos(windDir);
      const windZ = wf * Math.sin(windDir);
      fx += windX; fz += windZ;
      forces[i].wind = Math.hypot(windX, windZ);
    }

    forces[i].total.x = fx;
    forces[i].total.y = fy;
    forces[i].total.z = fz;
  }
}

// =============================================
//  PHYSICS STEP (Verlet + PBD, cable never breaks)
// =============================================

export function physicsStep() {
  const dt = 1 / 60;
  const A = cableArea();
  const mat = MAT[P.mat];
  const rl = restLen();
  const mCab = Math.max(mat.rho * A * rl + rhoW * A * rl * 0.6, 0.05);

  // Compute forces (also fills forces[] for visualization)
  computeForces();

  // Smooth cable payout
  const maxChange = P.deploySpeed * dt;
  const prevL = P.L;
  P.L = Math.max(2, P.L + Math.max(-maxChange, Math.min(maxChange, P.targetL - P.L)));

  // Gentle redistribution: only nudge nodes that are badly out of order
  if (Math.abs(P.L - prevL) > 1e-6) {
    const newRL = P.L / N;
    for (let i = 1; i <= N; i++) {
      const targetY = -P.D + i * newRL;
      const clampedTarget = Math.min(targetY, -0.2);
      const error = clampedTarget - nodes[i].y;
      // Only assist if node is significantly below its expected position
      if (error > newRL * 0.5) {
        const blend = 0.05; // very gentle nudge
        nodes[i].y += error * blend;
        nodes[i].py += error * blend;
      }
    }
  }

  // Verlet integration (node 0 = anchor, pinned)
  const damp = 0.97;
  for (let i = 1; i <= N; i++) {
    const nd = nodes[i];
    const mi = i === N ? Math.max(P.dm, 1) : mCab;
    const f = forces[i].total;
    const ax = f.x / mi, ay = f.y / mi, az = f.z / mi;

    const nx = nd.x + (nd.x - nd.px) * damp + ax * dt * dt;
    const ny = nd.y + (nd.y - nd.py) * damp + ay * dt * dt;
    const nz = nd.z + (nd.z - nd.pz) * damp + az * dt * dt;

    nd.px = nd.x; nd.py = nd.y; nd.pz = nd.z;
    nd.x = nx; nd.y = ny; nd.z = nz;
  }

  // Pin anchor
  nodes[0].x = 0; nodes[0].y = -P.D; nodes[0].z = 0;

  // PBD distance constraints (cable inextensible, never breaks)
  const RL = restLen();
  for (let iter = 0; iter < 20; iter++) {
    for (let i = 0; i < N; i++) {
      const a = nodes[i], b = nodes[i + 1];
      let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      let l = Math.hypot(dx, dy, dz);

      if (l < 1e-4) {
        // Degenerate: push toward device, fallback vertical
        const dev = nodes[N];
        const toDx = dev.x - a.x, toDy = dev.y - a.y, toDz = dev.z - a.z;
        const toD = Math.hypot(toDx, toDy, toDz);
        if (toD > 1e-4) {
          dx = toDx / toD * RL; dy = toDy / toD * RL; dz = toDz / toD * RL;
        } else {
          dx = 0; dy = RL; dz = 0;
        }
        l = RL;
      }

      const corr = (l - RL) / l;
      if (i === 0) {
        b.x -= dx * corr; b.y -= dy * corr; b.z -= dz * corr;
      } else {
        a.x += dx * corr * 0.5; a.y += dy * corr * 0.5; a.z += dz * corr * 0.5;
        b.x -= dx * corr * 0.5; b.y -= dy * corr * 0.5; b.z -= dz * corr * 0.5;
      }
    }
    // Re-pin anchor
    nodes[0].x = 0; nodes[0].y = -P.D; nodes[0].z = 0;

    // Anti-fold: each node must be above the previous one
    for (let i = 1; i <= N; i++) {
      const minY = nodes[i - 1].y + RL * 0.05;
      if (nodes[i].y < minY) nodes[i].y = minY;
    }

    // Floor constraint
    for (let i = 1; i <= N; i++) {
      if (nodes[i].y < -P.D) nodes[i].y = -P.D;
    }

    // Surface constraint
    const eta = surfEta(nodes[N].x, nodes[N].z);
    if (nodes[N].y > eta) nodes[N].y = eta;
  }

  simTime += dt;
}

// =============================================
//  TENSION ANALYSIS
// =============================================

export function computeTensions() {
  // Use already-computed forces[]
  let cx = 0, cy = 0, cz = 0;
  const seg = new Array(N).fill(0);

  for (let i = N; i >= 1; i--) {
    cx += forces[i].total.x;
    cy += forces[i].total.y;
    cz += forces[i].total.z;
    seg[i - 1] = Math.hypot(cx, cy, cz);
  }

  const maxT = Math.max(...seg);
  return {
    seg,
    anchorV: cy,
    anchorH: Math.hypot(cx, cz),
    anchorT: Math.hypot(cx, cy, cz),
    maxT
  };
}

export function getMaxAngle() {
  // Angle of the enclosing cone: max horizontal excursion from anchor vertical axis
  const ax = nodes[0].x, az = nodes[0].z;
  let maxR = 0;
  for (let i = 1; i <= N; i++) {
    const r = Math.hypot(nodes[i].x - ax, nodes[i].z - az);
    if (r > maxR) maxR = r;
  }
  const height = Math.abs(nodes[N].y - nodes[0].y) || 1e-6;
  return Math.atan2(maxR, height) * 180 / Math.PI;
}
