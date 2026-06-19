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

# Export GLB depuis une coordonnee GPS (standalone)
uv run python reef_export.py --lat -17.52 --lon -149.83 --label "Moorea Nord" --location "Polynesie francaise" -o data/reef.glb
```

### Export GLB depuis une localisation

Script standalone (`reef_export.py`) : a partir d'une coordonnee GPS, telecharge les donnees
Allen Coral Atlas (geomorphic + benthic), genere la depth map et exporte un `.glb` avec les
metadonnees geo embarquees.

```bash
uv run python reef_export.py \
  --lat -17.52 --lon -149.83 \
  --radius 4 \
  --label "Moorea Nord" \
  --location "Polynesie francaise" \
  -o data/reef.glb
```

Options :

| Option         | Defaut           | Description                                |
|----------------|------------------|--------------------------------------------|
| `--lat`        | *(requis)*       | Latitude du centre                         |
| `--lon`        | *(requis)*       | Longitude du centre                        |
| `--radius`     | `4`              | Rayon en km autour du point                |
| `--resolution` | `0.0003`         | Resolution en degres/pixel (~33 m)         |
| `--label`      | `""`             | Nom du site inscrit dans le GLB            |
| `--location`   | `""`             | Localisation inscrite dans le GLB          |
| `--cache-dir`  | `cache/`         | Dossier de cache des requetes WFS          |
| `-o`           | `data/reef.glb`  | Fichier de sortie GLB                      |

Le fichier GLB produit contient les extras glTF suivants dans le mesh :

```json
{
  "units": "meters",
  "source": "Allen Coral Atlas",
  "bbox": [-149.87, -17.555, -149.80, -17.485],
  "resolution": 0.0003,
  "label": "Moorea Nord",
  "location": "Polynesie francaise"
}
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

reef_export.py                 ─► data/reef.glb  (standalone, Allen → GLB)
```

All paths are relative to `data_dir` (default `./data/`).

## Test devices (Playwright)

First :

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
