# ReefScope

Autonomous coral reef monitoring system. Sensors anchored at the seabed capture imagery continuously, surface by buoyancy when their battery is depleted, transit to shore, get cleaned and recharged, and a fresh sensor takes their place. No permanent power or data infrastructure underwater. The full concept, simulation approach, coverage analysis, open engineering questions, and long-term vision are described in [readme_presentation.md](readme_presentation.md).

## Project Structure

```
coral-reef-scope/
    coral_sim/          # Python library: terrain generation, coral growth, mooring analysis
    mooring-sim/        # Web application (Vite + Three.js): deck, simulation, coverage
    tools/              # Standalone CLI scripts for data generation
    experiments/        # Prototypes & tests (2D Verlet, Infinigen, etc.)
    data/               # Generated files (gitignored)
    cache/              # Allen Coral Atlas WFS response cache
```

## Install

```bash
# Python backend
uv sync

# Web app
cd mooring-sim && bun install
```

## Usage

```bash
# Export GLB from GPS coordinates (at the root)
uv run python tools/reef_export.py \
  --lat -17.52 --lon -149.83 \
  --radius 4 \
  --label "Moorea Nord" \
  --location "French Polynesia" \
  -o mooring-sim/data/reef.glb

# Web app (dev server)
cd mooring-sim && bun dev
```

Or to test the Python modules [deprecated]

```bash
# Generate terrain from Allen Coral Atlas (Moorea, French Polynesia)
uv run python -m coral_sim.terrain config.yaml

# Visualize in 3D (Viser)
uv run python -m coral_sim.viz config.yaml

# Both at once
uv run python tools/run.py config.yaml
```

### GLB Export Options

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

The produced GLB embeds glTF extras:

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
    +-- coral_sim/terrain/      --> data/terrain.npz (Allen WFS or procedural)
    +-- coral_sim/colony.py     --> data/reef.glb (KJMA coral growth)
    +-- coral_sim/viz.py        --> Viser 3D viewer (localhost:8080)
    |
    +-- tools/reef_export.py    --> data/reef.glb (standalone GPS to GLB)
    |
    +-- mooring-sim/            --> Web app (localhost:5173)
        +-- Concept tab         --> Presentation deck
        +-- Simulation tab      --> 3D mooring physics
        +-- Coverage tab        --> Photogrammetric viewshed analysis
```

## Test Devices (Playwright)

```bash
cd mooring-sim

# iPhone Safari
bunx playwright open --device="iPhone 13" --browser=webkit http://localhost:5173

# iPad Safari
bunx playwright open --device="iPad (gen 7)" --browser=webkit http://localhost:5173

# Laptop
bunx playwright open --viewport-size=1366,768 --browser=chromium http://localhost:5173
```

## Config

Edit `config.yaml` to change source (`allen`/`procedural`), bbox, resolution, colony params, etc.
See `ARCHITECTURE.md` for full reference.
