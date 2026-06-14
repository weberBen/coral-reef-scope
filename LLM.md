# Coral Reef Monitoring Simulator

## Project Overview

Simulation tool for planning underwater camera monitoring systems on coral reefs.
Goal: visualize a reef, place mooring stations, simulate wave/current forces, evaluate camera coverage.

## Architecture

```
coral/
    config.yaml                     # All parameters (terrain, colony, mooring, viz)
    run.py                          # Quick launcher
    data/                           # Generated files (gitignored)
        terrain.npz                 # Depth map (Allen or procedural)
        reef.glb                    # Terrain + coral deformation
        mooring.dat                 # Mooring system (MoorDyn format)
    coral_sim/
        __init__.py
        __main__.py
        terrain/
            __init__.py             # get_terrain(), load_config(), resolve_path()
            io.py                   # TerrainData dataclass + save/load .npz
            allen.py                # Allen Coral Atlas (WFS public, geomorphic + benthic)
            procedural.py           # Procedural terrain (multi-zone, spline profiles, fBm)
        colony.py                   # KJMA anisotropic coral growth (deforms terrain mesh)
        mooring.py                  # MoorDyn file loading via MoorPy
        viz.py                      # Viser 3D interactive browser visualization
    reef_3d.py                      # Legacy standalone Sketchfab viewer (unused)
```

## Modules — Current State

### terrain/allen.py ✅ Working
- Fetches geomorphic + benthic data from Allen Coral Atlas WFS
- Rasterizes to depth map via shapely.STRtree
- Stores raw GeoJSON in TerrainData for overlay viz
- Cache in `cache/` dir
- **Bug**: WFS returns 403 without User-Agent header

### terrain/procedural.py ✅ Working
- Multi-zone terrain: rectangles with custom spline profiles
- Profile = control points [distance_from_edge, depth] → CubicSpline
- fBm rugosity (OpenSimplex) only inside reef zones
- Flat depth outside zones

### colony.py ✅ Working (basic)
- KJMA anisotropic model (Kolmogorov-Johnson-Mehl-Avrami)
- Seeds scattered randomly, speed depends on depth/slope/current
- Ellipsoidal growth (anisotropy parameter)
- Competition: first-to-arrive wins, boundaries form naturally
- Deforms terrain mesh vertices along normals
- **Limitation**: deformation is subtle (0.5m on 7km terrain), mainly visible with Z exaggeration
- **Config**: `ram_limit` controls max memory for KJMA matrix

### mooring.py ✅ Working (basic)
- Loads MoorDyn v2 format (.dat)
- Solves static equilibrium via MoorPy
- Extracts point positions + line coordinates for visualization
- **Current mooring.dat**: 4 anchors, 4 buoys, 1 central point, 12 lines over the reef

### viz.py ✅ Working
- Viser server (WebSocket → Three.js in browser)
- Features:
  - Z exaggeration slider (live)
  - Flip view (top/bottom)
  - Reef opacity slider (see through mesh)
  - Grid toggle
  - Mooring overlay (cables in yellow, anchors red spheres, buoys green spheres)
  - Mooring toggle
  - Depth colormap (green surface → blue deep)
  - Double-sided mesh rendering
  - Real depth + terrain dimensions in Info panel
- Mesh normalized to ~10 Viser units for camera compatibility
- XY centered, Z scaled by exaggeration

## Data Flow

```
config.yaml
    ├─ terrain (Allen WFS or procedural) → data/terrain.npz
    ├─ colony (KJMA on terrain.npz)      → data/reef.glb
    ├─ mooring (MoorDyn .dat)            → loaded by MoorPy at viz time
    └─ viz (loads .npz or .glb + mooring.dat) → http://localhost:8080
```

## Commands

```bash
# Generate terrain from Allen Coral Atlas (Moorea)
uv run python -m coral_sim.terrain config.yaml

# Generate terrain (procedural)
# Change config.yaml: terrain.source: procedural
uv run python -m coral_sim.terrain config.yaml

# Generate coral growth (KJMA)
uv run python -m coral_sim.colony config.yaml

# Visualize (terrain alone or reef+mooring)
uv run python -m coral_sim.viz config.yaml
```

## Key Decisions & Context

### Terrain
- Allen Coral Atlas only provides 2 WFS layers (geomorphic + benthic), no real bathymetry
- Depth is approximated by mapping zone names to typical depths
- Procedural terrain uses control-point spline profiles per zone (user-defined curve shape)

### Coral Generation
- Started with DLA (dlacorals lib) + Differential Growth → too slow/unstable
- Tried Infinigen → requires Python 3.11 + Blender, can't import custom depth maps
- Settled on KJMA: analytical model, no iteration, ~5s for 54K vertices × 2000 seeds
- At km scale, individual corals (0.5m) are negligible for fluid simulation
- Coral detail matters only for visualization, not physics

### Mooring
- MoorDyn format is the industry standard (NREL, OpenFAST)
- MoorPy for static equilibrium
- Real monitoring uses grids of individual mooring stations (30-50m each, spaced 200-500m), NOT giant nets
- Bouées need volume >> mass/1025 to float (previous bug: bouées were sinking)

### Visualization
- Viser chosen over Three.js (Python-driven, no custom JS) and MapLibre (showed island not reef)
- Three.js had better shader features (hover contour lines) but required custom HTML generation
- Mesh must be normalized to ~10 units for Viser camera to work
- Double-sided faces needed (duplicate + flip faces) to see from both sides

## Config Format (config.yaml)

- `data_dir`: base directory for all inputs/outputs (default: `./data/`)
- All paths in sections are relative to `data_dir`
- `resolve_path(config, relative_path)` resolves them

## Dependencies

```
numpy, pyyaml, requests, shapely, scipy, opensimplex, trimesh, viser, moorpy
```

Python 3.13. No Blender, no GPU dependency.

## User Preferences

- **Package management**: `uv add` only, never `pip install`
- **Always ask before installing** any package
- **Language**: French for discussion, English for code/docs
- **Plan mode**: User prefers to discuss and iterate before approving plans

## Next Steps (not yet implemented)

1. **Mooring redesign**: Grid of individual stations (anchor + cable + buoy + cameras) instead of giant net
2. **Wave/current simulation**: MoorPy for static, MoorDyn for dynamic (waves)
3. **Camera coverage**: Raycasting from camera positions against reef mesh
4. **Energy budget**: Solar panels on buoys, battery capacity vs camera power consumption
5. **Viser enhancements**: Interactive placement of mooring points, depth readout on click
6. **Infinigen templates**: Generate coral meshes on remote server, use as visual assets locally
