"""TerrainData — format commun entre modules terrain, colony et viz."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np


@dataclass
class TerrainData:
    """Contrat d'interface pour les données de terrain récifal.

    Produit par allen.py ou procedural.py, consommé par colony.py et viz.py.

    Attributes:
        heightmap: (ny, nx) profondeur en mètres (positif = sous l'eau).
        x_coords: (nx,) axe X en mètres.
        y_coords: (ny,) axe Y en mètres.
        resolution: mètres par pixel.
        source: "allen" ou "procedural".
        metadata: infos supplémentaires (bbox, date, paramètres...).
    """

    heightmap: np.ndarray
    x_coords: np.ndarray
    y_coords: np.ndarray
    resolution: float
    source: str
    metadata: dict = field(default_factory=dict)


def save_terrain(path: str | Path, terrain: TerrainData) -> None:
    """Sérialise un TerrainData en .npz."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        path,
        heightmap=terrain.heightmap,
        x_coords=terrain.x_coords,
        y_coords=terrain.y_coords,
        resolution=np.array(terrain.resolution),
        source=np.array(terrain.source),
        metadata_json=np.array(json.dumps(terrain.metadata)),
    )
    print(f"Terrain sauvegardé → {path}")


def load_terrain(path: str | Path) -> TerrainData:
    """Charge un TerrainData depuis un .npz."""
    data = np.load(path, allow_pickle=False)
    return TerrainData(
        heightmap=data["heightmap"],
        x_coords=data["x_coords"],
        y_coords=data["y_coords"],
        resolution=float(data["resolution"]),
        source=str(data["source"]),
        metadata=json.loads(str(data["metadata_json"])),
    )
