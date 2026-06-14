"""Chargement et affichage d'un système d'amarrage (format MoorDyn).

Lit un fichier .dat MoorDyn, résout l'équilibre statique via MoorPy,
et affiche le résultat dans Viser sur le terrain.

Usage standalone :
    python -m coral_sim.mooring config.yaml
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import moorpy as mp


def load_mooring(filepath: str | Path) -> mp.System:
    """Charge un système d'amarrage depuis un fichier MoorDyn."""
    filepath = Path(filepath)
    print(f"Chargement mooring : {filepath}")
    system = mp.System(file=str(filepath))
    print(f"  {len(system.pointList)} points, {len(system.lineList)} lignes")
    return system


def solve_equilibrium(system: mp.System) -> None:
    """Résout l'équilibre statique du système."""
    print("  Résolution équilibre statique…", end=" ", flush=True)
    system.initialize()
    system.solveEquilibrium()
    print("OK")


def get_viz_data(system: mp.System) -> dict:
    """Extrait les données de visualisation depuis MoorPy.

    Retourne un dict avec :
      - points: list of {id, type, position, mass, volume}
      - lines: list of {id, type, positions_3d}
    """
    points = []
    for i, point in enumerate(system.pointList):
        pos = point.r.copy()  # [x, y, z]
        points.append({
            "id": i + 1,
            "type": "fixed" if point.type == 1 else "free",
            "position": pos,
            "mass": getattr(point, "m", 0),
            "volume": getattr(point, "v", 0),
        })

    lines = []
    for i, line in enumerate(system.lineList):
        Xs, Ys, Zs, Ts = line.getLineCoords(0)
        positions = np.column_stack([Xs, Ys, Zs])
        line_type = line.type.get("name", "unknown") if isinstance(line.type, dict) else str(line.type)
        lines.append({
            "id": i + 1,
            "type": line_type,
            "positions": positions,
        })

    return {"points": points, "lines": lines}


def add_mooring_to_viser(server, viz_data: dict, norm_scale: float, center: np.ndarray) -> list:
    """Ajoute le système d'amarrage à une scène Viser.

    Les coordonnées sont transformées pour matcher le mesh terrain
    (même normalisation et centrage).

    Retourne la liste des handles Viser pour le toggle.
    """
    handles = []

    def transform(pos: np.ndarray) -> np.ndarray:
        """Convertit les coordonnées réelles → coordonnées Viser normalisées."""
        p = pos.copy().astype(float)
        p[:2] -= center[:2]
        p *= norm_scale
        return p

    # Dessiner les lignes (câbles/chaînes)
    for line in viz_data["lines"]:
        pts = np.array([transform(p) for p in line["positions"]], dtype=np.float32)
        if len(pts) < 2:
            continue
        h = server.scene.add_spline_catmull_rom(
            f"mooring/line_{line['id']}",
            positions=pts,
            color=(255, 200, 50),  # jaune pour les câbles
            line_width=3.0,
        )
        handles.append(h)

    # Dessiner les points (ancrages = rouge, bouées = vert, autres = blanc)
    for point in viz_data["points"]:
        pos = transform(point["position"])
        if point["type"] == "fixed":
            color = (255, 50, 50)      # rouge = ancrage
            label = f"Anchor {point['id']}"
        else:
            color = (50, 255, 50)      # vert = bouée/free
            label = f"Buoy {point['id']}"

        h = server.scene.add_label(
            f"mooring/point_{point['id']}",
            text=label,
            wxyz=(1, 0, 0, 0),
            position=tuple(pos),
        )
        handles.append(h)

    return handles


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    import time

    import trimesh
    import viser

    from .terrain import load_config, resolve_path
    from .terrain.io import load_terrain
    from .viz import _terrain_to_trimesh, _depth_colors

    if len(sys.argv) < 2:
        print("Usage: python -m coral_sim.mooring <config.yaml>")
        sys.exit(1)

    config = load_config(sys.argv[1])
    viz_cfg = config.get("viz", {})
    mooring_cfg = config.get("mooring", {})

    # Charger le terrain
    terrain_path = resolve_path(config, viz_cfg.get("input", "terrain.npz"))
    if terrain_path.suffix == ".npz":
        terrain = load_terrain(terrain_path)
        mesh = _terrain_to_trimesh(terrain, z_exag=1.0)
    else:
        loaded = trimesh.load(str(terrain_path))
        if isinstance(loaded, trimesh.Scene):
            mesh = trimesh.util.concatenate(list(loaded.geometry.values()))
        else:
            mesh = loaded

    # Charger le mooring
    mooring_file = resolve_path(config, mooring_cfg.get("file", "mooring.dat"))
    system = load_mooring(mooring_file)
    solve_equilibrium(system)
    viz_data = get_viz_data(system)

    # Préparer la normalisation (même que viz.py)
    original_verts = mesh.vertices.copy()
    center = original_verts.mean(axis=0)
    original_verts -= center
    xy_extent = max(
        original_verts[:, 0].max() - original_verts[:, 0].min(),
        original_verts[:, 1].max() - original_verts[:, 1].min(),
    )
    norm_scale = 10.0 / xy_extent if xy_extent > 0 else 1.0

    z_exag = viz_cfg.get("z_exaggeration", 5.0)
    original_verts[:, 2] *= z_exag

    # Double-sided mesh
    faces_orig = mesh.faces.copy()
    faces_flipped = faces_orig[:, ::-1] + len(original_verts)
    all_verts = np.vstack([original_verts, original_verts])
    all_faces = np.vstack([faces_orig, faces_flipped])
    base_colors = _depth_colors(original_verts)
    all_colors = np.vstack([base_colors, base_colors])

    display_mesh = trimesh.Trimesh(vertices=all_verts, faces=all_faces)
    display_mesh.visual.vertex_colors = all_colors
    display_mesh.fix_normals()

    # Serveur Viser
    port = viz_cfg.get("port", 8080)
    server = viser.ViserServer(host="0.0.0.0", port=port)

    bg_img = np.full((1, 1, 3), [10, 20, 40], dtype=np.uint8)
    server.scene.set_background_image(bg_img)

    server.scene.add_mesh_trimesh("reef", display_mesh)
    server.scene.add_grid("grid", width=float(display_mesh.extents[0]), height=float(display_mesh.extents[1]))

    # Ajouter le mooring (avec la même normalisation que le terrain)
    # Le center pour le mooring doit être le center XY du terrain original
    terrain_center = mesh.vertices.mean(axis=0)
    mooring_handles = add_mooring_to_viser(server, viz_data, norm_scale, terrain_center)

    # GUI
    with server.gui.add_folder("Mooring"):
        mooring_toggle = server.gui.add_checkbox("Show mooring", initial_value=True)
        server.gui.add_text("Points", initial_value=str(len(viz_data["points"])))
        server.gui.add_text("Lines", initial_value=str(len(viz_data["lines"])))

    print(f"\nServeur Viser → http://localhost:{port}")
    print("Ctrl+C pour arrêter\n")

    last_mooring = True
    try:
        while True:
            if mooring_toggle.value != last_mooring:
                last_mooring = mooring_toggle.value
                for h in mooring_handles:
                    h.visible = last_mooring
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
