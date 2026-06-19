"""Interactive 3D visualization in the browser via Viser.

Python server -> WebSocket -> browser (built-in Three.js).
Features: Z exag slider, depth on click, current arrows, ocean-floor coloring.

Usage:
    python -m coral_sim.viz config.yaml
    python -m coral_sim.viz my_reef.obj
    python -m coral_sim.viz infinigen_dir/
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
import viser

from .terrain.io import TerrainData, load_terrain


# -- Mesh loading --------------------------------------------------------------


def _load_mesh_from_path(path: Path) -> trimesh.Trimesh:
    """Load a mesh from a file or directory."""
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
            raise FileNotFoundError(f"No mesh found in {path}")
        print(f"Loading {len(mesh_files)} mesh(es) from {path}")
        meshes = []
        for mf in mesh_files:
            try:
                loaded = trimesh.load(str(mf), force="mesh")
                if isinstance(loaded, trimesh.Trimesh):
                    meshes.append(loaded)
            except Exception as e:
                print(f"  Skipped {mf.name}: {e}")
        return trimesh.util.concatenate(meshes)
    else:
        print(f"Loading mesh: {path}")
        loaded = trimesh.load(str(path))
        if isinstance(loaded, trimesh.Scene):
            parts = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
            return trimesh.util.concatenate(parts)
        return loaded


def _terrain_to_trimesh(terrain: TerrainData, z_exag: float = 1.0) -> trimesh.Trimesh:
    """Convert a TerrainData to a trimesh."""
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


# -- Depth colormap ------------------------------------------------------------

_DEPTH_CMAP = [
    (0.0, [230, 255, 200]),    # light green (surface, very shallow)
    (0.1, [160, 230, 100]),    # yellow-green
    (0.25, [80, 200, 180]),    # turquoise
    (0.4, [30, 160, 200]),     # cyan
    (0.55, [20, 100, 180]),    # medium blue
    (0.75, [15, 50, 140]),     # dark blue
    (1.0, [5, 15, 60]),        # midnight blue (deep)
]


def _depth_colors(vertices: np.ndarray) -> np.ndarray:
    """Generate RGBA colors per vertex based on depth (Z)."""
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


# -- Viser server --------------------------------------------------------------


def serve(mesh: trimesh.Trimesh, config: dict[str, Any] | None = None):
    """Launch the Viser server displaying the mesh."""
    cfg = config or {}
    port = cfg.get("port", 8080)
    initial_z_exag = cfg.get("z_exaggeration", 5.0)

    # Decimation if too heavy
    max_faces = cfg.get("max_viz_faces", 500_000)
    if len(mesh.faces) > max_faces:
        ratio = 1.0 - max_faces / len(mesh.faces)
        print(f"Decimating {len(mesh.faces):,} -> ~{max_faces:,} faces...")
        mesh = mesh.simplify_quadric_decimation(ratio)

    print(f"Mesh: {len(mesh.vertices):,} vertices - {len(mesh.faces):,} faces")

    # Save original Z values (real depth in meters)
    original_verts = mesh.vertices.copy()
    center_xy = original_verts[:, :2].mean(axis=0)
    original_verts[:, :2] -= center_xy

    # Normalize XY to ~10 units, keep Z proportional
    xy_extent = max(
        original_verts[:, 0].max() - original_verts[:, 0].min(),
        original_verts[:, 1].max() - original_verts[:, 1].min(),
    )
    norm_scale = 10.0 / xy_extent if xy_extent > 0 else 1.0
    original_verts *= norm_scale

    # Factor to convert normalized Z -> real depth in meters
    z_to_meters = 1.0 / norm_scale
    real_depth_min = float(-original_verts[:, 2].max() * z_to_meters)
    real_depth_max = float(-original_verts[:, 2].min() * z_to_meters)

    # Current direction (from colony config or default)
    current_dir_raw = cfg.get("current_direction", [1, 0, 0])
    current_dir = np.array(current_dir_raw[:2], dtype=float)
    current_norm = np.linalg.norm(current_dir)
    if current_norm > 0:
        current_dir /= current_norm

    # Colors computed on real depths (before exag) -- never changes
    base_colors = _depth_colors(original_verts)

    def rebuild_mesh(z_exag: float, flip: bool, opacity: int = 255) -> trimesh.Trimesh:
        """Rebuild the mesh with the given Z exaggeration, visible from both sides."""
        verts = original_verts.copy()
        verts[:, 2] *= z_exag * (-1 if flip else 1)

        # Double-sided: duplicate vertices with inverted normals
        faces_orig = mesh.faces.copy()
        faces_flipped = faces_orig[:, ::-1] + len(verts)  # offset to duplicated vertices
        all_verts = np.vstack([verts, verts])  # duplicate vertices
        all_faces = np.vstack([faces_orig, faces_flipped])
        colors_with_alpha = np.vstack([base_colors, base_colors]).copy()
        colors_with_alpha[:, 3] = opacity

        m = trimesh.Trimesh(vertices=all_verts, faces=all_faces)
        m.visual.vertex_colors = colors_with_alpha
        m.fix_normals()  # recompute normals for each side
        return m

    # -- Server --
    server = viser.ViserServer(host="0.0.0.0", port=port)

    # Dark ocean-blue background
    bg_img = np.full((1, 1, 3), [10, 20, 40], dtype=np.uint8)
    server.scene.set_background_image(bg_img)

    # Initial mesh
    current_mesh = rebuild_mesh(initial_z_exag, False)
    reef_handle = server.scene.add_mesh_trimesh("reef", current_mesh)

    # Grid
    grid_handle = server.scene.add_grid(
        "grid",
        width=float(current_mesh.extents[0]),
        height=float(current_mesh.extents[1]),
    )

    # -- Mooring (optional) --
    mooring_handles = []
    mooring_data = None
    mooring_cfg = cfg.get("_full_config", {}).get("mooring", {})
    mooring_file = mooring_cfg.get("file")

    if mooring_file:
        from .mooring import load_mooring, solve_equilibrium, get_viz_data
        from .terrain import resolve_path

        full_config = cfg.get("_full_config", {})
        mooring_path = resolve_path(full_config, mooring_file)
        if mooring_path.exists():
            system = load_mooring(mooring_path)
            solve_equilibrium(system)
            mooring_data = get_viz_data(system)

            # Original terrain XY center (before normalization)
            terrain_center_xy = center_xy

            def draw_mooring(z_exag: float, flip: bool):
                """Draw the mooring with the same transform as the terrain."""
                nonlocal mooring_handles
                # Remove previous handles
                for h in mooring_handles:
                    h.remove()
                mooring_handles = []

                flip_sign = -1 if flip else 1

                def transform(pos):
                    p = pos.copy().astype(float)
                    p[:2] -= terrain_center_xy
                    p *= norm_scale
                    p[2] *= z_exag * flip_sign
                    return p

                # Lines (cables) -- straight segments between each node
                for line in mooring_data["lines"]:
                    pts = np.array([transform(p) for p in line["positions"]], dtype=np.float32)
                    if len(pts) < 2:
                        continue
                    for seg in range(len(pts) - 1):
                        h = server.scene.add_spline_catmull_rom(
                            f"mooring/line_{line['id']}_seg_{seg}",
                            positions=pts[seg:seg + 2],
                            color=(255, 200, 50),
                            line_width=2.0,
                        )
                        mooring_handles.append(h)

                # Points (anchors = red pyramid, buoys = green sphere)
                for point in mooring_data["points"]:
                    pos = transform(point["position"])
                    sphere_size = 0.03

                    if point["type"] == "fixed":
                        color = (255, 50, 50)
                        label = f"Anchor {point['id']} ({-point['position'][2]:.0f}m)"
                        sphere = trimesh.creation.icosphere(radius=sphere_size)
                        sphere.visual.vertex_colors = np.full((len(sphere.vertices), 4), [*color, 255], dtype=np.uint8)
                        sphere.apply_translation(pos)
                    else:
                        color = (50, 255, 100)
                        label = f"Buoy {point['id']} ({point['mass']:.0f}kg)"
                        sphere = trimesh.creation.icosphere(radius=sphere_size * 1.2)
                        sphere.visual.vertex_colors = np.full((len(sphere.vertices), 4), [*color, 255], dtype=np.uint8)
                        sphere.apply_translation(pos)

                    h = server.scene.add_mesh_trimesh(
                        f"mooring/sphere_{point['id']}",
                        sphere,
                    )
                    mooring_handles.append(h)

                    h = server.scene.add_label(
                        f"mooring/label_{point['id']}",
                        text=label,
                        wxyz=(1, 0, 0, 0),
                        position=(pos[0], pos[1], pos[2] + sphere_size * 2),
                    )
                    mooring_handles.append(h)

            draw_mooring(initial_z_exag, False)
            print(f"  Mooring: {len(mooring_data['points'])} points, {len(mooring_data['lines'])} lines")

    # -- GUI --
    with server.gui.add_folder("View"):
        z_slider = server.gui.add_slider(
            "Z exaggeration", min=1.0, max=30.0, step=0.5,
            initial_value=initial_z_exag,
        )
        flip_toggle = server.gui.add_checkbox("Flip (bottom view)", initial_value=False)
        opacity_slider = server.gui.add_slider(
            "Reef opacity", min=30, max=255, step=5, initial_value=255,
        )
        grid_toggle = server.gui.add_checkbox("Grid", initial_value=True)
        if mooring_data:
            mooring_toggle = server.gui.add_checkbox("Mooring", initial_value=True)

    with server.gui.add_folder("Info"):
        server.gui.add_text("Vertices", initial_value=f"{len(mesh.vertices):,}")
        server.gui.add_text("Faces", initial_value=f"{len(mesh.faces):,}")
        server.gui.add_text("Real depth", initial_value=f"{real_depth_min:.1f} -- {real_depth_max:.1f} m")
        server.gui.add_text("Terrain", initial_value=f"{xy_extent:.0f} x {xy_extent:.0f} m")

    print(f"\nViser server -> http://localhost:{port}")
    print("Ctrl+C to stop\n")

    # -- Interactive loop --
    last_z = initial_z_exag
    last_flip = False
    last_opacity = 255
    last_grid = True
    last_mooring = True

    try:
        while True:
            changed = False

            if z_slider.value != last_z:
                last_z = z_slider.value
                changed = True
            if flip_toggle.value != last_flip:
                last_flip = flip_toggle.value
                changed = True
            if opacity_slider.value != last_opacity:
                last_opacity = int(opacity_slider.value)
                changed = True

            if changed:
                current_mesh = rebuild_mesh(last_z, last_flip, last_opacity)
                reef_handle.remove()
                reef_handle = server.scene.add_mesh_trimesh("reef", current_mesh)
                if mooring_data:
                    draw_mooring(last_z, last_flip)

            if grid_toggle.value != last_grid:
                last_grid = grid_toggle.value
                grid_handle.visible = last_grid

            if mooring_data and mooring_toggle.value != last_mooring:
                last_mooring = mooring_toggle.value
                for h in mooring_handles:
                    h.visible = last_mooring

            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nServer stopped.")


# -- Entry point ---------------------------------------------------------------

if __name__ == "__main__":
    import sys

    from .terrain import load_config, resolve_path

    if len(sys.argv) < 2:
        print("Usage: python -m coral_sim.viz <config.yaml | file.obj | directory/>")
        sys.exit(1)

    arg = sys.argv[1]

    if arg.endswith(".yaml") or arg.endswith(".yml"):
        config = load_config(arg)
        viz_cfg = config.get("viz", {})
        # Pass the full config so serve() can access mooring, etc.
        viz_cfg["_full_config"] = config
        input_path = resolve_path(config, viz_cfg.get("input", "terrain.npz"))
    else:
        input_path = Path(arg)
        viz_cfg = {}

    if input_path.suffix == ".npz":
        terrain = load_terrain(input_path)
        mesh = _terrain_to_trimesh(terrain, z_exag=1.0)  # no exag here, slider handles it
        serve(mesh, viz_cfg)
    elif input_path.suffix in (".obj", ".glb", ".gltf", ".ply", ".stl") or input_path.is_dir():
        mesh = _load_mesh_from_path(input_path)
        serve(mesh, viz_cfg)
    else:
        print(f"Unsupported format: {input_path}")
        sys.exit(1)
