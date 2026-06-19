"""Procedural terrain — multi-zone depth map of a coral reef.

Each zone is a rectangle with its own curve profile (spline).
The profile is applied from edge to center (distance to nearest edge).
The rest of the grid is a flat seabed.

Standalone usage:
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
    """Generate a procedural multi-zone reef terrain."""
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

    print(f"Procedural generation ({nx}x{ny}, {len(zones)} zone(s))...")

    # 1. Flat seabed
    heightmap = np.full((ny, nx), flat_depth, dtype=np.float64)

    # 2. Zone mask (for rugosity)
    reef_mask = np.zeros((ny, nx), dtype=bool)

    # 3. Apply each zone
    x_grid, y_grid = np.meshgrid(x_coords, y_coords)

    for i, zone in enumerate(zones):
        x_min, y_min, x_max, y_max = zone["bounds"]
        profile_pts = zone["profile"]

        # Rectangle mask
        mask = (x_grid >= x_min) & (x_grid <= x_max) & (y_grid >= y_min) & (y_grid <= y_max)
        if not mask.any():
            continue

        # Distance to nearest edge (0 at edge, max at center)
        dist = np.full((ny, nx), 0.0)
        dist[mask] = np.minimum.reduce([
            x_grid[mask] - x_min,
            x_max - x_grid[mask],
            y_grid[mask] - y_min,
            y_max - y_grid[mask],
        ])

        # Profile spline
        ctrl_d, ctrl_z = zip(*profile_pts)
        spline = CubicSpline(ctrl_d, ctrl_z, bc_type="clamped")
        max_dist = float(ctrl_d[-1])

        # Evaluate profile (clamp distance to profile max)
        zone_depth = np.full((ny, nx), flat_depth)
        dist_clamped = np.clip(dist[mask], 0, max_dist)
        zone_depth[mask] = spline(dist_clamped)

        # Minimum depth wins (highest relief)
        heightmap = np.where(mask, np.minimum(heightmap, zone_depth), heightmap)
        reef_mask |= mask

        print(f"  Zone {i + 1}: [{x_min},{y_min}]→[{x_max},{y_max}]")

    # 4. Smooth zone/flat seabed transition
    heightmap = gaussian_filter(heightmap, sigma=1.5)

    # 5. Rugosity (fBm) only on reef zones
    noise_fbm = OpenSimplex(seed=seed)
    fbm = _fbm_2d(noise_fbm, x_coords, y_coords, octaves)
    heightmap[reef_mask] += fbm[reef_mask] * rugosity

    heightmap = np.clip(heightmap, 0, None)

    print(f"  Depth: {heightmap.min():.1f} - {heightmap.max():.1f} m")

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


# ── Standalone execution ──────────────────────────────────────────────────────

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
