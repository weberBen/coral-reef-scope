# Explored Solutions -- Coral Reef Scope

Summary of all approaches considered, tested, or adopted for the reef and coral simulation.

---

## 1. Mooring Simulation

### 1.1 Verlet 2D -- Discrete Elements (HTML)

**File**: `reef-mooring-sim.html`
**Status**: Implemented (2D prototype)

- Verlet integrator with distance constraints (iterative relaxation, 18 passes)
- Cable = chain of N inextensible nodes, anchor fixed to the seabed
- Forces: buoyancy, drag (Morison normal + tangential), Airy wave theory, surface wind
- Tensions computed by top-down accumulation (quasi-static)
- Current profiles: linear, uniform, surface-concentrated
- Winch (deployment / reeling)
- Limitation: 2D only, no 3D directional currents

**References**:
- Airy wave theory (orbital velocities in deep water)
- Morison equation (normal drag Cd=1.2 + tangential Cf=0.1)

### 1.2 MoorPy -- Static Equilibrium

**File**: `coral_sim/mooring.py`
**Status**: Implemented

- Loads a MoorDyn v2 file (.dat) via MoorPy
- Solves static equilibrium (catenary solver)
- Extracts positions for visualization in Viser
- MoorDyn format = industry standard (NREL / OpenFAST)
- Used for a network of 4 anchors, 4 buoys, 1 central point, 12 lines

**References**:
- MoorPy (NREL) -- static catenary solver
- MoorDyn v2 -- standard file format for mooring systems

### 1.3 MuJoCo -- 3D Dynamic Simulation

**File**: `coral_sim/anchor_sim.py`
**Status**: Implemented (current version)

- Chain of rigid bodies (capsules) connected by ball joints
- MuJoCo gravity enabled, external forces via `xfrc_applied`:
  - Buoyancy (per segment, vectorized NumPy)
  - Hydrodynamic drag (Morison, normal/tangential components)
  - Waves (Airy orbital velocities, depth-dependent)
  - Wind (surface, 3% of wind speed rule)
  - Winch (PD control of cable length)
- Cable materials: polyester, nylon, Dyneema, steel
- Configurable intermediate floats
- Tensions by top-down accumulation (same as HTML prototype)
- Real-time visualization in Viser with interactive GUI

**References**:
- MuJoCo (DeepMind) -- multi-body physics engine
- Morison equation for drag on cylinders

### 1.4 Tools Mentioned but Not Implemented

| Tool | Description | Reason for Not Using |
|------|-------------|----------------------|
| **MoorDyn** (dynamic) | Dynamic mooring line simulation (NREL) | Planned for later; MoorPy is sufficient for statics |
| **Project Chrono** | Multi-physics engine (fluid-structure) | Too heavy for prototyping |
| **OrcaFlex** | Commercial offshore simulation software | Paid license, out of scope |
| **OpenFAST** | Offshore wind turbine simulation (NREL) | Too specialized for wind turbines, but compatible MoorDyn format |

---

## 2. Coral Generation

### 2.1 DLA -- Diffusion-Limited Aggregation

**Commit**: `d0c0c27` (feat: add support for differential growth)
**Status**: Abandoned

- Library `dlacorals` (Bakels et al. 2024, UvA/VU Amsterdam)
- 3D grid, seeds at the bottom, random walk with drift
- Contact aggregation with solar bias (`sun_vec`)
- Result: binary grid --> marching cubes --> trimesh
- Two colony types:
  - **Branching** (Pocillopora, Acropora): classic DLA
  - **Massive** (Porites): OpenSimplex-noised sphere
- Placement on terrain via Poisson-disk sampling + depth filtering

**Why abandoned**: too slow, unstable, hard to control at reef scale (km)

**References**:
- Bakels et al. (2024) -- dlacorals, DLA model for coral morphology (University of Amsterdam)
- Witten & Sander (1981) -- Diffusion-Limited Aggregation, original model

### 2.2 Differential Growth

**Commit**: `d0c0c27` (feat: add support for differential growth)
**Status**: Explored, abandoned

- Mesh growth technique where edges subdivide and nodes repel each other
- Produces organic shapes (undulations, folds) similar to foliose corals
- Combined with DLA in the same commit

**Why abandoned**: numerical instability, prohibitive computation time for thousands of colonies

**References**:
- Nervous System (Jessica Rosenkrantz & Jesse Louis-Rosenberg) -- differential growth for biological shape generation
- IAAC Blog (Institute for Advanced Architecture of Catalonia) -- applications in computational design
- Inconvergent (Anders Hoff) -- artistic implementations of differential growth

