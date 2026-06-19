/**
 * KJMA anisotropic coral nucleation.
 * Port of colony.py: scatter seeds, compute attributes, KJMA assignment, deformation.
 */

/**
 * Simple seeded PRNG (xoshiro128** variant, good enough for our purposes).
 */
class Rng {
  constructor(seed = 42) {
    this.s = new Uint32Array(4);
    this.s[0] = seed;
    this.s[1] = seed ^ 0x9e3779b9;
    this.s[2] = seed ^ 0x6a09e667;
    this.s[3] = seed ^ 0xbb67ae85;
    // warm up
    for (let i = 0; i < 20; i++) this.next();
  }
  next() {
    const s = this.s;
    const result = (s[1] * 5) | 0;
    const t = s[1] << 9;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = (s[3] << 11) | (s[3] >>> 21);
    return (result >>> 0) / 4294967296;
  }
}

/**
 * Scatter seeds on the terrain based on depth zones.
 * Returns { positions: Float64Array(n*2), depths: Float64Array(n) }
 */
function scatterSeeds(heightmap, nx, ny, xMax, yMax, zones, rng, maxSeeds = 5000) {
  const allPx = [];
  const allPy = [];
  const allD = [];

  for (const zone of zones) {
    const [depthMin, depthMax] = zone.depth;
    const density = zone.density;
    if (density <= 0) continue;

    const nCandidates = Math.floor(xMax * yMax * density);
    for (let c = 0; c < nCandidates; c++) {
      const px = rng.next() * xMax;
      const py = rng.next() * yMax;
      const ix = Math.min(Math.floor((px / xMax) * (nx - 1)), nx - 1);
      const iy = Math.min(Math.floor((py / yMax) * (ny - 1)), ny - 1);
      const d = heightmap[iy * nx + ix];

      if (d >= depthMin && d <= depthMax) {
        allPx.push(px);
        allPy.push(py);
        allD.push(d);
      }
    }
  }

  // Limit seeds
  let n = allPx.length;
  if (n > maxSeeds) {
    // Random subsample
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(i);
    // Fisher-Yates partial shuffle
    for (let i = 0; i < maxSeeds; i++) {
      const j = i + Math.floor(rng.next() * (n - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const subPx = new Float64Array(maxSeeds);
    const subPy = new Float64Array(maxSeeds);
    const subD = new Float64Array(maxSeeds);
    for (let i = 0; i < maxSeeds; i++) {
      subPx[i] = allPx[idx[i]];
      subPy[i] = allPy[idx[i]];
      subD[i] = allD[idx[i]];
    }
    return { px: subPx, py: subPy, depths: subD, n: maxSeeds };
  }

  return {
    px: new Float64Array(allPx),
    py: new Float64Array(allPy),
    depths: new Float64Array(allD),
    n,
  };
}

/**
 * Compute surface normals for the heightmap grid.
 * Returns Float64Array(ny * nx * 3).
 */
function computeNormals(heightmap, xCoords, yCoords, nx, ny) {
  const dx = xCoords.length > 1 ? xCoords[1] - xCoords[0] : 1;
  const dy = yCoords.length > 1 ? yCoords[1] - yCoords[0] : 1;
  const normals = new Float64Array(ny * nx * 3);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const idx = j * nx + i;
      // dz/dx (central difference)
      const ip = Math.min(i + 1, nx - 1);
      const im = Math.max(i - 1, 0);
      const dzdx = (heightmap[j * nx + ip] - heightmap[j * nx + im]) / ((ip - im) * dx);

      // dz/dy
      const jp = Math.min(j + 1, ny - 1);
      const jm = Math.max(j - 1, 0);
      const dzdy = (heightmap[jp * nx + i] - heightmap[jm * nx + i]) / ((jp - jm) * dy);

      // Normal = (dzdx, dzdy, 1), normalized
      const len = Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1);
      normals[idx * 3 + 0] = dzdx / len;
      normals[idx * 3 + 1] = dzdy / len;
      normals[idx * 3 + 2] = 1 / len;
    }
  }
  return normals;
}

/**
 * Compute speed and direction for each seed.
 */
