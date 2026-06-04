"""Interface terrain — dispatche vers allen ou procedural selon la config."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from .io import TerrainData


def get_terrain(config: dict[str, Any]) -> TerrainData:
    """Charge ou génère un terrain selon config['terrain']['source']."""
    terrain_cfg = config["terrain"]
    source = terrain_cfg["source"]

    if source == "allen":
        from .allen import fetch_allen_terrain

        return fetch_allen_terrain(terrain_cfg["allen"])
    elif source == "procedural":
        from .procedural import generate_procedural_terrain

        return generate_procedural_terrain(terrain_cfg["procedural"])
    else:
        raise ValueError(f"Source terrain inconnue : {source!r}")


def load_config(path: str | Path) -> dict[str, Any]:
    """Charge un fichier YAML de configuration."""
    with open(path) as f:
        return yaml.safe_load(f)


def resolve_path(config: dict[str, Any], relative_path: str) -> Path:
    """Résout un chemin relatif par rapport à data_dir."""
    data_dir = Path(config.get("data_dir", "data"))
    return data_dir / relative_path