### 2.3 Infinigen

**Status**: Explored, abandoned

- Procedural natural scene generator (Princeton)
- Includes high-quality coral assets
- Problems: requires Python 3.11 + Blender, cannot import custom depth maps
- Residual idea: generate coral meshes on a remote server, use them as visual assets locally

**Why abandoned**: incompatible with Python 3.13, Blender dependency too heavy, no API for integrating custom terrain

**References**:
- Infinigen (Raistrick et al., Princeton 2023) -- "Infinite Photorealistic Worlds using Procedural Generation"

### 2.4 KJMA -- Kolmogorov-Johnson-Mehl-Avrami (adopted)

**File**: `coral_sim/colony.py`
**Status**: Implemented (current version)

- Analytical model of crystallization/competitive growth
- Seeds distributed by depth zone (configurable density)
- Each seed has a growth speed = f(light, slope, current)
- Ellipsoidal growth (configurable anisotropy)
- Vertex attribution: each point --> fastest seed to reach it (ellipsoidal distance)
- Natural boundaries through competition (first to arrive wins)
- Terrain deformation: parabolic profile + troughs at boundaries
- Vectorized NumPy computation, chunked to limit RAM (~5s for 54K vertices x 2000 seeds)

**Why adopted**: analytical (no iteration), fast, controllable, suited for km scale

**References**:
- Kolmogorov (1937) -- "On the statistical theory of the crystallization of metals"
- Johnson & Mehl (1939) -- "Reaction kinetics in processes of nucleation and growth"
- Avrami (1939-1941) -- series of 3 papers on transformation kinetics

### 2.5 Other Approaches Discussed (Not Implemented)

| Approach | Description | Relevance |
|----------|-------------|-----------|
| **Reaction-Diffusion** (Turing) | Patterns via Gray-Scott / FitzHugh-Nagumo systems | Generates 2D patterns (texture), not 3D shapes |
| **L-systems** | Formal grammars for branching structures | Good for individual branching corals, not for an entire reef |
| **Eden Model** | Random growth on a grid (neighbor aggregation) | Too simple, no morphological control |
| **Morphogens** | Chemical gradients guiding growth | Computationally expensive (PDE), better suited for biological research |
| **FEM (Finite Elements)** | Mechanical simulation of skeletal growth | Too fine-grained for an entire reef |

---

## 3. Terrain / Bathymetric Data

### 3.1 Allen Coral Atlas (adopted)

**File**: `coral_sim/terrain/allen.py`

- Public WFS (geomorphic + benthic layers)
- Rasterization via Shapely STRtree
- Depth approximated by mapping zone names to typical depths
- No real bathymetry (classification only)
- Local request cache

**References**:
- Allen Coral Atlas (allencoralatlas.org) -- worldwide satellite-based reef mapping

### 3.2 Procedural Terrain (adopted)

**File**: `coral_sim/terrain/procedural.py`

- Rectangular zones with spline profiles (distance/depth control points)
- Rugosity via fBm (fractional Brownian Motion) using OpenSimplex
- Multi-zone, configurable

### 3.3 Sketchfab Photogrammetry (legacy)

**File**: `reef_3d.py`

- Download of 3D scanned models (Structure-from-Motion)
- Models used: REXCOR (Marseille), Cousteau Reserve (Guadeloupe)
- Plotly 3D visualization
- Abandoned in favor of Viser (more interactive, Python-driven)

**References**:
- Sketchfab -- 3D model platform (underwater photogrammetry)
- Septentrion Environnement -- REXCOR model
- Sea(e)scape -- Guadeloupe model

---

## 4. Visualization

| Solution | Status | Notes |
|----------|--------|-------|
| **Viser** (adopted) | Implemented | Python --> WebSocket --> Three.js, port 8080 |
| **Plotly** | Legacy (`reef_3d.py`) | Static HTML, no real-time control |
| **Pure Three.js** | Explored | Better shaders (hover contour lines), but too much custom JS |
| **MapLibre** | Explored | Displayed the island instead of the reef (satellite tiles) |

---

## 5. Summary of Final Choices

| Component | Adopted Solution | Tested Alternatives |
|-----------|-----------------|---------------------|
| **Mooring simulation** | MuJoCo 3D + Viser | Verlet 2D (HTML), MoorPy (static) |
| **Coral growth** | Anisotropic KJMA | DLA (dlacorals), Differential Growth, Infinigen |
| **Terrain** | Allen Coral Atlas + procedural | -- |
| **Visualization** | Viser | Plotly, Three.js, MapLibre, Sketchfab |
| **Mooring format** | MoorDyn v2 (.dat) | -- |