function computeSeedAttributes(seeds, terrain, config) {
  const { heightmap, xCoords, yCoords, nx, ny } = terrain;
  const xMax = xCoords[xCoords.length - 1];
  const yMax = yCoords[yCoords.length - 1];

  const normals = computeNormals(heightmap, xCoords, yCoords, nx, ny);

  const baseSpeed = config.baseSpeed || 1.0;
  const lightDecay = config.lightDecay || 0.05;
  const maxSlope = config.maxSlope || 70;
  const currentBoost = config.currentBoost || 1.5;
  const wGrav = config.wGravity || 1.0;
  const wLight = config.wLight || 0.5;
  const wCurrent = config.wCurrent || 0.3;
  const sunDir = config.sunDirection || [0, 0, 1];
  const currentDir = config.currentDirection || [1, 0, 0];

  const n = seeds.n;
  const speeds = new Float64Array(n);
  const directions = new Float64Array(n * 3);

  for (let i = 0; i < n; i++) {
    const ix = Math.min(Math.floor((seeds.px[i] / xMax) * (nx - 1)), nx - 1);
    const iy = Math.min(Math.floor((seeds.py[i] / yMax) * (ny - 1)), ny - 1);
    const nIdx = (iy * nx + ix) * 3;
    const nz = normals[nIdx + 2];

    const inclination = Math.acos(Math.max(-1, Math.min(1, nz))) * (180 / Math.PI);
    const light = Math.exp(-lightDecay * seeds.depths[i]);
    const slope = Math.max(0, 1 - inclination / maxSlope);

    // Current influence
    const nx2d = normals[nIdx + 0];
    const ny2d = normals[nIdx + 1];
    const dotCurrent = Math.abs(nx2d * currentDir[0] + ny2d * currentDir[1]);
    const current = 1 + (currentBoost - 1) * dotCurrent;

    speeds[i] = baseSpeed * light * slope * current;

    // Growth direction
    let dx = wGrav * 0 + wLight * sunDir[0] + wCurrent * currentDir[0];
    let dy = wGrav * 0 + wLight * sunDir[1] + wCurrent * currentDir[1];
    let dz = wGrav * 1 + wLight * sunDir[2] + wCurrent * currentDir[2];
    const dLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dLen > 1e-8) {
      directions[i * 3 + 0] = dx / dLen;
      directions[i * 3 + 1] = dy / dLen;
      directions[i * 3 + 2] = dz / dLen;
    } else {
      directions[i * 3 + 2] = 1;
    }
  }

  return { speeds, directions };
}

/**
 * KJMA assignment: for each mesh vertex, find the seed that arrives first.
 * Returns { winner, minTime, secondTime } (all n_verts length).
 */
function kjmaAssign(vertices, nVerts, seedPos3D, speeds, directions, nSeeds, anisotropy) {
  const winner = new Int32Array(nVerts);
  const minTime = new Float64Array(nVerts).fill(Infinity);
  const secondTime = new Float64Array(nVerts).fill(Infinity);

  // Process in chunks to avoid huge temporary arrays
  const CHUNK = 2000;

  for (let start = 0; start < nVerts; start += CHUNK) {
    const end = Math.min(start + CHUNK, nVerts);

    for (let vi = start; vi < end; vi++) {
      const vx = vertices[vi * 3 + 0];
      const vy = vertices[vi * 3 + 1];
      const vz = vertices[vi * 3 + 2];

      let best = Infinity, second = Infinity, bestIdx = 0;

      for (let si = 0; si < nSeeds; si++) {
        const dx = vx - seedPos3D[si * 3 + 0];
        const dy = vy - seedPos3D[si * 3 + 1];
        const dz = vz - seedPos3D[si * 3 + 2];

        // Along seed direction
        const dirX = directions[si * 3 + 0];
        const dirY = directions[si * 3 + 1];
        const dirZ = directions[si * 3 + 2];
        const along = dx * dirX + dy * dirY + dz * dirZ;

        // Perpendicular
        const px = dx - along * dirX;
        const py = dy - along * dirY;
        const pz = dz - along * dirZ;
        const perp = Math.sqrt(px * px + py * py + pz * pz);

        const sAlong = speeds[si] * anisotropy + 1e-10;
        const sPerp = speeds[si] + 1e-10;
        const t = Math.sqrt((along / sAlong) ** 2 + (perp / sPerp) ** 2);

        if (t < best) {
          second = best;
          best = t;
          bestIdx = si;
        } else if (t < second) {
          second = t;
        }
      }

      winner[vi] = bestIdx;
      minTime[vi] = best;
      secondTime[vi] = second;
    }
  }

  return { winner, minTime, secondTime };
}

