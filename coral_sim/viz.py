"""Visualisation 3D interactive dans le navigateur (Three.js / WebGL).

Génère un fichier HTML standalone avec le mesh embarqué.

Usage standalone :
    python -m coral_sim.viz config.yaml
"""

from __future__ import annotations

import json
import webbrowser
from pathlib import Path
from typing import Any

import numpy as np

from .terrain.io import TerrainData, load_terrain

# Colormap "deep ocean" — du cyan clair (surface) au bleu nuit (profond)
_CMAP = [
    (0.0, [158, 230, 240]),
    (0.15, [80, 190, 210]),
    (0.35, [30, 140, 180]),
    (0.55, [15, 90, 150]),
    (0.75, [10, 55, 110]),
    (1.0, [5, 20, 60]),
]


def _depth_to_rgb(depth: np.ndarray) -> np.ndarray:
    """Mappe les profondeurs vers des couleurs RGB (0-255)."""
    d_min, d_max = depth.min(), max(depth.max(), depth.min() + 0.1)
    t = (depth - d_min) / (d_max - d_min)

    rgb = np.zeros((*t.shape, 3), dtype=np.float64)
    for i in range(len(_CMAP) - 1):
        t0, c0 = _CMAP[i]
        t1, c1 = _CMAP[i + 1]
        mask = (t >= t0) & (t <= t1)
        if not mask.any():
            continue
        frac = (t[mask] - t0) / (t1 - t0)
        for ch in range(3):
            rgb[mask, ch] = c0[ch] + frac * (c1[ch] - c0[ch])

    return np.clip(rgb, 0, 255).astype(np.uint8)


def _terrain_to_mesh_data(terrain: TerrainData, z_exag: float = 30.0) -> dict:
    """Convertit un TerrainData en vertices/faces/colors pour Three.js."""
    ny, nx = terrain.heightmap.shape
    x_grid, y_grid = np.meshgrid(terrain.x_coords, terrain.y_coords)
    z_grid = -terrain.heightmap * z_exag  # exagération verticale

    # Vertices : (ny*nx, 3)
    vertices = np.column_stack([
        x_grid.ravel(),
        z_grid.ravel(),   # Y = altitude dans Three.js (Y-up)
        y_grid.ravel(),
    ]).astype(np.float32)

    # Centrer le mesh
    center = vertices.mean(axis=0)
    vertices -= center

    # Faces : deux triangles par cellule de la grille
    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            idx = j * nx + i
            #  idx --- idx+1
            #   |  \    |
            #  idx+nx - idx+nx+1
            faces.append([idx, idx + nx, idx + 1])
            faces.append([idx + 1, idx + nx, idx + nx + 1])

    # Couleurs par vertex
    colors = _depth_to_rgb(terrain.heightmap.ravel())

    return {
        "vertices": vertices.ravel().tolist(),
        "faces": [int(x) for x in np.array(faces).ravel()],
        "colors": colors.ravel().tolist(),
        "stats": {
            "nx": nx,
            "ny": ny,
            "resolution": round(terrain.resolution, 1),
            "depth_min": round(float(terrain.heightmap.min()), 1),
            "depth_max": round(float(terrain.heightmap.max()), 1),
            "source": terrain.source,
        },
    }


def _generate_html(mesh_data: dict, config: dict[str, Any]) -> str:
    """Génère le HTML standalone avec Three.js."""
    bg = config.get("background", [10, 20, 40])
    bg_hex = f"#{bg[0]:02x}{bg[1]:02x}{bg[2]:02x}"
    stats = mesh_data["stats"]

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Coral Reef — {stats['source']}</title>
<style>
  body {{ margin: 0; overflow: hidden; background: {bg_hex}; }}
  canvas {{ display: block; }}
  #info {{
    position: absolute; top: 12px; left: 12px;
    color: #cde; font: 13px/1.5 monospace;
    background: rgba(0,0,0,0.5); padding: 8px 14px;
    border-radius: 6px; pointer-events: none;
  }}
  #info b {{ color: #7cf; }}
