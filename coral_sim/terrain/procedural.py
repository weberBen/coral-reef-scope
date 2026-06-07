"""Terrain procédural — depth map multi-zones d'un récif corallien.

Chaque zone est un rectangle avec son propre profil de courbe (spline).
Le profil s'applique du bord vers le centre (distance au bord le plus proche).
Le reste de la grille est un fond plat.

Usage standalone :
    python -m coral_sim.terrain.procedural config.yaml
"""

from __future__ import annotations

from typing import Any

import numpy as np
from opensimplex import OpenSimplex
from scipy.interpolate import CubicSpline
from scipy.ndimage import gaussian_filter

from .io import TerrainData


def generate_procedural_terrain(config: dict[str, Any]) -> TerrainData:
    """Génère un terrain récifal procédural multi-zones."""
    length_x = config["length_x"]
    length_y = config["length_y"]
    resolution = config["resolution"]
    seed = config.get("seed", 42)
    octaves = config.get("octaves", 6)
    rugosity = config.get("rugosity", 1.5)
    flat_depth = config.get("flat_depth", 20.0)
    zones = config["zones"]

    nx = int(round(length_x / resolution))
    ny = int(round(length_y / resolution))
    x_coords = np.linspace(0, length_x, nx)
    y_coords = np.linspace(0, length_y, ny)

    print(f"Génération procédurale ({nx}×{ny}, {len(zones)} zone(s))…")

    # 1. Fond plat
    heightmap = np.full((ny, nx), flat_depth, dtype=np.float64)

    # 2. Masque des zones (pour la rugosité)
    reef_mask = np.zeros((ny, nx), dtype=bool)

    # 3. Appliquer chaque zone
    x_grid, y_grid = np.meshgrid(x_coords, y_coords)

    for i, zone in enumerate(zones):
        x_min, y_min, x_max, y_max = zone["bounds"]
        profile_pts = zone["profile"]

        # Masque du rectangle
        mask = (x_grid >= x_min) & (x_grid <= x_max) & (y_grid >= y_min) & (y_grid <= y_max)
        if not mask.any():
            continue

        # Distance au bord le plus proche (0 au bord, max au centre)
        dist = np.full((ny, nx), 0.0)
        dist[mask] = np.minimum.reduce([
            x_grid[mask] - x_min,
            x_max - x_grid[mask],
            y_grid[mask] - y_min,
            y_max - y_grid[mask],
        ])

        # Spline du profil
        ctrl_d, ctrl_z = zip(*profile_pts)
        spline = CubicSpline(ctrl_d, ctrl_z, bc_type="clamped")
        max_dist = float(ctrl_d[-1])

        # Évaluer le profil (clamp la distance au max du profil)
        zone_depth = np.full((ny, nx), flat_depth)
        dist_clamped = np.clip(dist[mask], 0, max_dist)
        zone_depth[mask] = spline(dist_clamped)

        # Profondeur minimale gagne (relief le plus haut)
        heightmap = np.where(mask, np.minimum(heightmap, zone_depth), heightmap)
        reef_mask |= mask

        print(f"  Zone {i + 1}: [{x_min},{y_min}]→[{x_max},{y_max}]")

    # 4. Lisser la transition zone/fond plat
    heightmap = gaussian_filter(heightmap, sigma=1.5)

    # 5. Rugosité (fBm) uniquement sur les zones de récif
    noise_fbm = OpenSimplex(seed=seed)
    fbm = _fbm_2d(noise_fbm, x_coords, y_coords, octaves)
    heightmap[reef_mask] += fbm[reef_mask] * rugosity

    heightmap = np.clip(heightmap, 0, None)

    print(f"  Profondeur : {heightmap.min():.1f} – {heightmap.max():.1f} m")

    return TerrainData(
        heightmap=heightmap,
        x_coords=x_coords,
        y_coords=y_coords,
        resolution=resolution,
        source="procedural",
        metadata={
            "length_x": length_x,
            "length_y": length_y,
            "seed": seed,
            "n_zones": len(zones),
        },
    )


def _fbm_2d(
    noise: OpenSimplex,
    x_coords: np.ndarray,
    y_coords: np.ndarray,
    octaves: int,
) -> np.ndarray:
    """Fractional Brownian Motion 2D via OpenSimplex."""
    ny, nx = len(y_coords), len(x_coords)
    result = np.zeros((ny, nx), dtype=np.float64)

    amplitude = 1.0
    frequency = 1.0 / max(x_coords[-1], y_coords[-1])
    total_amp = 0.0

    for _ in range(octaves):
        for j in range(ny):
            for i in range(nx):
                result[j, i] += amplitude * noise.noise2(
                    x_coords[i] * frequency, y_coords[j] * frequency
                )
        total_amp += amplitude
        amplitude *= 0.5
        frequency *= 2.0

    return result / total_amp


# ── Exécution standalone ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    from . import load_config, resolve_path
    from .io import save_terrain

    if len(sys.argv) < 2:
        print("Usage: python -m coral_sim.terrain.procedural <config.yaml>")
        sys.exit(1)

    config = load_config(sys.argv[1])
    terrain = generate_procedural_terrain(config["terrain"]["procedural"])
    save_terrain(resolve_path(config, config["terrain"]["output"]), terrain)
