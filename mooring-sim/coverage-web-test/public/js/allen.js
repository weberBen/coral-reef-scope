/**
 * Allen Coral Atlas WFS data fetching + rasterization.
 * Fetches geomorphic polygons via Bun proxy, rasterizes to depth grid.
 */

// Geomorphic zone -> approximate depth (m)
const GEOMORPHIC_DEPTH = {
  "Reef Slope": 25.0,
  "Sheltered Reef Slope": 12.0,
  "Back Reef Slope": 8.0,
  "Reef Crest": 0.1,
  "Outer Reef Flat": 0.4,
  "Inner Reef Flat": 0.7,
  "Terrestrial Reef Flat": 0.0,
  "Shallow Lagoon": 2.5,
  "Deep Lagoon": 18.0,
  "Plateau": 5.0,
  "Patch Reefs": 3.5,
};

/**
 * Fetch a WFS layer from Allen Coral Atlas via our proxy.
 */
async function fetchWfsLayer(typeName, bbox, onStatus) {
  const shortName = typeName.split(":")[1];
  onStatus?.(`Telechargement ${shortName}...`);

  const params = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    bbox: bbox.join(","),
    maxFeatures: "50000",
  });

  const resp = await fetch(`/api/wfs?${params}`);
  if (!resp.ok) throw new Error(`WFS ${resp.status}: ${resp.statusText}`);
  const data = await resp.json();
  const n = data.features?.length || 0;
  onStatus?.(`${shortName}: ${n} polygones`);
  return data;
}

/**
 * Parse a GeoJSON polygon/multipolygon into arrays of rings.
 * Each ring is [[lon, lat], ...].
 */
function extractRings(geometry) {
  const rings = [];
  if (geometry.type === "Polygon") {
    rings.push(geometry.coordinates[0]); // outer ring
  } else if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates) {
      rings.push(poly[0]); // outer ring of each polygon
    }
  }
  return rings;
}

/**
 * Point-in-polygon test (ray casting algorithm).
 */
function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Rasterize geomorphic polygons to a depth grid.
 * Returns { grid: Float64Array, nx, ny }
 */
function rasterize(geojson, bbox, nx, ny) {
  const [lonMin, latMin, lonMax, latMax] = bbox;
  const grid = new Float64Array(ny * nx); // row-major

  // Prepare features with depth + precomputed bounding boxes
  const features = [];
  for (const f of geojson.features || []) {
    const name = f.properties?.class_name || "";
    const depth = GEOMORPHIC_DEPTH[name];
    if (depth === undefined) continue;

    const rings = extractRings(f.geometry);
    for (const ring of rings) {
      // Bounding box of ring for quick rejection
      let rMinX = Infinity, rMinY = Infinity, rMaxX = -Infinity, rMaxY = -Infinity;
      for (const [x, y] of ring) {
        if (x < rMinX) rMinX = x;
        if (y < rMinY) rMinY = y;
        if (x > rMaxX) rMaxX = x;
        if (y > rMaxY) rMaxY = y;
      }
      features.push({ ring, depth, rMinX, rMinY, rMaxX, rMaxY });
    }
  }

  const dLon = (lonMax - lonMin) / nx;
  const dLat = (latMax - latMin) / ny;

  for (let j = 0; j < ny; j++) {
    const lat = latMax - (j + 0.5) * dLat; // top to bottom
    for (let i = 0; i < nx; i++) {
      const lon = lonMin + (i + 0.5) * dLon;

      // Check each feature (last match wins)
      for (const f of features) {
        if (lon < f.rMinX || lon > f.rMaxX || lat < f.rMinY || lat > f.rMaxY) continue;
        if (pointInRing(lon, lat, f.ring)) {
          grid[j * nx + i] = f.depth;
        }
      }
    }
  }

  return grid;
}

/**
 * Simple gaussian blur on a grid (separable, sigma=2).
 */
function gaussianBlur(grid, nx, ny, sigma = 2) {
  const radius = Math.ceil(sigma * 3);
  const kernel = new Float64Array(2 * radius + 1);
  let sum = 0;
  for (let k = -radius; k <= radius; k++) {
    kernel[k + radius] = Math.exp(-(k * k) / (2 * sigma * sigma));
    sum += kernel[k + radius];
  }
  for (let k = 0; k < kernel.length; k++) kernel[k] /= sum;

  const temp = new Float64Array(ny * nx);
  const out = new Float64Array(ny * nx);

  // Horizontal pass
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let v = 0;
      for (let k = -radius; k <= radius; k++) {
        const ci = Math.max(0, Math.min(nx - 1, i + k));
        v += grid[j * nx + ci] * kernel[k + radius];
      }
      temp[j * nx + i] = v;
    }
  }

  // Vertical pass
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let v = 0;
      for (let k = -radius; k <= radius; k++) {
        const cj = Math.max(0, Math.min(ny - 1, j + k));
        v += temp[cj * nx + i] * kernel[k + radius];
      }
      out[j * nx + i] = v;
    }
  }

  return out;
}

/**
 * Main: fetch Allen data + rasterize to depth grid.
 * Returns { heightmap, nx, ny, xCoords, yCoords, resolution, bbox, nFeatures }
 */
export async function fetchAllenTerrain(bbox, resolutionDeg, onStatus) {
  // 1. Fetch geomorphic layer
  const geoJson = await fetchWfsLayer(
    "coral-atlas:geomorphic_data_verbose",
    bbox,
    onStatus
  );

  // Also fetch benthic (for info, not used in depth)
  let benthicCount = 0;
  try {
    const benJson = await fetchWfsLayer(
      "coral-atlas:benthic_data_verbose",
      bbox,
      onStatus
    );
    benthicCount = benJson.features?.length || 0;
  } catch {
    // benthic is optional
  }

  const [lonMin, latMin, lonMax, latMax] = bbox;
  const nx = Math.round((lonMax - lonMin) / resolutionDeg);
  const ny = Math.round((latMax - latMin) / resolutionDeg);

  onStatus?.(`Rasterisation (${nx} x ${ny})...`);

  // 2. Rasterize
  let grid = rasterize(geoJson, bbox, nx, ny);

  // 3. Gaussian blur
  grid = gaussianBlur(grid, nx, ny, 2.0);

  // 4. Compute metric coordinates
  const latCenter = (latMin + latMax) / 2;
  const mPerDegLon = 111320 * Math.cos((latCenter * Math.PI) / 180);
  const mPerDegLat = 111320;

  const xCoords = new Float64Array(nx);
  const yCoords = new Float64Array(ny);
  const xExtent = (lonMax - lonMin) * mPerDegLon;
  const yExtent = (latMax - latMin) * mPerDegLat;

  for (let i = 0; i < nx; i++) xCoords[i] = (i / (nx - 1)) * xExtent;
  for (let j = 0; j < ny; j++) yCoords[j] = (j / (ny - 1)) * yExtent;

  const nFeatures = geoJson.features?.length || 0;
  onStatus?.(`OK: ${nFeatures} geo + ${benthicCount} benthic polygones`);

  return {
    heightmap: grid,
    nx,
    ny,
    xCoords,
    yCoords,
    resolution: resolutionDeg * mPerDegLon,
    bbox,
    nFeatures,
    xExtent,
    yExtent,
  };
}