</style>
</head>
<body>
<div id="info">
  <b>{stats['source']}</b> | {stats['nx']}×{stats['ny']} px | {stats['resolution']} m/px<br>
  Depth: {stats['depth_min']} – {stats['depth_max']} m
</div>

<script type="importmap">
{{
  "imports": {{
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
  }}
}}
</script>

<script type="module">
import * as THREE from 'three';
import {{ OrbitControls }} from 'three/addons/controls/OrbitControls.js';

const meshData = {json.dumps(mesh_data, separators=(',', ':'))};

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('{bg_hex}');
scene.fog = new THREE.FogExp2('{bg_hex}', 0.00015);

// Camera
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 1, 50000);
camera.position.set(0, 800, 1500);

// Renderer
const renderer = new THREE.WebGLRenderer({{ antialias: true }});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.85;
controls.minDistance = 50;
controls.maxDistance = 15000;

// Build geometry
const geom = new THREE.BufferGeometry();
geom.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
geom.setIndex(meshData.faces);

const colorAttr = new Float32Array(meshData.colors.length);
for (let i = 0; i < meshData.colors.length; i++) colorAttr[i] = meshData.colors[i] / 255;
geom.setAttribute('color', new THREE.Float32BufferAttribute(colorAttr, 3));
geom.computeVertexNormals();

const material = new THREE.MeshPhongMaterial({{
  vertexColors: true,
  shininess: 15,
  side: THREE.DoubleSide,
  flatShading: false,
}});

const mesh = new THREE.Mesh(geom, material);
scene.add(mesh);

// Lights
const ambient = new THREE.AmbientLight(0x8899bb, 0.6);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
sun.position.set(500, 1500, 800);
scene.add(sun);

const fill = new THREE.DirectionalLight(0x6688aa, 0.4);
fill.position.set(-400, 300, -600);
scene.add(fill);

// Resize
addEventListener('resize', () => {{
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}});

// Animate
(function animate() {{
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}})();
</script>
</body>
</html>"""


def show_terrain(terrain: TerrainData, config: dict[str, Any] | None = None) -> Path:
    """Génère un HTML 3D interactif et l'ouvre dans le navigateur."""
    cfg = config or {}
    z_exag = cfg.get("z_exaggeration", 30.0)
    mesh_data = _terrain_to_mesh_data(terrain, z_exag=z_exag)
    html = _generate_html(mesh_data, cfg)

    output = Path(cfg.get("output_html", "reef_3d.html"))
    output.write_text(html)
    print(f"Visualisation → {output}")

    webbrowser.open(output.resolve().as_uri())
    return output


def show_mesh(path: Path, config: dict[str, Any] | None = None) -> Path:
    """Charge un mesh .glb et l'affiche en 3D dans le navigateur."""
    import trimesh

    cfg = config or {}
    loaded = trimesh.load(str(path))
    if isinstance(loaded, trimesh.Scene):
        meshes = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
        tm = trimesh.util.concatenate(meshes)
    else:
        tm = loaded

    # Convertir en TerrainData factice pour réutiliser le pipeline
    # (pour les .glb, on utilise directement les vertices/faces)
    verts = tm.vertices.astype(np.float32)
    center = verts.mean(axis=0)
    verts -= center

    depth = -verts[:, 1]  # Y-up → profondeur
    colors = _depth_to_rgb(depth)

    mesh_data = {
        "vertices": verts[:, [0, 1, 2]].ravel().tolist(),
        "faces": [int(x) for x in tm.faces.ravel()],
        "colors": colors.ravel().tolist(),
        "stats": {
            "nx": 0,
            "ny": 0,
            "resolution": 0,
            "depth_min": round(float(depth.min()), 1),
            "depth_max": round(float(depth.max()), 1),
            "source": "mesh",
        },
    }

    html = _generate_html(mesh_data, cfg)
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

    if input_path.suffix == ".npz":
        terrain = load_terrain(input_path)
        show_terrain(terrain, viz_cfg)
    elif input_path.suffix in (".glb", ".gltf"):
        show_mesh(input_path, viz_cfg)
    else:
        print(f"Format non supporté : {input_path.suffix}")
        sys.exit(1)
