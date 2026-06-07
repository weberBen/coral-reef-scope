"""Génération procédurale de colonies de coraux.

DLA via dlacorals (pip) pour les coraux branchus (Pocillopora, Acropora).
Sphère bruitée (OpenSimplex) pour les coraux massifs (Porites).

Charge un terrain (.npz), place les colonies, exporte en .glb.

Usage standalone :
    python -m coral_sim.colony config.yaml
"""

from __future__ import annotations

from typing import Any

import numpy as np
import trimesh
from dlacorals import dla_model as dm
from opensimplex import OpenSimplex
from skimage.measure import marching_cubes

from .terrain.io import TerrainData, load_terrain


# ── DLA (dlacorals) — coraux branchus ─────────────────────────────────────────


def generate_dla_colony(config: dict[str, Any], seed: int = 0) -> trimesh.Trimesh:
    """Génère une colonie branchue via DLA (dlacorals) → mesh.

    Utilise dlacorals (Bakels et al. 2024, UvA/VU) :
    - init_seeds_bottom → graines au fond
    - move_particles_diffuse → marche aléatoire avec drift
    - aggregate_particles → fixation au contact avec biais solaire
    - Résultat : grille 3D → marching cubes → trimesh
    """
    grid_size = config.get("grid_size", 50)
    steps = config.get("steps", 500)
    particle_density = config.get("particle_density", 0.1)
    drift_vec = config.get("drift_vec", [0, 0, -1])
    sun_vec = config.get("sun_vec", [0, 0, -1])

    np.random.seed(seed)

    # Initialisation 3D
    seeds_coords = dm.init_seeds_bottom(grid_size, n_seeds=1, n_dims=3)
    lattice = dm.init_lattice(grid_size, seeds_coords)
    particles = dm.init_particles(lattice, particle_density)

    # Simulation DLA
    for _step in range(steps):
        particles = dm.move_particles_diffuse(
            particles, lattice,
            periodic=(True, True, False),
            moore=True,
            drift_vec=drift_vec,
            regen_bndry=True,
        )
        lattice, particles = dm.aggregate_particles(
            particles, lattice,
            prop_particles=particle_density,
            moore=True,
            sun_vec=sun_vec,
        )

    # Grille → mesh via marching cubes
    filled = int(lattice.sum())
    if filled < 10:
        return trimesh.creation.icosphere(radius=0.3)

    verts, faces, _, _ = marching_cubes(lattice.astype(float), level=0.5)
    # Normaliser à [-0.5, 0.5]
    verts = (verts - grid_size / 2) / grid_size
    return trimesh.Trimesh(vertices=verts, faces=faces)


# ── Sphère bruitée — coraux massifs (Porites) ────────────────────────────────


def generate_massive_colony(config: dict[str, Any], seed: int = 0) -> trimesh.Trimesh:
    """Génère une colonie massive via sphère déformée par Simplex noise."""
    subdivisions = config.get("subdivisions", 3)
    noise_scale = config.get("noise_scale", 3.0)
    noise_amplitude = config.get("noise_amplitude", 0.15)
    radius = config.get("radius", 0.4)

    mesh = trimesh.creation.icosphere(subdivisions=subdivisions, radius=radius)
    noise = OpenSimplex(seed=seed)

    for i, v in enumerate(mesh.vertices):
        d = noise.noise3(v[0] * noise_scale, v[1] * noise_scale, v[2] * noise_scale)
        mesh.vertices[i] += mesh.vertex_normals[i] * d * noise_amplitude

    mesh.fix_normals()
    return mesh


# ── Placement des colonies sur le terrain ─────────────────────────────────────


def _poisson_disk_2d(
    x_min: float, x_max: float,
    y_min: float, y_max: float,
    spacing: float,
    rng: np.random.Generator,
) -> np.ndarray:
    """Poisson-disk sampling simplifié (grille + jitter)."""
    xs = np.arange(x_min + spacing / 2, x_max, spacing)
    ys = np.arange(y_min + spacing / 2, y_max, spacing)
    grid_x, grid_y = np.meshgrid(xs, ys)
    points = np.column_stack([grid_x.ravel(), grid_y.ravel()])
    points += rng.uniform(-spacing * 0.35, spacing * 0.35, points.shape)
    return points