/**
 * Deform mesh vertices based on KJMA result.
 * Modifies vertices in place.
 */
function deformMesh(vertices, vertexNormals, nVerts, winner, minTime, secondTime, speeds, config) {
  const maxHeight = config.maxHeight || 0.5;
  const boundarySharpness = config.boundarySharpness || 3.0;

  for (let i = 0; i < nVerts; i++) {
    const mt = minTime[i];
    const st = secondTime[i];
    const spd = speeds[winner[i]];

    if (mt > 1e10 || st < 1e-8 || spd < 1e-6) continue;

    const tNorm = mt / (st + 1e-10);
    const profile = Math.max(0, 1 - tNorm * tNorm);

    let height = maxHeight * profile * Math.min(spd, 3) / 3;

    // Boundary competition
    const dt = st - mt;
    const competition = 1 - Math.exp(-boundarySharpness * dt / (st + 1e-8));
    height *= competition;

    vertices[i * 3 + 0] += vertexNormals[i * 3 + 0] * height;
    vertices[i * 3 + 1] += vertexNormals[i * 3 + 1] * height;
    vertices[i * 3 + 2] += vertexNormals[i * 3 + 2] * height;
  }
}

/**
 * Build a triangulated mesh from a heightmap.
 * Returns { vertices: Float64Array(nVerts*3), faces: Uint32Array(nFaces*3), nVerts, nFaces }
 */
export function heightmapToMesh(heightmap, xCoords, yCoords, nx, ny) {
  const nVerts = nx * ny;
  const nFaces = (nx - 1) * (ny - 1) * 2;
  const vertices = new Float64Array(nVerts * 3);
  const faces = new Uint32Array(nFaces * 3);

  // Vertices
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const idx = j * nx + i;
      vertices[idx * 3 + 0] = xCoords[i];
      vertices[idx * 3 + 1] = yCoords[j];
      vertices[idx * 3 + 2] = -heightmap[idx]; // negative = underwater
    }
  }

  // Faces (two triangles per quad)
  let fi = 0;
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const idx = j * nx + i;
      faces[fi++] = idx;
      faces[fi++] = idx + nx;
      faces[fi++] = idx + 1;
      faces[fi++] = idx + 1;
      faces[fi++] = idx + nx;
      faces[fi++] = idx + nx + 1;
    }
  }

  return { vertices, faces, nVerts, nFaces };
}

/**
 * Compute vertex normals from mesh.
 */
function computeVertexNormals(vertices, faces, nVerts, nFaces) {
  const normals = new Float64Array(nVerts * 3);

  for (let fi = 0; fi < nFaces; fi++) {
    const i0 = faces[fi * 3 + 0];
    const i1 = faces[fi * 3 + 1];
    const i2 = faces[fi * 3 + 2];

    const ax = vertices[i1 * 3] - vertices[i0 * 3];
    const ay = vertices[i1 * 3 + 1] - vertices[i0 * 3 + 1];
    const az = vertices[i1 * 3 + 2] - vertices[i0 * 3 + 2];
    const bx = vertices[i2 * 3] - vertices[i0 * 3];
    const by = vertices[i2 * 3 + 1] - vertices[i0 * 3 + 1];
    const bz = vertices[i2 * 3 + 2] - vertices[i0 * 3 + 2];

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    for (const idx of [i0, i1, i2]) {
      normals[idx * 3 + 0] += nx;
      normals[idx * 3 + 1] += ny;
      normals[idx * 3 + 2] += nz;
    }
  }

  // Normalize
  for (let i = 0; i < nVerts; i++) {
    const x = normals[i * 3], y = normals[i * 3 + 1], z = normals[i * 3 + 2];
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    normals[i * 3] /= len;
    normals[i * 3 + 1] /= len;
    normals[i * 3 + 2] /= len;
  }

  return normals;
}

/**
 * Full KJMA pipeline: terrain -> mesh with coral nucleation.
 * Returns { vertices, faces, nVerts, nFaces }
 */
