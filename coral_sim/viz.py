"""Visualisation 3D interactive du terrain et du récif.

Usage standalone :
    python -m coral_sim.viz config.yaml
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pyvista as pv

from .terrain.io import TerrainData, load_terrain


def terrain_to_polydata(terrain: TerrainData) -> pv.PolyData:
    """Convertit un TerrainData en mesh PyVista triangulé."""
    ny, nx = terrain.heightmap.shape
    x_grid, y_grid = np.meshgrid(terrain.x_coords, terrain.y_coords)

    # Z négatif (profondeur sous la surface)
    z_grid = -terrain.heightmap

    grid = pv.StructuredGrid(x_grid, y_grid, z_grid)
    mesh = grid.extract_surface()
    mesh["depth"] = terrain.heightmap.ravel()
    return mesh


def show_terrain(terrain: TerrainData, config: dict[str, Any] | None = None) -> None:
    """Affiche le terrain en 3D interactif."""
    cfg = config or {}
    cmap = cfg.get("colormap", "deep")
    bg = cfg.get("background", [10, 20, 40])

    mesh = terrain_to_polydata(terrain)

    pl = pv.Plotter()
    pl.set_background(bg)
    pl.add_mesh(
        mesh,
        scalars="depth",
        cmap=cmap,
        scalar_bar_args={"title": "Profondeur (m)"},
        lighting=True,
    )
    pl.add_text(
        f"Récif — {terrain.source}\n"
        f"{terrain.heightmap.shape[1]}×{terrain.heightmap.shape[0]} px  "
        f"| {terrain.resolution:.0f} m/px",
        font_size=10,
        position="upper_left",
    )
    pl.show()


def show_mesh(path: Path, config: dict[str, Any] | None = None) -> None:
    """Affiche un mesh .glb en 3D interactif."""
    import trimesh

    cfg = config or {}
    bg = cfg.get("background", [10, 20, 40])

    loaded = trimesh.load(str(path))
    if isinstance(loaded, trimesh.Scene):
        meshes = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
        tm = trimesh.util.concatenate(meshes)
    else:
        tm = loaded

    # Conversion trimesh → pyvista
    faces = np.column_stack([np.full(len(tm.faces), 3), tm.faces]).ravel()
    pv_mesh = pv.PolyData(tm.vertices, faces)
    pv_mesh["depth"] = -tm.vertices[:, 2]

    pl = pv.Plotter()
    pl.set_background(bg)
    pl.add_mesh(
        pv_mesh,
        scalars="depth",
        cmap=cfg.get("colormap", "deep"),
        scalar_bar_args={"title": "Profondeur (m)"},
        lighting=True,
    )
    pl.show()


# ── Exécution standalone ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    from .terrain import load_config

    if len(sys.argv) < 2:
        print("Usage: python -m coral_sim.viz <config.yaml>")
        sys.exit(1)

    config = load_config(sys.argv[1])
    viz_cfg = config.get("viz", {})
    input_path = Path(viz_cfg.get("input", "terrain.npz"))

    if input_path.suffix == ".npz":
        terrain = load_terrain(input_path)
        show_terrain(terrain, viz_cfg)
    elif input_path.suffix in (".glb", ".gltf"):
        show_mesh(input_path, viz_cfg)
    else:
        print(f"Format non supporté : {input_path.suffix}")
        sys.exit(1)
