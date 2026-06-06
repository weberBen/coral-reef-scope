"""Visualisation 3D interactive de la depth map dans le navigateur (Three.js).

Surface 3D du fond récifal avec contour lines, couleurs par profondeur /
géomorphologie / habitat benthique, et panneau de contrôle lil-gui.

Usage standalone :
    python -m coral_sim.viz config.yaml
"""

from __future__ import annotations

import json
import webbrowser
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from shapely.geometry import shape
from skimage.measure import find_contours

from .terrain.io import TerrainData, load_terrain

# ── Couleurs par classe ───────────────────────────────────────────────────────

GEOMORPHIC_COLORS = {
    "Reef Slope": [26, 58, 92],
    "Sheltered Reef Slope": [42, 90, 124],
    "Back Reef Slope": [58, 106, 140],
    "Reef Crest": [0, 229, 255],
    "Outer Reef Flat": [77, 208, 225],
    "Inner Reef Flat": [128, 222, 234],
    "Terrestrial Reef Flat": [165, 214, 167],
    "Shallow Lagoon": [79, 195, 247],
    "Deep Lagoon": [13, 71, 161],
    "Plateau": [92, 107, 192],
    "Patch Reefs": [38, 166, 154],
}

BENTHIC_COLORS = {
    "Sand": [240, 220, 168],
    "Rubble": [184, 160, 138],
    "Rock": [138, 138, 138],
    "Coral/Algae": [0, 200, 83],
    "Microalgal Mats": [100, 181, 74],
    "Seagrass": [27, 138, 27],
}

# Gradient de profondeur (cyan → bleu nuit)
_DEPTH_CMAP = [
    (0.0, [158, 230, 240]),
    (0.15, [80, 190, 210]),
    (0.35, [30, 140, 180]),
    (0.55, [15, 90, 150]),
    (0.75, [10, 55, 110]),
    (1.0, [5, 20, 60]),
]


# ── Rastérisation GeoJSON → grille de couleurs ───────────────────────────────


def _rasterize_geojson_colors(
    geojson: dict | None,
    color_map: dict[str, list[int]],
    terrain: TerrainData,
) -> np.ndarray:
    """Rastérise un GeoJSON Allen sur la grille du heightmap → RGB par pixel."""
    ny, nx = terrain.heightmap.shape
    colors = np.full((ny * nx, 3), 40, dtype=np.uint8)  # gris foncé par défaut

    if geojson is None:
        return colors

    bbox = terrain.metadata.get("bbox")
    if bbox is None:
        return colors

    lon_min, lat_min, lon_max, lat_max = bbox
    resolution = terrain.metadata.get("resolution_deg", 0.0003)

    geoms, vals = [], []
    for f in geojson.get("features", []):
        name = f["properties"].get("class_name", "")
        rgb = color_map.get(name)
        if rgb is None:
            continue
        try:
            g = shape(f["geometry"])
            if g.is_valid and not g.is_empty:
                geoms.append(g)
                vals.append(rgb)
        except Exception:
            continue

    if not geoms:
        return colors

    lons = np.linspace(lon_min + resolution / 2, lon_max - resolution / 2, nx)
    lats = np.linspace(lat_max - resolution / 2, lat_min + resolution / 2, ny)
    lon_grid, lat_grid = np.meshgrid(lons, lats)
    pts = shapely.points(lon_grid.ravel(), lat_grid.ravel())

    tree = shapely.STRtree(geoms)
    pt_idx, geom_idx = tree.query(pts, predicate="intersects")

    for pi, gi in zip(pt_idx, geom_idx):
        colors[pi] = vals[gi]

    return colors


def _depth_to_rgb(depth: np.ndarray) -> np.ndarray:
    """Gradient de profondeur → RGB."""
    d_min, d_max = depth.min(), max(depth.max(), depth.min() + 0.1)
    t = (depth - d_min) / (d_max - d_min)

    rgb = np.zeros((len(t), 3), dtype=np.float64)
    for i in range(len(_DEPTH_CMAP) - 1):
        t0, c0 = _DEPTH_CMAP[i]
        t1, c1 = _DEPTH_CMAP[i + 1]
        mask = (t >= t0) & (t <= t1)
        if not mask.any():
            continue
        frac = (t[mask] - t0) / (t1 - t0)
        for ch in range(3):
            rgb[mask, ch] = c0[ch] + frac * (c1[ch] - c0[ch])

    return np.clip(rgb, 0, 255).astype(np.uint8)