def place_colonies(
    terrain: TerrainData,
    config: dict[str, Any],
) -> list[trimesh.Trimesh]:
    """Place des colonies sur le terrain selon les zones de profondeur."""
    seed = config.get("seed", 42)
    rng = np.random.default_rng(seed)
    templates_per_type = config.get("templates_per_type", 5)
    zones = config["placement"]["zones"]

    print("  Génération des templates DLA…", end=" ", flush=True)
    dla_templates = [
        generate_dla_colony(config.get("dla", {}), seed=seed + i)
        for i in range(templates_per_type)
    ]
    print("OK")

    print("  Génération des templates massifs…", end=" ", flush=True)
    massive_templates = [
        generate_massive_colony(config.get("massive", {}), seed=seed + 100 + i)
        for i in range(templates_per_type)
    ]
    print("OK")

    templates = {"dla": dla_templates, "massive": massive_templates}

    heightmap = terrain.heightmap
    ny, nx = heightmap.shape
    colonies = []

    for zone_cfg in zones:
        depth_min, depth_max = zone_cfg["depth"]
        colony_type = zone_cfg["type"]
        density = zone_cfg["density"]
        size_range = config.get(colony_type, {}).get("size_range", [0.5, 1.5])

        spacing = 1.0 / (density ** 0.5) if density > 0 else 100.0
        type_templates = templates.get(colony_type, dla_templates)

        points = _poisson_disk_2d(
            terrain.x_coords[0], terrain.x_coords[-1],
            terrain.y_coords[0], terrain.y_coords[-1],
            spacing, rng,
        )

        count = 0
        for px, py in points:
            ix = int(np.clip(px / terrain.x_coords[-1] * (nx - 1), 0, nx - 1))
            iy = int(np.clip(py / terrain.y_coords[-1] * (ny - 1), 0, ny - 1))
            depth = heightmap[iy, ix]

            if depth < depth_min or depth > depth_max:
                continue

            tmpl = type_templates[rng.integers(len(type_templates))]
            colony = tmpl.copy()

            scale = rng.uniform(size_range[0], size_range[1])
            colony.apply_scale(scale)

            angle = rng.uniform(0, 2 * np.pi)
            rot = trimesh.transformations.rotation_matrix(angle, [0, 0, 1])
            colony.apply_transform(rot)

            colony.apply_translation([px, py, -depth])
            colonies.append(colony)
            count += 1

        print(f"  Zone {depth_min}-{depth_max}m ({colony_type}): {count} colonies")

    return colonies


def build_reef_mesh(terrain: TerrainData, colonies: list[trimesh.Trimesh]) -> trimesh.Trimesh:
    """Fusionne le terrain et les colonies en un seul mesh."""
    ny, nx = terrain.heightmap.shape
    x_grid, y_grid = np.meshgrid(terrain.x_coords, terrain.y_coords)
    z_grid = -terrain.heightmap

    vertices = np.column_stack([x_grid.ravel(), y_grid.ravel(), z_grid.ravel()])
    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            idx = j * nx + i
            faces.append([idx, idx + nx, idx + 1])
            faces.append([idx + 1, idx + nx, idx + nx + 1])

    terrain_mesh = trimesh.Trimesh(vertices=vertices, faces=np.array(faces))
    return trimesh.util.concatenate([terrain_mesh] + colonies)


# ── Pipeline ──────────────────────────────────────────────────────────────────


def run_colony_pipeline(config: dict[str, Any]) -> None:
    """Pipeline complet : charge terrain → génère colonies → sauvegarde .glb."""
    from .terrain import resolve_path

    colony_cfg = config["colony"]
    input_path = resolve_path(config, colony_cfg["input"])
    output_path = resolve_path(config, colony_cfg["output"])

    print(f"Chargement terrain : {input_path}")
    terrain = load_terrain(input_path)

    print("Placement des colonies…")
    colonies = place_colonies(terrain, colony_cfg)

    print(f"Fusion du mesh ({len(colonies)} colonies)…")
    reef = build_reef_mesh(terrain, colonies)
    print(f"  {len(reef.vertices):,} sommets · {len(reef.faces):,} faces")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    reef.export(str(output_path))
    print(f"Reef sauvegardé → {output_path}")


# ── Exécution standalone ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    from .terrain import load_config

    if len(sys.argv) < 2:
        print("Usage: python -m coral_sim.colony <config.yaml>")
        sys.exit(1)

    config = load_config(sys.argv[1])
    run_colony_pipeline(config)
