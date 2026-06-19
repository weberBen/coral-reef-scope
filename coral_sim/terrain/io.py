"""TerrainData — common format shared between terrain, colony and viz modules."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np


@dataclass
class TerrainData:
    """Interface contract for reef terrain data.

    Produced by allen.py or procedural.py, consumed by colony.py and viz.py.
    """

    heightmap: np.ndarray
    x_coords: np.ndarray
    y_coords: np.ndarray
    resolution: float
    source: str
    metadata: dict = field(default_factory=dict)
    geomorphic_geojson: dict | None = None
    benthic_geojson: dict | None = None


def save_terrain(path: str | Path, terrain: TerrainData) -> None:
    """Serialize a TerrainData to .npz."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
        heightmap=terrain.heightmap,
        x_coords=terrain.x_coords,
        y_coords=terrain.y_coords,
        resolution=np.array(terrain.resolution),
        source=np.array(terrain.source),
        metadata_json=np.array(json.dumps(terrain.metadata)),
    )
    if terrain.geomorphic_geojson is not None:
        kwargs["geomorphic_json"] = np.array(json.dumps(terrain.geomorphic_geojson))
    if terrain.benthic_geojson is not None:
        kwargs["benthic_json"] = np.array(json.dumps(terrain.benthic_geojson))

    np.savez_compressed(path, **kwargs)
    print(f"Terrain saved -> {path}")


def load_terrain(path: str | Path) -> TerrainData:
    """Load a TerrainData from a .npz file."""
    data = np.load(path, allow_pickle=False)

    geo_json = None
    if "geomorphic_json" in data:
        geo_json = json.loads(str(data["geomorphic_json"]))
    ben_json = None
    if "benthic_json" in data:
        ben_json = json.loads(str(data["benthic_json"]))

    return TerrainData(
        heightmap=data["heightmap"],
        x_coords=data["x_coords"],
        y_coords=data["y_coords"],
        resolution=float(data["resolution"]),
        source=str(data["source"]),
        metadata=json.loads(str(data["metadata_json"])),
        geomorphic_geojson=geo_json,
        benthic_geojson=ben_json,
    )