# ── Contour lines en 3D ──────────────────────────────────────────────────────


def _compute_contours_3d(
    terrain: TerrainData, interval: float, z_exag: float
) -> list[dict]:
    """Calcule les isolines en coordonnées 3D (sur la surface du mesh)."""
    ny, nx = terrain.heightmap.shape
    contours_data = []
    levels = np.arange(interval, terrain.heightmap.max() + 0.01, interval)

    for level in levels:
        contour_list = find_contours(terrain.heightmap, level)
        for contour in contour_list:
            if len(contour) < 3:
                continue
            # contour[:,0]=row, contour[:,1]=col → coordonnées mesh
            x = contour[:, 1] / (nx - 1) * terrain.x_coords[-1]
            z = contour[:, 0] / (ny - 1) * terrain.y_coords[-1]
            # Profondeur constante le long de l'isoline
            y = np.full_like(x, -level * z_exag)
            positions = []
            for xi, yi, zi in zip(x, y, z):
                positions.extend([float(xi), float(yi), float(zi)])
            contours_data.append({
                "positions": positions,
                "depth": round(float(level), 1),
            })

    return contours_data


# ── Construction des données mesh ─────────────────────────────────────────────


def _build_mesh_data(terrain: TerrainData, config: dict[str, Any]) -> dict:
    """Prépare toutes les données pour le HTML Three.js."""
    z_exag = config.get("z_exaggeration", 30.0)
    interval = config.get("contour_interval", 2.0)

    ny, nx = terrain.heightmap.shape
    x_grid, y_grid = np.meshgrid(terrain.x_coords, terrain.y_coords)
    z_grid = -terrain.heightmap * z_exag

    # Vertices (x, y_up, z_forward)
    vertices = np.column_stack([
        x_grid.ravel(), z_grid.ravel(), y_grid.ravel()
    ]).astype(np.float32)
    center = vertices.mean(axis=0)
    vertices -= center

    # Faces
    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            idx = j * nx + i
            faces.append([idx, idx + nx, idx + 1])
            faces.append([idx + 1, idx + nx, idx + nx + 1])

    # 3 jeux de couleurs
    colors_depth = _depth_to_rgb(terrain.heightmap.ravel())
    colors_geo = _rasterize_geojson_colors(
        terrain.geomorphic_geojson, GEOMORPHIC_COLORS, terrain
    )
    colors_ben = _rasterize_geojson_colors(
        terrain.benthic_geojson, BENTHIC_COLORS, terrain
    )

    # Contour lines en 3D (décalées du même centre)
    contours = _compute_contours_3d(terrain, interval, z_exag)
    for c in contours:
        pos = c["positions"]
        for i in range(0, len(pos), 3):
            pos[i] -= float(center[0])
            pos[i + 1] -= float(center[1])
            pos[i + 2] -= float(center[2])

    # Légendes
    geo_legend = [
        {"name": n, "color": f"rgb({c[0]},{c[1]},{c[2]})"}
        for n, c in GEOMORPHIC_COLORS.items()
    ]
    ben_legend = [
        {"name": n, "color": f"rgb({c[0]},{c[1]},{c[2]})"}
        for n, c in BENTHIC_COLORS.items()
    ]

    return {
        "vertices": vertices.ravel().tolist(),
        "faces": [int(x) for x in np.array(faces).ravel()],
        "colors_depth": colors_depth.ravel().tolist(),
        "colors_geo": colors_geo.ravel().tolist(),
        "colors_ben": colors_ben.ravel().tolist(),
        "contours": contours,
        "geo_legend": geo_legend,
        "ben_legend": ben_legend,
        "stats": {
            "nx": nx, "ny": ny,
            "resolution": round(terrain.resolution, 1),
            "depth_min": round(float(terrain.heightmap.min()), 1),
            "depth_max": round(float(terrain.heightmap.max()), 1),
            "source": terrain.source,
            "z_exag": z_exag,
        },
    }


# ── HTML Three.js ─────────────────────────────────────────────────────────────


