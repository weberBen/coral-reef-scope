#!/usr/bin/env python3
"""Export GLB d'un terrain recifal depuis Allen Coral Atlas.

Script standalone : coordonnee GPS -> fetch Allen WFS -> depth map -> GLB
avec metadonnees geo embarquees (label, location, bbox, resolution, source).

Usage :
    python reef_export.py --lat -17.52 --lon -149.83 --label "Moorea Nord" --location "Polynesie francaise"
    python reef_export.py --lat -17.52 --lon -149.83 --radius 6 --resolution 0.0005 -o moorea.glb
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from pathlib import Path

import numpy as np
import requests
import shapely
import trimesh
from scipy.ndimage import gaussian_filter
from shapely.geometry import shape

# ── Allen Coral Atlas WFS ────────────────────────────────────────────────────

WFS_URL = "https://allencoralatlas.org/geoserver/ows"

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


def fetch_wfs_layer(typename: str, bbox: list[float], cache_dir: Path) -> dict:
    """Telecharge une couche GeoJSON depuis le WFS Allen Coral Atlas."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    short = typename.split(":")[1]
    cache_file = cache_dir / f"{short}.json"

    if cache_file.exists():
        print(f"  {short} : cache local")
        return json.loads(cache_file.read_text())

    print(f"  {short} : telechargement...", end=" ", flush=True)
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


def rasterize(
    geojson: dict, bbox: list[float], nx: int, ny: int, resolution: float
) -> np.ndarray:
    """Rasterise les polygones geomorphiques en grille de profondeur."""
    lon_min, lat_min, lon_max, lat_max = bbox

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

    lons = np.linspace(lon_min + resolution / 2, lon_max - resolution / 2, nx)
    lats = np.linspace(lat_max - resolution / 2, lat_min + resolution / 2, ny)
    lon_grid, lat_grid = np.meshgrid(lons, lats)
    pts = shapely.points(lon_grid.ravel(), lat_grid.ravel())

    tree = shapely.STRtree(geoms)
    pt_idx, geom_idx = tree.query(pts, predicate="intersects")

    grid = np.zeros(len(pts), dtype=np.float64)
    grid[pt_idx] = np.array([vals[i] for i in geom_idx])

    return grid.reshape(ny, nx)


# ── Depth map -> Mesh -> GLB ─────────────────────────────────────────────────


def build_mesh(
    depth_grid: np.ndarray, bbox: list[float], resolution: float
) -> trimesh.Trimesh:
    """Construit un mesh triangule a partir de la depth map."""
    ny, nx = depth_grid.shape
    lon_min, lat_min, lon_max, lat_max = bbox

    lat_center = (lat_min + lat_max) / 2
    m_per_deg_lon = 111_320 * math.cos(math.radians(lat_center))
    m_per_deg_lat = 111_320

    x_coords = np.linspace(0, (lon_max - lon_min) * m_per_deg_lon, nx)
    y_coords = np.linspace(0, (lat_max - lat_min) * m_per_deg_lat, ny)

    x_grid, y_grid = np.meshgrid(x_coords, y_coords)
    z_grid = -depth_grid  # profondeur positive -> Z negatif

    vertices = np.column_stack([x_grid.ravel(), y_grid.ravel(), z_grid.ravel()])

    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            idx = j * nx + i
            faces.append([idx, idx + nx, idx + 1])
            faces.append([idx + 1, idx + nx, idx + nx + 1])

    return trimesh.Trimesh(vertices=vertices, faces=np.array(faces))


def inject_glb_extras(glb_bytes: bytes, extras: dict) -> bytes:
    """Injecte des extras dans le premier mesh du JSON chunk d'un GLB."""
    chunk_len = struct.unpack_from("<I", glb_bytes, 12)[0]
    chunk_type = struct.unpack_from("<I", glb_bytes, 16)[0]
    json_bytes = glb_bytes[20 : 20 + chunk_len]
    rest = glb_bytes[20 + chunk_len :]

    gltf = json.loads(json_bytes)

    if gltf.get("meshes"):
        mesh_extras = gltf["meshes"][0].get("extras", {})
        mesh_extras.update(extras)
        gltf["meshes"][0]["extras"] = mesh_extras

    new_json = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode(
        "utf-8"
    )
    pad = (4 - len(new_json) % 4) % 4
    new_json += b" " * pad

    new_glb = bytearray()
    new_glb += glb_bytes[:8]  # magic + version
    total_len = 12 + 8 + len(new_json) + len(rest)
    new_glb += struct.pack("<I", total_len)
    new_glb += struct.pack("<II", len(new_json), chunk_type)
    new_glb += new_json
    new_glb += rest
    return bytes(new_glb)


