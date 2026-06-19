"""Terrain interface — dispatches to allen or procedural based on config."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from .io import TerrainData


def get_terrain(config: dict[str, Any]) -> TerrainData:
    """Load or generate terrain based on config['terrain']['source']."""
    terrain_cfg = config["terrain"]
    source = terrain_cfg["source"]

    if source == "allen":
        from .allen import fetch_allen_terrain

        return fetch_allen_terrain(terrain_cfg["allen"])
    elif source == "procedural":
        from .procedural import generate_procedural_terrain

        return generate_procedural_terrain(terrain_cfg["procedural"])
    else:
        raise ValueError(f"Unknown terrain source: {source!r}")


def load_config(path: str | Path) -> dict[str, Any]:
    """Load a YAML configuration file."""
    with open(path) as f:
        return yaml.safe_load(f)


def resolve_path(config: dict[str, Any], relative_path: str) -> Path:
    """Resolve a relative path against data_dir."""
    data_dir = Path(config.get("data_dir", "data"))
    return data_dir / relative_path