def _generate_html(data: dict) -> str:
    stats = data["stats"]
    data_json = json.dumps(data, separators=(",", ":"))

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Coral Reef — {stats['source']}</title>
<style>
  body {{ margin:0; overflow:hidden; background:#0a1428; font-family:system-ui,sans-serif; }}
  canvas {{ display:block; }}
  #info {{
    position:absolute; top:12px; left:12px;
    color:#cde; font-size:12px; line-height:1.5;
    background:rgba(10,20,40,0.85); padding:10px 14px;
    border-radius:8px; pointer-events:none;
  }}
  #info b {{ color:#7cf; }}
  #legend {{
    position:absolute; bottom:12px; left:12px;
    color:#aab; font-size:11px; line-height:1.7;
    background:rgba(10,20,40,0.85); padding:10px 14px;
    border-radius:8px; pointer-events:none;
    max-height:40vh; overflow-y:auto;
  }}
  #legend .title {{ color:#7cf; font-weight:600; margin-bottom:4px; font-size:12px; }}
  #legend .item {{ display:flex; align-items:center; gap:6px; }}
  #legend .sw {{ width:12px; height:12px; border-radius:2px; flex-shrink:0; }}
  #depth-info {{
    position:absolute; bottom:12px; right:12px;
    color:#fff; font-size:14px; font-weight:600;
    background:rgba(10,20,40,0.85); padding:8px 14px;
    border-radius:8px; pointer-events:none;
  }}
</style>
</head>
<body>
<div id="info">
  <b>{stats['source']}</b> | {stats['nx']}×{stats['ny']} px | {stats['resolution']} m/px<br>
  Depth: {stats['depth_min']} – {stats['depth_max']} m | Z ×{stats['z_exag']}
</div>
<div id="legend"></div>
<div id="depth-info"></div>

<script type="importmap">
{{
  "imports": {{
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/",
    "lil-gui": "https://cdn.jsdelivr.net/npm/lil-gui@0.20.0/dist/lil-gui.esm.min.js"
  }}
}}
</script>

<script type="module">
import * as THREE from 'three';
import {{ OrbitControls }} from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

const D = {data_json};

// ── Scene ──
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a1428');
scene.fog = new THREE.FogExp2('#0a1428', 0.00012);

const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 1, 80000);
camera.position.set(0, 1200, 2500);

const renderer = new THREE.WebGLRenderer({{ antialias: true }});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.85;

// ── Mesh ──
const geom = new THREE.BufferGeometry();
geom.setAttribute('position', new THREE.Float32BufferAttribute(D.vertices, 3));
geom.setIndex(D.faces);

// Préparer les 3 jeux de couleurs
function makeColorAttr(arr) {{
  const a = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) a[i] = arr[i] / 255;
  return new THREE.Float32BufferAttribute(a, 3);
}}
const colorsDepth = makeColorAttr(D.colors_depth);
const colorsGeo = makeColorAttr(D.colors_geo);
const colorsBen = makeColorAttr(D.colors_ben);

geom.setAttribute('color', colorsDepth);
geom.computeVertexNormals();

// Custom uniforms for hover contour
const hoverUniforms = {{
  uHoverY: {{ value: -99999.0 }},
  uLineWidth: {{ value: 8.0 }},
  uLineColor: {{ value: new THREE.Color(1.0, 1.0, 1.0) }},
}};

const mat = new THREE.MeshPhongMaterial({{
  vertexColors: true, shininess: 15, side: THREE.DoubleSide, flatShading: false
}});

// Inject hover contour line into Phong shader
mat.onBeforeCompile = (shader) => {{
  shader.uniforms.uHoverY = hoverUniforms.uHoverY;
  shader.uniforms.uLineWidth = hoverUniforms.uLineWidth;
  shader.uniforms.uLineColor = hoverUniforms.uLineColor;

  // Add varying to vertex shader
  shader.vertexShader = 'varying float vWorldY;\\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;'
  );

  // Add contour line to fragment shader
  shader.fragmentShader = `
    varying float vWorldY;
    uniform float uHoverY;
    uniform float uLineWidth;
    uniform vec3 uLineColor;
  ` + shader.fragmentShader;

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <dithering_fragment>',
    `#include <dithering_fragment>
    float dist = abs(vWorldY - uHoverY);
    float line = 1.0 - smoothstep(0.0, uLineWidth, dist);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uLineColor, line * 0.85);`
  );
}};

const mesh = new THREE.Mesh(geom, mat);
scene.add(mesh);

// ── Contour lines ──
const contourGroup = new THREE.Group();
scene.add(contourGroup);