def export_glb(
    path: Path,
    mesh: trimesh.Trimesh,
    *,
    bbox: list[float],
    resolution: float,
    label: str,
    location: str,
    n_geomorphic: int = 0,
    n_benthic: int = 0,
) -> None:
    """Exporte le mesh en GLB avec les extras geo."""
    path.parent.mkdir(parents=True, exist_ok=True)

    extras = {
        "units": "meters",
        "source": "Allen Coral Atlas",
        "bbox": bbox,
        "resolution": resolution,
    }
    if label:
        extras["label"] = label
    if location:
        extras["location"] = location
    if n_geomorphic:
        extras["n_geomorphic"] = n_geomorphic
    if n_benthic:
        extras["n_benthic"] = n_benthic

    glb_bytes = mesh.export(file_type="glb")
    glb_bytes = inject_glb_extras(glb_bytes, extras)

    path.write_bytes(glb_bytes)
    print(f"GLB exporte -> {path}  ({len(mesh.vertices):,} sommets)")


# ── Pipeline complet ─────────────────────────────────────────────────────────


def pipeline(
    lat: float,
    lon: float,
    radius_km: float,
    resolution: float,
    label: str,
    location: str,
    cache_dir: str,
    output: str,
) -> None:
    """Coordonnee GPS -> Allen Coral Atlas -> depth map -> GLB."""
    # Bbox depuis lat/lon + rayon
    km_per_deg_lat = 111.32
    km_per_deg_lon = 111.32 * math.cos(math.radians(lat))
    dlat = radius_km / km_per_deg_lat
    dlon = radius_km / km_per_deg_lon

    bbox = [lon - dlon, lat - dlat, lon + dlon, lat + dlat]

    print(f"Centre : {lat:.4f}, {lon:.4f}")
    print(f"Rayon  : {radius_km} km")
    print(f"Bbox   : [{bbox[0]:.5f}, {bbox[1]:.5f}, {bbox[2]:.5f}, {bbox[3]:.5f}]")

    # 1. Fetch Allen WFS
    cache = Path(cache_dir)
    geo_geojson = fetch_wfs_layer("coral-atlas:geomorphic_data_verbose", bbox, cache)
    ben_geojson = fetch_wfs_layer("coral-atlas:benthic_data_verbose", bbox, cache)

    # 2. Rasterisation
    lon_min, lat_min, lon_max, lat_max = bbox
    nx = int(round((lon_max - lon_min) / resolution))
    ny = int(round((lat_max - lat_min) / resolution))

    print(f"Rasterisation ({nx} x {ny})...", end=" ", flush=True)
    depth_grid = rasterize(geo_geojson, bbox, nx, ny, resolution)
    depth_grid = gaussian_filter(depth_grid.astype(np.float64), sigma=2.0)
    print("OK")

    print(f"Profondeur : {depth_grid.min():.1f} - {depth_grid.max():.1f} m")

    # 3. Mesh + GLB
    mesh = build_mesh(depth_grid, bbox, resolution)

    export_glb(
        Path(output),
        mesh,
        bbox=bbox,
        resolution=resolution,
        label=label,
        location=location,
        n_geomorphic=len(geo_geojson.get("features", [])),
        n_benthic=len(ben_geojson.get("features", [])),
    )


# ── CLI ──────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="Export GLB d'un terrain recifal depuis Allen Coral Atlas.",
    )
    parser.add_argument("--lat", type=float, required=True, help="Latitude du centre")
    parser.add_argument("--lon", type=float, required=True, help="Longitude du centre")
    parser.add_argument(
        "--radius", type=float, default=4.0, help="Rayon en km (defaut: 4)"
    )
    parser.add_argument(
        "--resolution",
        type=float,
        default=0.0003,
        help="Resolution en degres/pixel (defaut: 0.0003 ~ 33m)",
    )
    parser.add_argument(
        "--label", type=str, default="", help="Nom du site (ex: 'Moorea Nord')"
    )
    parser.add_argument(
        "--location",
        type=str,
        default="",
        help="Localisation (ex: 'Polynesie francaise')",
    )
    parser.add_argument(
        "--cache-dir", type=str, default="cache", help="Dossier de cache WFS"
    )
    parser.add_argument(
        "-o", "--output", type=str, default="data/reef.glb", help="Fichier de sortie"
    )

    args = parser.parse_args()

    pipeline(
        lat=args.lat,
        lon=args.lon,
        radius_km=args.radius,
        resolution=args.resolution,
        label=args.label,
        location=args.location,
        cache_dir=args.cache_dir,
        output=args.output,
    )


if __name__ == "__main__":
    main()
