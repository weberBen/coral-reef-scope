"""Croissance corallienne par modèle KJMA anisotrope.

Seeds placés sur le terrain → chaque seed fait pousser une bosse ellipsoïdale
selon son environnement (profondeur, inclinaison, courant). Les frontières
se forment naturellement par compétition (premier arrivé gagne).

Ref: Kolmogorov-Johnson-Mehl-Avrami, étendu avec anisotropie et tropismes.

Usage standalone :
    python -m coral_sim.colony config.yaml
"""

from __future__ import annotations

from typing import Any

import numpy as np
import trimesh

from .terrain.io import TerrainData, load_terrain


# ── Seed placement ────────────────────────────────────────────────────────────


def scatter_seeds(
    terrain: TerrainData,
    placement_zones: list[dict],
    rng: np.random.Generator,
    config: dict[str, Any] | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Distribue des graines sur le terrain. Retourne positions, depths."""
    config = config or {}
    heightmap = terrain.heightmap
    ny, nx = heightmap.shape
    x_max, y_max = terrain.x_coords[-1], terrain.y_coords[-1]

    all_positions = []
    all_depths = []

    for zone in placement_zones:
        depth_min, depth_max = zone["depth"]
        density = zone["density"]
        if density <= 0:
            continue

        # Nombre de seeds pour cette zone (estimé depuis la surface totale × densité)
        n_candidates = int(x_max * y_max * density)
        pts = rng.random((n_candidates, 2))  # uniform [0,1]²

        # Vectorisé : convertir en coordonnées terrain et filtrer par profondeur
        px = pts[:, 0] * x_max
        py = pts[:, 1] * y_max
        ix = np.clip((px / x_max * (nx - 1)).astype(int), 0, nx - 1)
        iy = np.clip((py / y_max * (ny - 1)).astype(int), 0, ny - 1)
        d = heightmap[iy, ix]

        mask = (d >= depth_min) & (d <= depth_max)
        all_positions.append(np.column_stack([px[mask], py[mask]]))
        all_depths.append(d[mask])

    positions = np.vstack(all_positions) if all_positions else np.zeros((0, 2))
    depths = np.concatenate(all_depths) if all_depths else np.zeros(0)

    # Limiter les seeds selon la RAM disponible
    # La matrice KJMA fait chunk_size × n_seeds × 8 bytes (float64) × ~5 arrays temporaires
    ram_limit_mb = config.get("ram_limit", 500)
    chunk_size = 5000
    max_seeds = int(ram_limit_mb * 1_000_000 / (chunk_size * 8 * 5))
    max_seeds = min(len(positions), max_seeds)
    if len(positions) > max_seeds:
        idx = rng.choice(len(positions), max_seeds, replace=False)
        positions = positions[idx]
        depths = depths[idx]

    print(f"  Seeds : {len(positions)}")
    return positions, depths


# ── Attributs des seeds ───────────────────────────────────────────────────────


def compute_surface_normals(
    heightmap: np.ndarray,
    x_coords: np.ndarray,
    y_coords: np.ndarray,
) -> np.ndarray:
    """Calcule les normales de surface pour toute la grille. Retourne (ny, nx, 3)."""
    dx = x_coords[1] - x_coords[0] if len(x_coords) > 1 else 1.0
    dy = y_coords[1] - y_coords[0] if len(y_coords) > 1 else 1.0
    dzdx = np.gradient(heightmap, dx, axis=1)
    dzdy = np.gradient(heightmap, dy, axis=0)
    normals = np.stack([dzdx, dzdy, np.ones_like(heightmap)], axis=-1)
    norms = np.linalg.norm(normals, axis=-1, keepdims=True)
    return normals / (norms + 1e-10)


def compute_seed_attributes(
    positions: np.ndarray,
    depths: np.ndarray,
    terrain: TerrainData,
    config: dict[str, Any],
) -> tuple[np.ndarray, np.ndarray]:
    """Calcule vitesse et direction pour chaque seed. Retourne (speeds, directions)."""
    ny, nx = terrain.heightmap.shape
    x_max, y_max = terrain.x_coords[-1], terrain.y_coords[-1]

    normals_grid = compute_surface_normals(
        terrain.heightmap, terrain.x_coords, terrain.y_coords
    )

    base_speed = config.get("base_speed", 1.0)
    light_decay = config.get("light_decay", 0.05)
    max_slope = config.get("max_slope", 70)
    current_boost = config.get("current_boost", 1.5)
    w_grav = config.get("w_gravity", 1.0)
    w_light = config.get("w_light", 0.5)
    w_current = config.get("w_current", 0.3)
    sun_dir = np.array(config.get("sun_direction", [0, 0, 1]), dtype=float)
    current_dir = np.array(config.get("current_direction", [1, 0, 0]), dtype=float)

    n = len(positions)
    speeds = np.zeros(n)
    directions = np.zeros((n, 3))

    for i in range(n):
        ix = int(np.clip(positions[i, 0] / x_max * (nx - 1), 0, nx - 1))
        iy = int(np.clip(positions[i, 1] / y_max * (ny - 1), 0, ny - 1))
        normal = normals_grid[iy, ix]

        # Inclinaison (0°=plat, 90°=vertical)
        inclination = np.degrees(np.arccos(np.clip(normal[2], -1, 1)))

        # Vitesse = f(lumière, pente, courant)
        light = np.exp(-light_decay * depths[i])
        slope = max(0, 1.0 - inclination / max_slope)
        current = 1.0 + (current_boost - 1.0) * abs(np.dot(normal[:2], current_dir[:2]))

        speeds[i] = base_speed * light * slope * current

        # Direction de croissance
        d = w_grav * np.array([0, 0, 1.0]) + w_light * sun_dir + w_current * current_dir
        norm_d = np.linalg.norm(d)
        directions[i] = d / norm_d if norm_d > 1e-8 else np.array([0, 0, 1.0])

    print(f"  Vitesses : {speeds.min():.2f} – {speeds.max():.2f}")
    return speeds, directions


# ── KJMA anisotrope ───────────────────────────────────────────────────────────


def kjma_assign(
    mesh_vertices: np.ndarray,
    seed_positions_3d: np.ndarray,
    speeds: np.ndarray,
    directions: np.ndarray,
    anisotropy: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Attribution KJMA : chaque vertex → seed le plus rapide à l'atteindre.

    Retourne (winner_idx, min_time, second_min_time) pour chaque vertex.
    Traité par chunks pour limiter la mémoire.
    """
    n_verts = len(mesh_vertices)
    n_seeds = len(seed_positions_3d)
    chunk_size = max(1, min(5000, 100_000_000 // max(n_seeds, 1)))  # ~100MB max

    winner = np.zeros(n_verts, dtype=np.int32)
    min_time = np.full(n_verts, np.inf)
    second_time = np.full(n_verts, np.inf)

    for start in range(0, n_verts, chunk_size):
        end = min(start + chunk_size, n_verts)
        verts_chunk = mesh_vertices[start:end]  # (chunk, 3)

        # diff[chunk, seed, 3]
        diff = verts_chunk[:, np.newaxis, :] - seed_positions_3d[np.newaxis, :, :]

        # Composante dans la direction du seed
        along = np.einsum("ijk,jk->ij", diff, directions)  # (chunk, seed)

        # Composante perpendiculaire
        along_vec = along[:, :, np.newaxis] * directions[np.newaxis, :, :]  # (chunk, seed, 3)
        perp_vec = diff - along_vec
        perp = np.linalg.norm(perp_vec, axis=-1)  # (chunk, seed)

        # Temps d'arrivée ellipsoïdal
        speed_along = speeds[np.newaxis, :] * anisotropy
        speed_perp = speeds[np.newaxis, :]
        time = np.sqrt(
            (along / (speed_along + 1e-10)) ** 2
            + (perp / (speed_perp + 1e-10)) ** 2
        )

        # Top 2
        sorted_idx = np.argpartition(time, 2, axis=1)[:, :2]
        for vi in range(end - start):
            t0 = time[vi, sorted_idx[vi, 0]]
            t1 = time[vi, sorted_idx[vi, 1]]
            if t0 <= t1:
                winner[start + vi] = sorted_idx[vi, 0]
                min_time[start + vi] = t0
                second_time[start + vi] = t1
            else:
                winner[start + vi] = sorted_idx[vi, 1]
                min_time[start + vi] = t1
                second_time[start + vi] = t0

    return winner, min_time, second_time


# ── Déformation du mesh ──────────────────────────────────────────────────────


def deform_mesh(
    mesh: trimesh.Trimesh,
    winner: np.ndarray,
    min_time: np.ndarray,
    second_time: np.ndarray,
    speeds: np.ndarray,
    config: dict[str, Any],
) -> None:
    """Déforme le mesh en place : bosses aux seeds, creux aux frontières. Vectorisé."""
    max_height = config.get("max_height", 1.5)
    boundary_sharpness = config.get("boundary_sharpness", 3.0)

    normals = mesh.vertex_normals

    # Masque : vertices valides
    valid = (min_time < 1e10) & (second_time > 1e-8) & (speeds[winner] > 1e-6)

    # Profil parabolique
    t_norm = np.where(valid, min_time / (second_time + 1e-10), 1.0)
    profile = np.clip(1.0 - t_norm * t_norm, 0, None)

    # Hauteur proportionnelle à la vitesse du seed
    height = max_height * profile * np.clip(speeds[winner], 0, 3.0) / 3.0

    # Creux aux frontières
    dt = second_time - min_time
    competition = 1.0 - np.exp(-boundary_sharpness * dt / (second_time + 1e-8))
    height *= competition

    # Appliquer seulement aux valides
    height[~valid] = 0.0

    mesh.vertices += normals * height[:, np.newaxis]


# ── Terrain → mesh ───────────────────────────────────────────────────────────


def terrain_to_mesh(terrain: TerrainData) -> trimesh.Trimesh:
    """Convertit un TerrainData en trimesh triangulé."""
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

    return trimesh.Trimesh(vertices=vertices, faces=np.array(faces))


# ── Pipeline ──────────────────────────────────────────────────────────────────


def generate_reef(terrain: TerrainData, config: dict[str, Any]) -> trimesh.Trimesh:
    """Pipeline KJMA : seeds → attributs → attribution → déformation."""
    import os

    # Limiter les cores CPU pour numpy/BLAS
    cpu_limit = str(config.get("cpu_core_limit", ""))
    if cpu_limit:
        os.environ["OMP_NUM_THREADS"] = cpu_limit
        os.environ["MKL_NUM_THREADS"] = cpu_limit
        os.environ["OPENBLAS_NUM_THREADS"] = cpu_limit

    seed_val = config.get("seed", 42)
    rng = np.random.default_rng(seed_val)
    kjma_cfg = config.get("kjma", {})
    zones = config.get("placement", {}).get("zones", [])

    # 1. Scatter
    positions, depths = scatter_seeds(terrain, zones, rng, config=config)
    if len(positions) == 0:
        print("  Aucun seed placé")
        return terrain_to_mesh(terrain)

    # 2. Attributs (vitesse + direction)
    speeds, directions = compute_seed_attributes(positions, depths, terrain, kjma_cfg)

    # Filtrer les seeds avec vitesse ~0
    alive = speeds > 0.01
    positions = positions[alive]
    depths = depths[alive]
    speeds = speeds[alive]
    directions = directions[alive]
    print(f"  Seeds actifs : {len(positions)}")

    # 3. Construire le mesh terrain
    print("  Construction du mesh…")
    mesh = terrain_to_mesh(terrain)

    # Positions 3D des seeds (sur la surface)
    ny, nx = terrain.heightmap.shape
    x_max, y_max = terrain.x_coords[-1], terrain.y_coords[-1]
    seed_z = np.array([
        -terrain.heightmap[
            int(np.clip(p[1] / y_max * (ny - 1), 0, ny - 1)),
            int(np.clip(p[0] / x_max * (nx - 1), 0, nx - 1)),
        ]
        for p in positions
    ])
    seed_positions_3d = np.column_stack([positions, seed_z])

    # 4. Attribution KJMA
    anisotropy = kjma_cfg.get("anisotropy", 2.0)
    print(f"  Attribution KJMA ({len(mesh.vertices):,} vertices × {len(positions)} seeds)…")
    winner, min_time, second_time = kjma_assign(
        mesh.vertices, seed_positions_3d, speeds, directions, anisotropy
    )

    # 5. Déformation
    print("  Déformation…")
    deform_mesh(mesh, winner, min_time, second_time, speeds, kjma_cfg)
    mesh.fix_normals()

    return mesh


# ── CLI ───────────────────────────────────────────────────────────────────────


def run_colony_pipeline(config: dict[str, Any]) -> None:
    from .terrain import resolve_path

    colony_cfg = config["colony"]
    input_path = resolve_path(config, colony_cfg["input"])
    output_path = resolve_path(config, colony_cfg["output"])

    print(f"Chargement terrain : {input_path}")
    terrain = load_terrain(input_path)

    print("Croissance KJMA anisotrope…")
    reef = generate_reef(terrain, colony_cfg)
    print(f"  {len(reef.vertices):,} sommets · {len(reef.faces):,} faces")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    reef.export(str(output_path))
    print(f"Reef sauvegardé → {output_path}")


if __name__ == "__main__":
    import sys
    from .terrain import load_config
    if len(sys.argv) < 2:
        print("Usage: python -m coral_sim.colony <config.yaml>")
        sys.exit(1)
    config = load_config(sys.argv[1])
    run_colony_pipeline(config)