for (const c of D.contours) {{
  const pts = [];
  for (let i = 0; i < c.positions.length; i += 3)
    pts.push(new THREE.Vector3(c.positions[i], c.positions[i+1], c.positions[i+2]));
  const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
  const lineMat = new THREE.LineBasicMaterial({{ color: 0xffffff, opacity: 0.35, transparent: true }});
  contourGroup.add(new THREE.Line(lineGeom, lineMat));
}}

// ── Lights ──
scene.add(new THREE.AmbientLight(0x8899bb, 0.6));
const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
sun.position.set(500, 1500, 800);
scene.add(sun);
scene.add(new THREE.DirectionalLight(0x6688aa, 0.4).translateX(-400).translateY(300).translateZ(-600));

// ── GUI ──
const params = {{
  colorMode: 'depth',
  contours: true,
  wireframe: false,
  hoverLineWidth: 8.0,
}};

function setColors(mode) {{
  const attr = mode === 'geomorphic' ? colorsGeo : mode === 'benthic' ? colorsBen : colorsDepth;
  geom.setAttribute('color', attr);
  geom.attributes.color.needsUpdate = true;
  updateLegend(mode);
}}

const gui = new GUI({{ title: 'Controls' }});
gui.add(params, 'colorMode', ['depth', 'geomorphic', 'benthic']).name('Color mode').onChange(setColors);
gui.add(params, 'contours').name('Contour lines').onChange(v => contourGroup.visible = v);
gui.add(params, 'wireframe').name('Wireframe').onChange(v => mat.wireframe = v);
gui.add(params, 'hoverLineWidth', 1, 30, 1).name('Hover line width').onChange(v => hoverUniforms.uLineWidth.value = v);

// ── Legend ──
const legendEl = document.getElementById('legend');
function updateLegend(mode) {{
  if (mode === 'depth') {{
    legendEl.innerHTML = '<div class="title">Depth</div>' +
      '<div class="item"><span class="sw" style="background:rgb(158,230,240)"></span>0 m (surface)</div>' +
      '<div class="item"><span class="sw" style="background:rgb(30,140,180)"></span>~10 m</div>' +
      '<div class="item"><span class="sw" style="background:rgb(5,20,60)"></span>{stats['depth_max']} m</div>';
  }} else {{
    const items = mode === 'geomorphic' ? D.geo_legend : D.ben_legend;
    const title = mode === 'geomorphic' ? 'Geomorphic' : 'Benthic';
    legendEl.innerHTML = '<div class="title">' + title + '</div>' +
      items.map(i => '<div class="item"><span class="sw" style="background:'+i.color+'"></span>'+i.name+'</div>').join('');
  }}
}}
updateLegend('depth');

// ── Hover depth ──
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const depthInfo = document.getElementById('depth-info');

renderer.domElement.addEventListener('mousemove', (e) => {{
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
}});

// ── Resize ──
addEventListener('resize', () => {{
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}});

// ── Animate ──
let frame = 0;
(function animate() {{
  requestAnimationFrame(animate);
  controls.update();

  // Raycast every 3 frames for perf
  if (frame++ % 3 === 0) {{
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(mesh);
    if (hits.length > 0) {{
      const y = hits[0].point.y;
      const depth = (-y / {stats['z_exag']}).toFixed(1);
      depthInfo.textContent = depth + ' m';
      // Drive the hover contour line
      hoverUniforms.uHoverY.value = y;
    }} else {{
      depthInfo.textContent = '';
      hoverUniforms.uHoverY.value = -99999.0;
    }}
  }}

  renderer.render(scene, camera);
}})();
</script>
</body>
</html>"""


# ── API publique ──────────────────────────────────────────────────────────────


def show_terrain(terrain: TerrainData, config: dict[str, Any] | None = None) -> Path:
    """Génère un HTML 3D et l'ouvre dans le navigateur."""
    cfg = config or {}
    data = _build_mesh_data(terrain, cfg)
    html = _generate_html(data)

    output = Path(cfg.get("output_html", "reef_3d.html"))
    output.write_text(html)
    print(f"Visualisation → {output}")

    webbrowser.open(output.resolve().as_uri())
    return output


# ── Exécution standalone ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    from .terrain import load_config, resolve_path

    if len(sys.argv) < 2:
        print("Usage: python -m coral_sim.viz <config.yaml>")
        sys.exit(1)

    config = load_config(sys.argv[1])
    viz_cfg = config.get("viz", {})
    input_path = resolve_path(config, viz_cfg.get("input", "terrain.npz"))

    terrain = load_terrain(input_path)
    show_terrain(terrain, viz_cfg)
