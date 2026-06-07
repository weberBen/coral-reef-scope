"""Visualisation 3D interactive dans le navigateur via Viser.

Serveur Python → WebSocket → navigateur (Three.js intégré).
Supporte mesh OBJ/GLB/GLTF, dossiers, et TerrainData (.npz).

Usage :
    python -m coral_sim.viz config.yaml
    python -m coral_sim.viz mon_recif.obj
    python -m coral_sim.viz dossier_infinigen/
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import trimesh
import viser

from .terrain.io import TerrainData, load_terrain


# ── Chargement de meshes ──────────────────────────────────────────────────────


def _load_mesh_from_path(path: Path) -> trimesh.Trimesh:
    """Charge un mesh depuis un fichier ou un dossier."""
    path = Path(path)

    if path.is_dir():
        mesh_files = (
            list(path.rglob("*.obj"))
            + list(path.rglob("*.glb"))
            + list(path.rglob("*.gltf"))
            + list(path.rglob("*.ply"))
            + list(path.rglob("*.stl"))
        )
        if not mesh_files:
            raise FileNotFoundError(f"Aucun mesh trouvé dans {path}")
        print(f"Chargement de {len(mesh_files)} mesh(es) depuis {path}")
        meshes = []
        for mf in mesh_files:
            try:
                loaded = trimesh.load(str(mf), force="mesh")
                if isinstance(loaded, trimesh.Trimesh):
                    meshes.append(loaded)
            except Exception as e:
                print(f"  Ignoré {mf.name}: {e}")
        return trimesh.util.concatenate(meshes)
    else:
        print(f"Chargement mesh : {path}")
        loaded = trimesh.load(str(path))
        if isinstance(loaded, trimesh.Scene):
            parts = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
            return trimesh.util.concatenate(parts)
        return loaded


def _terrain_to_trimesh(terrain: TerrainData, z_exag: float = 1.0) -> trimesh.Trimesh:
    """Convertit un TerrainData en trimesh."""
    ny, nx = terrain.heightmap.shape
    x_grid, y_grid = np.meshgrid(terrain.x_coords, terrain.y_coords)
    z_grid = -terrain.heightmap * z_exag

    vertices = np.column_stack([
        x_grid.ravel(), y_grid.ravel(), z_grid.ravel()
    ])

    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            idx = j * nx + i
            faces.append([idx, idx + nx, idx + 1])
            faces.append([idx + 1, idx + nx, idx + nx + 1])

    return trimesh.Trimesh(vertices=vertices, faces=np.array(faces))


# ── Colormap profondeur ───────────────────────────────────────────────────────

_DEPTH_CMAP = [
    (0.0, [158, 230, 240]),
    (0.15, [80, 190, 210]),
    (0.35, [30, 140, 180]),
    (0.55, [15, 90, 150]),
    (0.75, [10, 55, 110]),
    (1.0, [5, 20, 60]),
]


def _depth_colors(vertices: np.ndarray) -> np.ndarray:
    """Génère des couleurs RGBA par vertex selon la profondeur (Z)."""
    z = vertices[:, 2]
    z_min, z_max = z.min(), max(z.max(), z.min() + 0.1)
    t = (z - z_min) / (z_max - z_min)

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

    rgba = np.zeros((len(t), 4), dtype=np.uint8)
    rgba[:, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    rgba[:, 3] = 255
    return rgba


# ── Serveur Viser ─────────────────────────────────────────────────────────────


def serve(mesh: trimesh.Trimesh, config: dict[str, Any] | None = None):
    """Lance le serveur Viser avec le mesh affiché."""
    cfg = config or {}
    port = cfg.get("port", 8080)

    # Décimation si trop lourd
    max_faces = cfg.get("max_viz_faces", 500_000)
    if len(mesh.faces) > max_faces:
        ratio = 1.0 - max_faces / len(mesh.faces)
        print(f"Décimation {len(mesh.faces):,} → ~{max_faces:,} faces…")
        mesh = mesh.simplify_quadric_decimation(ratio)

    print(f"Mesh : {len(mesh.vertices):,} sommets · {len(mesh.faces):,} faces")

    # Centrer le mesh
    center = mesh.vertices.mean(axis=0)
    mesh.vertices -= center

    # Couleurs par profondeur → dans le mesh
    mesh.visual.vertex_colors = _depth_colors(mesh.vertices)

    server = viser.ViserServer(host="0.0.0.0", port=port)

    # Ajouter le récif
    server.scene.add_mesh_trimesh("reef", mesh)

    # Grille de référence
    server.scene.add_grid("grid", width=float(mesh.extents[0]), height=float(mesh.extents[1]))

    # GUI
    with server.gui.add_folder("Display"):
        wireframe_toggle = server.gui.add_checkbox("Wireframe", initial_value=False)

    with server.gui.add_folder("Info"):
        server.gui.add_text("Vertices", initial_value=f"{len(mesh.vertices):,}")
        server.gui.add_text("Faces", initial_value=f"{len(mesh.faces):,}")
        z = mesh.vertices[:, 2]
        server.gui.add_text("Depth range", initial_value=f"{-z.max():.1f} – {-z.min():.1f} m")

    print(f"\nServeur Viser → http://localhost:{port}")
    print("Ctrl+C pour arrêter\n")

    # Bloquer
    try:
        while True:
            import time
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")


# ── Point d'entrée ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    from .terrain import load_config, resolve_path

    if len(sys.argv) < 2:
        print("Usage: python -m coral_sim.viz <config.yaml | fichier.obj | dossier/>")
        sys.exit(1)

    arg = sys.argv[1]

    if arg.endswith(".yaml") or arg.endswith(".yml"):
        config = load_config(arg)
        viz_cfg = config.get("viz", {})
        input_path = resolve_path(config, viz_cfg.get("input", "terrain.npz"))
    else:
        input_path = Path(arg)
        viz_cfg = {}

    if input_path.suffix == ".npz":
        terrain = load_terrain(input_path)
        z_exag = viz_cfg.get("z_exaggeration", 1.0)
        mesh = _terrain_to_trimesh(terrain, z_exag)
        serve(mesh, viz_cfg)
    elif input_path.suffix in (".obj", ".glb", ".gltf", ".ply", ".stl") or input_path.is_dir():
        mesh = _load_mesh_from_path(input_path)
        serve(mesh, viz_cfg)
    else:
        print(f"Format non supporté : {input_path}")
        sys.exit(1)
