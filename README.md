# coral

Procedural coral reef generation and 3D visualization.

## Install

```bash
uv sync
```

## Usage

```bash
# Generate terrain from Allen Coral Atlas (Moorea, French Polynesia)
uv run python -m coral_sim.terrain config.yaml

# Visualize in 3D
uv run python -m coral_sim.viz config.yaml

# Both at once
uv run python run.py config.yaml
```

## Pipeline

```
config.yaml
    │
    ├─ terrain/allen.py        ─► data/terrain.npz
    ├─ terrain/procedural.py   ─► data/terrain.npz
    │
    ├─ colony.py               ─► data/reef.glb      (TODO)
    │
    └─ viz.py                  ─► 3D interactive window
```

All paths are relative to `data_dir` (default `./data/`).

## Config

Edit `config.yaml` to change source (`allen`/`procedural`), bbox, resolution, colony params, etc.
