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

# Export GLB from a GPS coordinate (standalone)
uv run python reef_export.py --lat -17.52 --lon -149.83 --label "Moorea Nord" --location "French Polynesia" -o data/reef.glb
```

### GLB Export from a Location

Standalone script (`reef_export.py`): from a GPS coordinate, downloads Allen Coral Atlas data
(geomorphic + benthic), generates the depth map, and exports a `.glb` with embedded geo metadata.

```bash
uv run python reef_export.py \
  --lat -17.52 --lon -149.83 \
  --radius 4 \
  --label "Moorea Nord" \
  --location "French Polynesia" \
  -o data/reef.glb
```

Options:

| Option         | Default          | Description                                |
|----------------|------------------|--------------------------------------------|
| `--lat`        | *(required)*     | Center latitude                            |
| `--lon`        | *(required)*     | Center longitude                           |
| `--radius`     | `4`              | Radius in km around the point              |
| `--resolution` | `0.0003`         | Resolution in degrees/pixel (~33 m)        |
| `--label`      | `""`             | Site name embedded in the GLB              |
| `--location`   | `""`             | Location embedded in the GLB               |
| `--cache-dir`  | `cache/`         | Cache directory for WFS requests           |
| `-o`           | `data/reef.glb`  | Output GLB file                            |

The produced GLB file contains the following glTF extras in the mesh:

```json
{
  "units": "meters",
  "source": "Allen Coral Atlas",
  "bbox": [-149.87, -17.555, -149.80, -17.485],
  "resolution": 0.0003,
  "label": "Moorea Nord",
  "location": "French Polynesia"
}
```

## Pipeline

```
config.yaml
    |
    +-- terrain/allen.py        --> data/terrain.npz
    +-- terrain/procedural.py   --> data/terrain.npz
    |
    +-- colony.py               --> data/reef.glb      (TODO)
    |
    +-- viz.py                  --> 3D interactive window

reef_export.py                  --> data/reef.glb  (standalone, Allen --> GLB)
```

All paths are relative to `data_dir` (default `./data/`).

## Test devices (Playwright)

First:

```bash
cd mooring-sim
```

```bash
# iPhone Safari
bunx playwright open --device="iPhone 13" --browser=webkit http://localhost:5173

# iPad Safari
bunx playwright open --device="iPad (gen 7)" --browser=webkit http://localhost:5173

# Laptop
bunx playwright open --viewport-size=1366,768 --browser=chromium http://localhost:5173
```

## Config

Edit `config.yaml` to change source (`allen`/`procedural`), bbox, resolution, colony params, etc.
