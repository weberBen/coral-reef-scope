"""Terrain depuis l'Allen Coral Atlas (WFS public).

Récupère les polygones géomorphiques, les rastérise en depth map,
et produit un TerrainData.

Usage standalone :
    python -m coral_sim.terrain.allen config.yaml
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import requests
import shapely
from scipy.ndimage import gaussian_filter
from shapely.geometry import shape

from .io import TerrainData

WFS_URL = "https://allencoralatlas.org/geoserver/ows"

# Zone géomorphique → profondeur approximative (m, positif = sous l'eau)
GEOMORPHIC_DEPTH = {
    "Reef Slope": 25.0,
    "Sheltered Reef Slope": 12.0,
    "Back Reef Slope": 8.0,
    "Reef Crest": 0.1,
    "Outer Reef Flat": 0.4,
    "Inner Reef Flat": 0.7,
    "Terrestrial Reef Flat": 0.0,
    "Shallow Lagoon": 2.5,
    "Deep Lagoon": 18.0,
    "Plateau": 5.0,
    "Patch Reefs": 3.5,
}


def fetch_allen_terrain(config: dict[str, Any]) -> TerrainData:
    """Récupère et rastérise les données Allen Coral Atlas."""
    bbox = config["bbox"]
    resolution = config["resolution"]
    cache_dir = Path(config.get("cache_dir", "cache"))

    # 1. Télécharger les deux couches
    geo_geojson = _fetch_wfs_layer(
        "coral-atlas:geomorphic_data_verbose", bbox, cache_dir
    )
    ben_geojson = _fetch_wfs_layer(
        "coral-atlas:benthic_data_verbose", bbox, cache_dir
    )

    # 2. Rastériser sur une grille
    lon_min, lat_min, lon_max, lat_max = bbox
    nx = int(round((lon_max - lon_min) / resolution))
    ny = int(round((lat_max - lat_min) / resolution))

    print(f"Rastérisation ({nx}×{ny})…", end=" ", flush=True)
    depth_grid = _rasterize(geo_geojson, bbox, nx, ny, resolution)
    print("OK")

    # 3. Lissage pour transitions douces entre zones
    depth_grid = gaussian_filter(depth_grid.astype(np.float64), sigma=2.0)

    # 4. Construire les coordonnées en mètres (projection locale approximative)
    # 1° lat ≈ 111 320 m, 1° lon ≈ 111 320 * cos(lat) m
    lat_center = (lat_min + lat_max) / 2
    m_per_deg_lon = 111_320 * np.cos(np.radians(lat_center))
    m_per_deg_lat = 111_320

    x_coords = np.linspace(0, (lon_max - lon_min) * m_per_deg_lon, nx)
    y_coords = np.linspace(0, (lat_max - lat_min) * m_per_deg_lat, ny)
    res_m = resolution * m_per_deg_lon  # résolution en mètres

    return TerrainData(
        heightmap=depth_grid,
        x_coords=x_coords,
        y_coords=y_coords,
        resolution=res_m,
        source="allen",
        metadata={
            "bbox": bbox,
            "resolution_deg": resolution,
            "n_geomorphic": len(geo_geojson.get("features", [])),
            "n_benthic": len(ben_geojson.get("features", [])),
        },
        geomorphic_geojson=geo_geojson,
        benthic_geojson=ben_geojson,
    )


def _fetch_wfs_layer(
    typename: str, bbox: list[float], cache_dir: Path
) -> dict:
    """Télécharge une couche depuis le WFS Allen Coral Atlas."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    short = typename.split(":")[1]
    cache_file = cache_dir / f"{short}.json"

    if cache_file.exists():
        print(f"  {short} : cache local")
        return json.loads(cache_file.read_text())

    print(f"  {short} : téléchargement…", end=" ", flush=True)
    params = {
        "service": "WFS",
        "version": "1.0.0",
        "request": "GetFeature",
        "typeName": typename,
        "outputFormat": "application/json",
        "srsName": "EPSG:4326",
        "bbox": f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}",
        "maxFeatures": "50000",
    }
    headers = {"User-Agent": "coral-sim/1.0 (Python/requests)"}
    r = requests.get(WFS_URL, params=params, headers=headers, timeout=300)
    r.raise_for_status()
    data = r.json()

    cache_file.write_text(json.dumps(data))
    n = len(data.get("features", []))
    print(f"{n} polygones")
    return data


def _rasterize(
    geojson: dict,
    bbox: list[float],
    nx: int,
    ny: int,
    resolution: float,
) -> np.ndarray:
    """Rastérise les polygones géomorphiques en grille de profondeur."""
    lon_min, lat_min, lon_max, lat_max = bbox

    # Construire géométries et valeurs de profondeur
    geoms, vals = [], []
    for f in geojson.get("features", []):
        name = f["properties"].get("class_name", "")
        depth = GEOMORPHIC_DEPTH.get(name)
        if depth is None:
            continue
        try:
            g = shape(f["geometry"])
            if g.is_valid and not g.is_empty:
                geoms.append(g)
                vals.append(depth)
        except Exception:
            continue

    if not geoms:
        print("  (aucun polygone valide)")
        return np.zeros((ny, nx), dtype=np.float64)

    # Grille de points
    lons = np.linspace(lon_min + resolution / 2, lon_max - resolution / 2, nx)
    lats = np.linspace(lat_max - resolution / 2, lat_min + resolution / 2, ny)
    lon_grid, lat_grid = np.meshgrid(lons, lats)
    pts = shapely.points(lon_grid.ravel(), lat_grid.ravel())

    # Requête spatiale vectorisée
    tree = shapely.STRtree(geoms)
    pt_idx, geom_idx = tree.query(pts, predicate="intersects")

    grid = np.zeros(len(pts), dtype=np.float64)
    grid[pt_idx] = np.array([vals[i] for i in geom_idx])

    return grid.reshape(ny, nx)


# ── Exécution standalone ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    from . import load_config, resolve_path
    from .io import save_terrain

    if len(sys.argv) < 2:
        print("Usage: python -m coral_sim.terrain.allen <config.yaml>")
        sys.exit(1)

    config = load_config(sys.argv[1])
    terrain = fetch_allen_terrain(config["terrain"]["allen"])
    save_terrain(resolve_path(config, config["terrain"]["output"]), terrain)
