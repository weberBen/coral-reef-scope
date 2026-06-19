# ReefScope -- Full Architecture & Technical Reference

Comprehensive documentation of the ReefScope project: autonomous coral reef monitoring system simulator, presentation deck, mooring physics, photogrammetric coverage analysis, and terrain generation.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Python Backend -- Terrain & Simulation](#3-python-backend)
4. [Mooring-Sim Web Application](#4-mooring-sim-web-application)
5. [Presentation Deck](#5-presentation-deck)
6. [3D Mooring Simulation](#6-3d-mooring-simulation)
7. [Photogrammetric Coverage](#7-photogrammetric-coverage)
8. [Theming System (Dark/Light)](#8-theming-system)
9. [Internationalization (FR/EN)](#9-internationalization)
10. [Terrain Generation Pipeline](#10-terrain-generation-pipeline)
11. [Coral Colony Generation (KJMA)](#11-coral-colony-generation)
12. [Explored Solutions & Alternatives](#12-explored-solutions)
13. [Configuration Reference](#13-configuration-reference)
14. [Dependencies & Setup](#14-dependencies--setup)
15. [Commands Reference](#15-commands-reference)

---

## 1. Project Overview

ReefScope is a concept for autonomous coral reef monitoring where sensors:
1. Are anchored at the seabed, capturing images continuously (~24h battery)
2. Detach and rise to the surface by buoyancy
3. Transit to shore (autonomous navigation or passive drift)
4. Transmit data via radio, get collected, cleaned, recharged
5. A fresh sensor descends to replace it

The project includes:
- **Presentation deck**: Apple-style scroll-driven pitch (Concept tab)
- **3D mooring simulation**: Real-time physics with Three.js + custom shaders (Simulation tab)
- **Coverage analysis**: 3D reef mesh with viewshed computation and contour lines (Coverage tab)
- **Python terrain pipeline**: Allen Coral Atlas data + procedural generation + KJMA coral growth

---

## 2. Repository Structure

```
coral-reef-scope/
    config.yaml                         # All parameters (terrain, colony, mooring, viz)
    pyproject.toml                      # Python deps (uv)
    run.py                              # Quick launcher for terrain + viz
    reef_export.py                      # Standalone GLB export from GPS coordinates
    reef_3d.py                          # Legacy Sketchfab/Plotly viewer
    reef_3d.html                        # Legacy 3D HTML viewer
    reef-mooring-sim.html               # 2D Verlet mooring prototype (standalone)
    ARCHITECTURE.md                     # This file
    EXPLORED_SOLUTIONS.md               # All approaches tried/abandoned/adopted
    LLM.md                              # LLM context file
    README.md                           # Quick start guide

    coral_sim/                          # Python modules
        __init__.py
        __main__.py                     # CLI entry point
        terrain/
            __init__.py                 # get_terrain(), load_config(), resolve_path()
            io.py                       # TerrainData dataclass + .npz + .glb export
            allen.py                    # Allen Coral Atlas WFS fetcher + rasterizer
            procedural.py              # Procedural terrain (spline profiles + fBm)
        colony.py                       # KJMA anisotropic coral growth
        mooring.py                      # MoorPy static mooring analysis
        anchor_sim.py                   # MuJoCo 3D dynamic mooring simulation + Viser GUI
        viz.py                          # Viser 3D terrain/reef visualization

    mooring-sim/                        # Vite web application
        index.html                      # Entry point, tab bar, toggle buttons
        vite.config.js
        package.json
        src/
            main.js                     # App bootstrap, theme/lang init, animation loop
            style.css                   # Global styles + CSS theme variables
            presentation.css            # Deck/slide styles + light theme overrides
            presentation.js             # Deck HTML generation (i18n), hero particles, cycle scroll
            scene.js                    # Three.js scene setup (simulation tab)
            shaders.js                  # GLSL vertex/fragment shaders for water surface
            objects.js                  # 3D objects (water, seabed, cable, device, floats, particles)
            physics.js                  # Mooring physics engine (forces, integration, tensions)
            params.js                   # Simulation parameters (P object)
            ui.js                       # lil-gui panels + readout updates
            coverage.js                 # Coverage tab (GLB loader, viewshed, contour lines, GUI)
            tabs.js                     # Tab switching logic
            theme.js                    # Dark/light theme state, 3D color palettes
            i18n.js                     # FR/EN translations, locale management
            export.js                   # OBJ export for simulation

        coverage-web-test/              # Standalone coverage prototype
            public/
                index.html
                js/                     # allen.js, app.js, kjma.js, map-picker.js, viewer.js
            server.js / server.ts / serve.py

    data/                               # Generated files (gitignored)
        terrain.npz                     # Depth map
        reef.glb                        # Terrain mesh with metadata
        mooring.dat                     # MoorDyn format
    cache/                              # WFS request cache
```

---

## 3. Python Backend

### TerrainData (io.py)

Central dataclass shared across all modules:

```python
@dataclass
class TerrainData:
    heightmap: np.ndarray       # 2D depth array (positive = deeper)
    x_coords: np.ndarray        # 1D longitude-like coordinates
    y_coords: np.ndarray        # 1D latitude-like coordinates
    resolution: float           # degrees/pixel or meters/pixel
    source: str                 # "allen" or "procedural"
    metadata: dict              # bbox, resolution_deg, etc.
    geomorphic_geojson: dict    # raw Allen WFS data (optional)
    benthic_geojson: dict       # raw Allen WFS data (optional)
```

Serialized to `.npz` (NumPy compressed). Exported to `.glb` via trimesh with glTF extras (label, bbox, GPS coordinates).

### GLB Export

`io.py:export_glb()` converts TerrainData to a triangulated mesh via trimesh, then injects metadata into the glTF JSON chunk (custom binary patching of the GLB file). The GLB extras are read by the coverage viewer to display reef label, GPS coordinates, and compute real-world distances.

### Anchor Simulation (anchor_sim.py)

MuJoCo-based 3D mooring simulation with Viser GUI:
- Chain of rigid capsules connected by ball joints
- External forces via `xfrc_applied`: buoyancy, Morison drag, Airy waves, wind
- Vectorized NumPy force computation
- Top-down tension accumulation
- PD-controlled winch (deploy/retract cable)
- Interactive GUI: current, waves, wind, cable material, floats

---

## 4. Mooring-Sim Web Application

Single-page Vite app with 3 tabs:

### Tab Architecture

```
index.html
    #tab-bar (fixed)
        [Concept] [Simulation] [Coverage] [FR] [theme toggle]
    #tab-concept    --> presentation.js builds innerHTML
    #tab-simulation --> Three.js canvas + lil-gui + readouts
    #tab-coverage   --> Three.js canvas + lil-gui + contour lines
```

`tabs.js` handles switching. Coverage is lazy-loaded (init on first visit). Simulation pauses when leaving its tab, resumes on return. Coverage rendering pauses similarly.

### Build & Dev

```bash
cd mooring-sim
bun install  # or npm install
bun dev      # Vite dev server on localhost:5173
bun run build  # Production build
```

---

## 5. Presentation Deck

**File**: `presentation.js` + `presentation.css`

Apple-style scroll-driven presentation with animated sections:

### Sections (in scroll order)
1. **Hero**: Title "ReefScope", particle canvas, ripple scroll cue
2. **Problem**: 3 problem cards (fixed cameras, drones, power/impact)
3. **Transition**: "What if we flipped the problem?"
4. **Solution**: APAC acronym with blur-reveal animation
5. **Cycle diagram**: Sticky SVG with 4 scroll-triggered phases:
   - Phase 1: Deep capture (scan cone animation)
   - Phase 2: Automatic ascent (rising device + bubbles)
   - Phase 3: Surface transit (radio waves, data transmission)
   - Phase 4: Replacement & collection (new sensor, collection net)
6. **Evolution**: 3 phase cards (boat recovery, automated collection, sensor swarm)
7. **Mapping**: Split layout with photogrammetry illustration SVG
8. **Comparison table**: Grid with color-coded scores (gc-1 to gc-9)
9. **CTA**: Buttons to launch simulation / coverage

### Scroll Mechanics
- `IntersectionObserver` (threshold 0.15) triggers `.reveal.visible` class
- Staggered delays via `.d1`, `.d2`, `.d3` classes
- Lenis smooth scroll wraps `#tab-concept`
- Cycle diagram uses sticky positioning + phase observer (threshold 0.3)
- `updateCyclePhase()` toggles SVG group opacity (active=1, past=0.55, future=0)

### Hero Particles
Canvas 2D animation: 80 particles drifting upward with cyan tint. Paused when hero section is not visible (IntersectionObserver).

### SVG Diagram Colors
All SVG fills/strokes use CSS custom properties (`var(--cyan)`, `var(--orange)`, etc.) for theme adaptation. Device fills use `.cy-device-fill` class. Ocean gradients use `.cy-ocean-top`/`.cy-ocean-bot` CSS classes on `<stop>` elements.

---

## 6. 3D Mooring Simulation

**Files**: `scene.js`, `objects.js`, `shaders.js`, `physics.js`, `params.js`, `ui.js`

### Scene Setup (scene.js)
- Three.js WebGLRenderer with ACES filmic tone mapping
- Gradient background via CanvasTexture (4-stop vertical gradient)
- FogExp2 for underwater depth effect
- Lighting: ambient + hemisphere + directional sun (with shadows) + caustic point light + seabed fill
- OrbitControls with damping

### Water Surface (shaders.js)
Custom GLSL ShaderMaterial:
- **Vertex**: Multi-harmonic wave displacement (main wave + 2 harmonics + cross-swell)
- **Fragment**: Fresnel-based color mixing between deep/surface/horizon colors (theme uniforms), sun specular (power 256), sky reflection, foam on crests
- Color uniforms (`uDeepColor`, `uSurfColor`, `uHorizColor`) updated on theme switch

### Objects (objects.js)
- **Water**: 200x200 PlaneGeometry, 128x128 segments, ShaderMaterial
- **Seabed**: PlaneGeometry with procedural sandy texture (canvas) + animated caustic lightmap
- **Anchor**: BoxGeometry base + CylinderGeometry winch drum + side flanges
- **Cable**: N CylinderGeometry segments, positioned/oriented per frame, colored by force magnitude (green -> yellow -> red via smoothstep lerp)
- **Device**: Box body + sphere lens + torus ring + battery strip + orange float sphere
- **Intermediate floats**: Up to 8 SphereGeometry with equatorial torus bands
- **Force arrows**: ArrowHelper for anchor, device, floats, cable drag samples
- **Current arrows**: 8 ArrowHelper showing current profile at different depths
- **Particles**: 400 plankton points (drifting) + 60 bubble points (rising)
- **Vertical reference**: Dashed line from anchor to surface

### Physics (physics.js)
- Semi-implicit Euler integration at 60 Hz fixed timestep
- Forces per cable segment: gravity, buoyancy, Morison drag (normal + tangential), wave orbital velocities, wind
- Current profiles: linear, uniform, surface-concentrated
- Winch: PD controller adjusting cable length toward target
- Tensions: top-down accumulation from device to anchor
- Safety factor: MBL / max tension

### Cable Force Coloring
```js
const LOW  = new THREE.Color('#34d399'); // green (low force)
const MID  = new THREE.Color('#fbbf24'); // yellow (mid force)
const HIGH = new THREE.Color('#ef4444'); // red (high force)
// Smooth Hermite interpolation (no discontinuity)
const t = frac * frac * (3 - 2 * frac);
mesh.material.color.lerpColors(lerpColors(LOW,MID,t), lerpColors(MID,HIGH,t), t);
```

### GUI (ui.js)
lil-gui panels: Deployment, Environment, Cable, Device & Floats, Display, Actions. All labels translated via `t()` from i18n. Auto-demo loop: deploy -> wait -> retract -> repeat.

### Readouts
12 real-time values: depth, height, excursion, angle, tensions (max, anchor V/H/total), MBL, safety factor, cable deployed, speed. Status badge: OK (green) / WARNING (yellow).

---

## 7. Photogrammetric Coverage

**File**: `coverage.js`

### GLB Loading
- GLTFLoader loads `data/reef.glb`
- Mesh rotated -90deg X (Y-up to Z-up), centered, scaled to ~10 units
- Vertex colors from depth colormap (theme-dependent: CMAP_DARK / CMAP_LIGHT)
- Metadata extracted from glTF extras (label, bbox, GPS)
- Camera positioned via PCA of depth-weighted face centers (optimal viewing angle)

### Depth Colormaps
Two 14-stop colormaps (dark/light), selected by `isDark()`:
- Dark: yellow -> green -> cyan -> blue -> indigo (warm-to-cool)
- Light: similar but brighter/lighter tones
- Applied as per-vertex RGB colors on MeshPhongMaterial

### Viewshed Coverage (R2 Angular Sweep)
For each camera position:
1. Compute azimuth + elevation angle to every precomputed face center
2. Sort by azimuth bin (360 bins), then by distance
3. Sweep near-to-far per bin, tracking max elevation (horizon)
4. Face visible if elevation exceeds current horizon
5. Adjacent bin spillover (terrain has width)

No raycasting -- pure angular geometry. ~15-50ms per computation.

### Ascent Coverage (Photogrammetric)
Simulates camera ascending from anchor to surface in 10 steps:
- Downward FOV cone at each altitude
- GSD computation: `altitude * 2 * tan(fov/2) / sensor_pixels`
- Turbidity: visibility range decreases with depth
- "Useful" coverage = GSD <= threshold AND within visibility range

### Coverage Tint
Visible faces tinted with `#ff0000` (pure red) at 85% blend over base depth color.

### Contour Lines (True Plane-Mesh Intersection)
Real geometric contour extraction:
1. For each Y level, iterate all triangles
2. Find edges that cross the Y plane (sign change test)
3. Interpolate intersection points on crossing edges
4. Create `THREE.LineSegments` from segment pairs

Pre-built at initialization for all levels (subtle lines, opacity 0.15) + bright active line (opacity 0.8). Animation cycles through levels. Hover pauses animation and shows contour at cursor depth.

**Performance**: Segments pre-computed at build time. Animation only toggles `.visible` -- zero geometry allocation per frame.

### GUI
lil-gui panels: Camera (range, sensor res, GSD max, Z exag), Contours (nb lines, depth slider, play/pause), Optimization (nb cameras, optimize greedy, clear all).

### Greedy Optimization
1. Sample ~100 candidate positions from face centers
2. For each candidate, compute viewshed (new area visible, excluding already covered)
3. Pick candidate with max new area
4. Repeat for N cameras
5. Batched with `setTimeout(0)` yields to avoid UI freeze

### Auto-Demo
Cycles: place 3-6 random cameras -> wait -> clear -> optimize -> show result -> clear -> repeat. Saves/restores `state.numCameras` to not overwrite user slider.

---

## 8. Theming System

**Files**: `theme.js`, `style.css` (variables), `presentation.css` (overrides)

### CSS Custom Properties
~30 variables defined on `:root` (dark default) and overridden on `.light-theme`:

| Category | Dark | Light |
|----------|------|-------|
| Backgrounds | `#030d1a` to `#0a1628` | `#ffffff` to `#f1f5f9` |
| Text | `#e4eef6` to `#3a5a72` | `#0f172a` to `#94a3b8` |
| Panels | `rgba(5,15,30,0.92)` | `rgba(255,255,255,0.95)` |
| Borders | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.08)` |
| Accents | `#38bdf8` (cyan), `#f97316` (orange) | `#0284c7`, `#ea580c` |

### Anti-Flash
Inline `<script>` in `<head>` (before CSS) applies `.light-theme` class from localStorage immediately.

### 3D Scene Theme (scene.js)
`getSceneColors()` returns theme-specific values:
- `clearColor`, `fogColor`, `fogDensity`
- `bgStops` (4-stop gradient)
- `waterDeep`, `waterSurf`, `waterHoriz` (shader uniforms)

`updateSceneTheme()` called on toggle:
- Updates fog, clear color
- Recreates background CanvasTexture (dispose old, create new -- fixes GPU cache issue)
- Updates water shader uniforms
- Updates seabed material color (`0x8B7355` dark / `0xd4b896` light)

### Coverage Theme
`getCoverageColors()` returns clear color, background, grid colors. `updateCoverageTheme()` rebuilds grid helper + repaints depth map vertex colors + rebuilds contour lines (with theme-appropriate line color: white on dark, dark blue on light -- currently unified to white).

### Toggle
Moon/sun SVG icons in tab bar. `toggleTheme()` flips class on `<html>`, saves to `localStorage('rs-theme')`, fires callbacks. Icons synced via `syncThemeIcons()`.

---

## 9. Internationalization

**File**: `i18n.js`

### Architecture
- `localStorage('rs-lang')`, default `'fr'`
- `t(key)` returns translated string from current locale
- `toggleLang()` saves to localStorage and calls `location.reload()` (simplest approach, avoids complex DOM rebuild)
- Static HTML elements use `data-i18n` attributes, applied at startup
- Presentation deck uses `t()` in template literals, rebuilt on reload
- lil-gui labels use `t()` at construction time

### Coverage
~120 translation keys covering: tabs, hero, problem cards, transition, solution, cycle phases, evolution phases, mapping, comparison table, CTA, simulation readouts, simulation GUI, coverage stats, coverage GUI, SVG labels.

### French Text Quality
All French strings include proper accents: récif, système, caméra, côtier, flottabilité, résolution, déviation, paramètres, déployer, réinitialiser, etc.

---

## 10. Terrain Generation Pipeline

### Allen Coral Atlas (allen.py)
1. WFS request to `allencoralatlas.org` for geomorphic + benthic layers within bbox
2. Cache responses locally (JSON)
3. Build Shapely STRtree from polygons
4. Rasterize: for each grid cell, query STRtree for containing polygon
5. Map zone class name to typical depth (e.g., "Reef Crest" -> 0.5m, "Deep Lagoon" -> 15m)
6. Output: TerrainData with heightmap + raw GeoJSON

### Procedural (procedural.py)
1. Define rectangular reef zones with spline depth profiles
2. For each zone: `profile = [(distance_from_edge, depth), ...]` -> CubicSpline
3. Compute signed distance to zone boundary for each pixel
4. Interpolate depth via spline
5. Add fBm rugosity (OpenSimplex noise, multi-octave) inside reef zones only
6. Outside all zones: flat seabed depth

### GLB Export
```bash
uv run python -m coral_sim.terrain --lat -17.4894 --lon -149.8268 --radius 4 \
  --label "Moorea Nord" --location "Polynesie francaise" -o mooring-sim/data/reef.glb
```

---

## 11. Coral Colony Generation

**File**: `colony.py`

KJMA (Kolmogorov-Johnson-Mehl-Avrami) anisotropic growth model:

1. Scatter seeds by depth zone (configurable density per depth band)
2. Each seed has growth speed = f(light, slope, current):
   - Light: decays with depth (`exp(-decay * depth)`)
   - Slope: zero growth above `max_slope` degrees
   - Current: boost factor for current-facing faces
3. Ellipsoidal growth (anisotropy parameter: 1=sphere, 2=2:1 ellipsoid)
4. For each vertex, compute ellipsoidal distance to all seeds
5. Assign vertex to the seed that reaches it first
6. Boundaries form naturally through competition
7. Deform terrain mesh along vertex normals (parabolic profile + boundary troughs)

Computation: vectorized NumPy, chunked to limit RAM. ~5s for 54K vertices x 2000 seeds.

---

## 12. Explored Solutions

See `EXPLORED_SOLUTIONS.md` for full details. Summary:

| Component | Adopted | Tried & Abandoned |
|-----------|---------|-------------------|
| Mooring simulation | MuJoCo 3D + Three.js | Verlet 2D (HTML), MoorPy (static only) |
| Coral growth | Anisotropic KJMA | DLA (dlacorals), Differential Growth, Infinigen |
| Terrain | Allen Coral Atlas + procedural | Sketchfab photogrammetry |
| Visualization (Python) | Viser | Plotly, MapLibre |
| Visualization (Web) | Three.js + Vite | -- |
| Mooring format | MoorDyn v2 (.dat) | -- |

---

## 13. Configuration Reference

`config.yaml` sections:

| Section | Key | Description |
|---------|-----|-------------|
| `data_dir` | -- | Base directory for all I/O (default: `./data/`) |
| `terrain.source` | `allen` / `procedural` | Terrain data source |
| `terrain.output` | `terrain.npz` | Output file (relative to data_dir) |
| `terrain.allen.bbox` | `[lon_min, lat_min, lon_max, lat_max]` | Geographic bounding box |
| `terrain.allen.resolution` | `0.0003` | Degrees per pixel (~33m) |
| `terrain.procedural.zones` | list | Reef zones with spline profiles |
| `colony.kjma.*` | various | Growth speed, anisotropy, weights |
| `colony.placement.zones` | list | Seed density per depth band |
| `colony.ram_limit` | `500` | Max MB for KJMA matrix |
| `mooring.file` | `mooring.dat` | MoorDyn v2 file |
| `anchor_sim.port` | `8080` | Viser server port |
| `viz.z_exaggeration` | `5` | Vertical exaggeration factor |

---

## 14. Dependencies & Setup

### Python
```bash
uv sync  # Install all Python deps
```

Dependencies: `numpy`, `scipy`, `pyyaml`, `requests`, `shapely`, `opensimplex`, `trimesh`, `viser`, `moorpy`, `moordyn`, `mujoco`

Python >= 3.13. No Blender, no GPU dependency.

### Web (mooring-sim)
```bash
cd mooring-sim
bun install  # or npm install
bun dev      # Dev server on localhost:5173
```

Dependencies: `three`, `lil-gui`, `lenis` (smooth scroll), `vite` (build), `playwright` (testing)

---

## 15. Commands Reference

```bash
# -- Python terrain pipeline --
uv run python -m coral_sim.terrain config.yaml       # Generate terrain from config
uv run python -m coral_sim.terrain \                  # Direct from GPS
  --lat -17.4894 --lon -149.8268 --radius 4 \
  --label "Moorea Nord" -o mooring-sim/data/reef.glb
uv run python -m coral_sim.viz config.yaml            # Viser 3D viewer
uv run python run.py config.yaml                      # Terrain + viz in one

# -- MuJoCo anchor simulation --
uv run python -m coral_sim.anchor_sim config.yaml     # Viser GUI on port 8080

# -- Web app --
cd mooring-sim
bun dev                                                # Dev server
bun run build                                          # Production build

# -- Testing (Playwright) --
cd mooring-sim
bunx playwright open --device="iPhone 13" --browser=webkit http://localhost:5173
bunx playwright open --viewport-size=1366,768 --browser=chromium http://localhost:5173
```