export function generateReef(terrain, config, onStatus) {
  const { heightmap, xCoords, yCoords, nx, ny } = terrain;
  const xMax = xCoords[xCoords.length - 1];
  const yMax = yCoords[yCoords.length - 1];

  const seed = config.seed || 42;
  const anisotropy = config.anisotropy || 2.0;
  const maxHeight = config.maxHeight || 0.5;
  const density = config.density || 0.004;
  const boundarySharpness = config.boundarySharpness || 3.0;

  const rng = new Rng(seed);

  // Placement zones
  const zones = [
    { depth: [0.5, 5], density: density * 1.25 },
    { depth: [5, 15], density: density * 0.75 },
    { depth: [15, 25], density: density * 0.25 },
  ];

  onStatus?.("Placing seeds...");
  const seeds = scatterSeeds(heightmap, nx, ny, xMax, yMax, zones, rng, 3000);
  onStatus?.(`${seeds.n} seeds placed`);

  if (seeds.n === 0) {
    onStatus?.("No seeds (no reef in the area?)");
    return heightmapToMesh(heightmap, xCoords, yCoords, nx, ny);
  }

  // Seed attributes
  onStatus?.("Computing attributes...");
  const kjmaConfig = {
    baseSpeed: 1.0,
    lightDecay: 0.05,
    maxSlope: 70,
    currentBoost: 1.5,
    wGravity: 1.0,
    wLight: 0.5,
    wCurrent: 0.3,
    sunDirection: [0, 0, 1],
    currentDirection: [1, 0, 0],
  };
  const { speeds, directions } = computeSeedAttributes(seeds, terrain, kjmaConfig);

  // Filter zero-speed seeds
  const alive = [];
  for (let i = 0; i < seeds.n; i++) {
    if (speeds[i] > 0.01) alive.push(i);
  }
  onStatus?.(`${alive.length} active seeds`);

  const nAlive = alive.length;
  const alivePx = new Float64Array(nAlive);
  const alivePy = new Float64Array(nAlive);
  const aliveDepths = new Float64Array(nAlive);
  const aliveSpeeds = new Float64Array(nAlive);
  const aliveDirections = new Float64Array(nAlive * 3);

  for (let i = 0; i < nAlive; i++) {
    const ai = alive[i];
    alivePx[i] = seeds.px[ai];
    alivePy[i] = seeds.py[ai];
    aliveDepths[i] = seeds.depths[ai];
    aliveSpeeds[i] = speeds[ai];
    aliveDirections[i * 3 + 0] = directions[ai * 3 + 0];
    aliveDirections[i * 3 + 1] = directions[ai * 3 + 1];
    aliveDirections[i * 3 + 2] = directions[ai * 3 + 2];
  }

  // Build mesh
  onStatus?.("Building mesh...");
  const mesh = heightmapToMesh(heightmap, xCoords, yCoords, nx, ny);

  // 3D seed positions
  const seedPos3D = new Float64Array(nAlive * 3);
  for (let i = 0; i < nAlive; i++) {
    const ix = Math.min(Math.floor((alivePx[i] / xMax) * (nx - 1)), nx - 1);
    const iy = Math.min(Math.floor((alivePy[i] / yMax) * (ny - 1)), ny - 1);
    seedPos3D[i * 3 + 0] = alivePx[i];
    seedPos3D[i * 3 + 1] = alivePy[i];
    seedPos3D[i * 3 + 2] = -heightmap[iy * nx + ix];
  }

  // KJMA assignment
  onStatus?.(`KJMA (${mesh.nVerts} vertices x ${nAlive} seeds)...`);
  const { winner, minTime, secondTime } = kjmaAssign(
    mesh.vertices, mesh.nVerts,
    seedPos3D, aliveSpeeds, aliveDirections, nAlive,
    anisotropy
  );

  // Deform
  onStatus?.("Deforming...");
  const vertexNormals = computeVertexNormals(mesh.vertices, mesh.faces, mesh.nVerts, mesh.nFaces);
  deformMesh(mesh.vertices, vertexNormals, mesh.nVerts, winner, minTime, secondTime, aliveSpeeds, {
    maxHeight,
    boundarySharpness,
  });

  onStatus?.(`Done: ${mesh.nVerts} vertices, ${mesh.nFaces} faces`);
  return mesh;
}
