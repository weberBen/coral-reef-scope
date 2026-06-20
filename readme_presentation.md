# ReefScope: Autonomous Coral Reef Monitoring

## Part I: The System

### The problem with underwater monitoring today

Every existing approach to coral reef monitoring forces a trade-off between cost, risk, and coverage.

**Fixed cameras** suffer from biofouling within weeks. Cleaning and maintaining them requires sending divers down repeatedly, indefinitely. Operational expenditure scales with time, not with insight.

**Underwater drones** introduce collision risk with the very ecosystem they're meant to observe. Controlling a vehicle in turbulent water near fragile coral structures remains an unsolved engineering problem at scale. R&D costs are high. Failure modes are destructive.

**Permanent infrastructure** (subsea cables, solar buoy arrays, shore-linked platforms) delivers reliable power and data. But it imposes a physical footprint on the reef: cables crossing the seabed, buoys cluttering the surface, anchor blocks on the substrate. The visual and ecological impact is non-trivial. These systems are expensive to install, expensive to expand, and expensive to decommission. They do not scale.

The table below summarizes how current solutions compare across three axes that matter at scale: naturalness (how little the system disrupts the site), operational cost, and scalability.

| Criterion | Subsea Cable | Solar Buoys | ReefOS | **ReefScope** |
|---|---|---|---|---|
| **Naturalness** | 0.4, cable crossing the reef, seabed infrastructure | 0.1, permanent surface buoys | 0.2, concentrated but permanent platform | **0.65**, seabed anchor, temporary buoy |
| **OPEX** | 0.4, divers for biofouling + cable upkeep | 0.3, divers for biofouling + panel upkeep | 0.3, divers + platform + WiFi mesh | **0.6**, onshore cleaning, limited seabed maintenance |
| **Scalability** | 0.1, linear cost, expensive to expand | 0.4, deployable but per-unit maintenance | 0.3, high cost per station, heavy monitoring | **0.6**, eventually zero seabed installation |

*Scores are qualitative estimates on a 0-1 scale. They reflect our current assessment and would benefit from rigorous benchmarking against field data.*

### What if the sensors came to us?

ReefScope inverts the maintenance problem. Instead of sending divers to service fixed equipment, the equipment services itself.

The operational cycle has four phases:

**Phase 1: Deep capture.** A sensor device is anchored at the seabed, camera active. It captures images continuously for the full duration of its battery, roughly 24 hours. No intervention is needed. The device sits near the bottom, attached to a mooring cable, scanning the reef.

**Phase 2: Automatic ascent.** When the battery is depleted, the device detaches from its mooring and rises slowly by buoyancy. The ascent is passive and gradual: no propulsion, no sudden movement. The cable stays in place. The buoy at the surface is only visible temporarily. During ascent, downward-facing cameras capture the reef at increasing altitudes, producing a multi-scale image set usable for photogrammetric 3D reconstruction.

**Phase 3: Surface transit and data transmission.** Once at the surface, the device drifts toward shore or navigates in a straight line (trivial algorithm: aim for the coast, no underwater intelligence required). Captured data is transmitted by radio to a shore station. The transmission delay is approximately 24 hours from capture to reception.

**Phase 4: Replacement and collection.** A fresh, charged sensor is dispatched from shore to the buoy and descends to dock at the mooring cable. The spent sensor is recovered: either by boat during periodic rounds (Phase 1 of deployment), by a passive coastal collection net (like a floating anti-pollution barrier), or by catapult relaunch from a shore station (Phase 2). The old sensor is cleaned, recharged, and returned to the pool.

### Three phases toward full autonomy

The system is designed to be deployed incrementally:

**Phase 1: Boat recovery.** Sensors rise and float. A boat collects them during periodic rounds. GPS on each sensor. Infrastructure is minimal. This validates the concept.

**Phase 2: Automated collection.** Two variants depending on site and budget. *Active*: straight-line navigation to shore, coastal recharging station, catapult relaunch toward buoys. *Passive*: natural drift, sensors float, current brings them to shore, a coastal collection net recovers them without intervention.

**Phase 3: Sensor swarm.** Paradigm shift. Produce many low-resolution sensors rather than few high-resolution ones. Drop them by drone with a slow tumbling descent (robust to wind, precise placement, no parachute). Cost concentrates entirely on mass production. Reef coverage scales linearly with the number of sensors produced. Zero permanent infrastructure.

*References for tumbling descent: TumblerBots (arXiv 2410.23049). For drone-deployed coral restoration: Ramsby 2026, Restoration Ecology.*

### Why asynchronous is not a compromise, it's the right model

The core design decision behind ReefScope is that a 24-hour asynchronous delay between capture and delivery is not merely acceptable. It is the appropriate temporal resolution for reef monitoring.

Coral reefs operate on timescales of weeks, months, and years. A bleaching event unfolds over days to weeks. Algal overgrowth progresses over months. Recovery after a cyclone takes years. In this context, seeing a fish swim past a coral head in real time adds almost no analytical value compared to seeing the same fish 12 hours later. The reef itself is still there. The fish can be observed with hours of offset and the ecological information is identical.

Real-time streaming from reef cameras satisfies a desire to see what is happening *right now*. It feels like being there. But the analysis workflow is asynchronous regardless: marine biologists review footage in batches, run classification models offline, compare time series across days or weeks. The live feed is rarely the unit of analysis. The value is in the archive.

The argument for real-time is strongest when it enables *gamification*: letting the public watch a living reef, creating engagement through the organic rarity and unpredictability of what appears on screen. This is real value. But it requires permanent infrastructure (power, data link, bandwidth), which conflicts directly with the naturalness and scalability goals. And the same sense of rarity and discovery can be recreated with asynchronous feeds: curated highlights, time-delayed "live" windows, push notifications when something unusual is detected. The emotional impact of seeing a manta ray glide past a coral outcrop is not diminished by the fact that it happened six hours ago. The reef is largely inaccessible to most people. There is no way to "break the latency" by physically going there, the way you might spoil a TV show by reading ahead.

The deeper point is this: the goal is to design sensors that are smaller, cheaper, lower quality individually, shorter on battery life, but deployed in large quantities. This requires minimizing support infrastructure. Every cable, every solar panel, every permanent buoy is a dependency that limits where and how many sensors you can deploy. Asynchronous operation eliminates the need for continuous power and continuous data links. It makes the system deployable on any reef, anywhere, with nothing more than a shore station and a box of sensors.

For sites where real-time monitoring is scientifically or operationally critical (marine protected areas under active threat, research stations studying spawning events), a small number of positions can maintain a synchronous feed via traditional infrastructure. ReefScope does not replace these installations. It extends coverage to the vast majority of reef area where no monitoring exists today because no one can justify the infrastructure cost.

---

## Part II: Under the Hood

### Mooring Simulation

The sensor hangs from a mooring cable anchored to the seabed. Understanding how this cable behaves under ocean forces (current, waves, wind) determines whether the device stays in its field of view, whether the cable survives, and whether the anchor holds. This is the core engineering question for the physical system.

#### What the simulation models

The simulation represents the mooring cable as a chain of rigid segments connected by joints, with the anchor fixed to the seabed and the device attached at the end. At each timestep, the following forces are computed on every segment:

**Buoyancy.** Archimedes' principle applied per segment. Each segment displaces a volume of seawater and experiences an upward force proportional to that volume. Intermediate floats and the device itself have their own buoyancy contributions. Cable materials have different densities: Dyneema (975 kg/m3) floats, steel (7850 kg/m3) sinks, nylon (1140 kg/m3) and polyester (1380 kg/m3) are intermediate.

**Hydrodynamic drag.** The Morison equation decomposes drag into normal and tangential components relative to each cable segment. Normal drag coefficient is 1.2 (standard for cylindrical bodies in cross-flow). Tangential drag uses a skin friction coefficient of approximately 0.31 (0.1 * pi). Drag force scales with the square of the relative velocity between the water and the segment.

**Wave orbital velocities.** Airy linear wave theory computes the orbital velocity field as a function of depth, wave height, and wave period. This adds a time-varying, depth-dependent velocity component to the water flow experienced by each segment. Near the surface, orbital velocities are large and circular. At depth, they decay exponentially.

**Current profile.** Three configurable depth profiles: linear (maximum at surface, zero at seabed), uniform, or surface-concentrated. Direction is adjustable. Wind-induced current is applied in the top two meters.

**Wind.** Direct wind drag on the device when near the surface, using air density and a drag coefficient of 0.9.

**Cable tension.** Computed by top-down force accumulation, starting from the device, summing all forces body by body down to the anchor. This gives the tension at every point along the cable, the vertical and horizontal components of the anchor load, and the safety factor relative to the cable's Minimum Breaking Load (MBL).

The simulation runs in real time at 60 frames per second (browser) or at 1 ms timesteps (MuJoCo backend), with configurable parameters: cable diameter (3-24 mm), cable material, device mass (2-60 kg), net buoyancy (10-400 N), number of intermediate floats, site depth (10-60 m), current speed (0-2.5 m/s), wave height (0-4 m), wave period (3-14 s), and wind speed (0-25 m/s).

#### What we explored and why we chose this approach

We built and tested three simulation backends before settling on the current stack:

**Verlet 2D (HTML prototype).** A position-based dynamics integrator with inextensible distance constraints, iteratively relaxed over 18-20 passes per frame. Cable as a chain of N nodes. All forces computed manually. This was the first prototype: fast, interactive, sufficient for intuition. Limited to 2D, no directional current, no 3D cable geometry.

**MoorPy (NREL), static catenary solver.** Loads industry-standard MoorDyn v2 files and solves static equilibrium. Useful for validating multi-anchor configurations (4 anchors, 4 buoys, 12 lines). No dynamics, cannot simulate wave response or transient behavior.

**MuJoCo 3D dynamic simulation.** The current full-fidelity backend. Chain of rigid capsules connected by ball joints, with all forces applied as external wrenches. MuJoCo's implicit integrator handles the constraint dynamics. Visualization via Viser (Python to WebSocket to Three.js). This gives 3D directional current and wave response, joint limits, and accurate tension computation.

The browser simulation (Simulation tab) uses the Verlet approach adapted to Three.js for accessibility: anyone can run it without installing Python or MuJoCo. It is explicitly labeled as a simplified model for preliminary sizing. The MuJoCo backend is used for deeper analysis.

*Tools we considered but did not implement: MoorDyn dynamic (NREL), planned for future validation. Project Chrono, too heavy for prototyping. OrcaFlex, commercial license, out of scope. OpenFAST, specialized for wind turbines, though its MoorDyn format is compatible with ours.*

*References: Morison equation for hydrodynamic drag on cylinders. Airy linear wave theory for orbital velocities. MuJoCo (DeepMind) for multi-body physics. MoorPy / MoorDyn v2 (NREL) for mooring line standards.*

#### The simulation gap

There is no end-to-end, plug-and-play simulation tool for prototyping underwater mooring systems at the scale and iteration speed that early-stage hardware development requires. Industry tools (OrcaFlex, Orcina, Project Chrono) are designed for certified offshore engineering: precise, validated, and slow to set up. Research tools (MoorPy, MoorDyn) solve specific subproblems well but do not integrate into a rapid prototyping loop.

What we need, and what does not yet exist, is a tool that lets you go from "I want to test a 10mm Dyneema cable at 15m depth in 0.5 m/s current with 1.5m swell" to a force envelope and safety factor in seconds, sweep parameters, and compare ten configurations side by side before building anything. Then export the result to a validated tool for certification.

In the short term, this gap is manageable. The real-world forces in calm to moderate conditions (the typical operating envelope for reef monitoring) are well-understood and the engineering is not extreme. A 10mm cable at 15m depth under 0.3 m/s current is a tractable problem, and trial and error on a real site will converge faster than waiting for a perfect simulation tool.

But at scale, deploying hundreds of stations across dozens of reefs with varying bathymetry, current patterns, and wave exposure, the inability to simulate in parallel becomes a bottleneck. You cannot test alternative anchor geometries, cable routing strategies, or float configurations across 50 sites simultaneously without simulation. This is a long-term investment, not a short-term blocker, but it is a real gap in the current ecosystem.

### Coverage Analysis

The Coverage tab answers a different question: given a set of sensor positions on a reef, how much of the reef surface can they actually see?

#### What it computes

The system loads a real reef mesh (GLB format, generated from Allen Coral Atlas bathymetric data for a specific GPS location, e.g. Moorea Nord). Each triangle of the mesh is a "face" with a known position, area, and orientation.

**Ground coverage (viewshed).** For each camera position, the algorithm computes which reef faces are visible. This is done without ray tracing. Instead, it uses an angular sweep approach:

1. For each camera, compute the azimuth angle and elevation angle to every face center within visibility range.
2. Sort faces by azimuth bin (360 bins, 1-degree resolution), then by distance within each bin (nearest first).
3. Sweep each bin from near to far, tracking the maximum elevation angle seen so far (the "horizon"). A face is visible only if its elevation angle exceeds the current horizon. If it does, it becomes visible and raises the horizon, occluding faces behind it.

This produces correct terrain occlusion (a ridge between the camera and a valley hides the valley) without the computational cost of per-face ray casting. The vertical field of view is bounded: 45 degrees below horizontal, 30 degrees above.

**Surface coverage (photogrammetric).** During ascent, the camera faces downward. At each altitude step (10 steps from anchor to surface), the algorithm computes which faces fall within the downward FOV cone, are within effective visibility range (which decreases with depth due to turbidity), and have an acceptable Ground Sample Distance (GSD). GSD is computed from altitude, FOV, and sensor resolution: `GSD = (altitude * 2 * tan(FOV/2) / sensor_pixels)`. Faces with GSD exceeding the configured maximum (default: 10 mm/px) are excluded from "useful" coverage.

**Greedy optimization.** The system can automatically place cameras to maximize coverage. It evaluates ~100 candidate positions (subsampled from face centers), computes the marginal coverage gain of each, places a camera at the best position, then repeats. This greedy approach does not guarantee optimality but produces good results quickly and interactively.

**Indicators displayed:**
- *Cameras*: number of anchored stations.
- *Ground coverage*: percentage of reef surface visible from bottom cameras (viewshed with terrain occlusion).
- *Surface coverage*: total surface seen during ascent (downward camera, all altitudes, accounting for turbidity).
- *Mean GSD*: average ground sample distance, i.e. the spatial resolution of the imagery. Increases with altitude, depends on sensor specs.

#### Why mesh granularity matters, and how we grow corals

The coverage computation is only as good as the mesh it runs on. A coarse mesh (few large triangles) will report artificially high coverage because it cannot represent the small-scale terrain features (overhangs, crevices, coral heads) that create occlusion in the real world. A mesh that is too detailed will not load or render in a browser.

This creates a fundamental tension: accurate coverage estimation requires fine-grained 3D geometry of the reef surface, which requires modeling coral structures at a resolution that matters for occlusion (centimeters to tens of centimeters).

We explored several approaches to generating realistic coral geometry:

**Diffusion-Limited Aggregation (DLA).** Random walk of particles that stick on contact, producing branching structures resembling Acropora and Pocillopora. We tested the `dlacorals` library (Bakels et al. 2024, University of Amsterdam). Results were visually plausible but too slow and numerically unstable for reef-scale generation (thousands of colonies across kilometers of terrain).

**Differential Growth.** A mesh technique where edges subdivide and nodes repel each other, producing organic undulations and folds similar to foliose corals. Beautiful results. Prohibitive computation time and numerical instability when applied to thousands of colonies simultaneously.

**Infinigen (Princeton, 2023).** A procedural natural scene generator with high-quality coral assets. Requires Python 3.11 and Blender as a dependency, incompatible with our Python 3.13 stack and too heavy for integration.

**KJMA, Kolmogorov-Johnson-Mehl-Avrami (adopted).** An analytical model originally developed for metal crystallization kinetics (Kolmogorov 1937, Johnson & Mehl 1939, Avrami 1939-1941). Seeds are scattered across the terrain surface, each with a growth speed modulated by local conditions:

- *Light*: exponential decay with depth (`exp(-decay_rate * depth)`). Shallow corals grow faster.
- *Slope*: linear penalty. Flat surfaces are favorable; steep walls less so.
- *Current*: boost proportional to alignment between the surface normal and the current direction. Current-facing surfaces receive more nutrients.

Each seed grows an anisotropic ellipsoid (configurable elongation ratio). Every vertex on the terrain mesh is assigned to the seed whose ellipsoid reaches it first. Boundaries between colonies form naturally where two expanding fronts meet, the first to arrive wins. The mesh is then deformed: parabolic bumps at colony centers, troughs at competitive boundaries.

This runs in approximately 5 seconds for 54,000 vertices and 2,000 seeds on commodity hardware, fully vectorized in NumPy. It produces reef-scale geometry with realistic colony distribution, competitive boundaries, and depth-dependent morphology, all without iteration or numerical instability.

The coverage computation runs on this enriched mesh. The coral structures create the small-scale occlusion that makes coverage estimation meaningful. Without them, the terrain is essentially smooth bathymetry, and any camera position reports near-100% coverage, which is not reality.

This is also why photogrammetry matters for reef monitoring: the fine-scale 3D structure of the reef is precisely what determines ecological health (structural complexity correlates with fish diversity, resilience, and recovery potential), and it is precisely what cannot be captured from a single viewpoint. Multiple viewpoints at multiple altitudes, assembled by photogrammetry, are the minimum requirement for a useful 3D reconstruction.

#### Choices we made for the browser

The reef mesh loaded in the Coverage tab is deliberately simplified: reduced polygon count to keep loading times under a few seconds and rendering smooth at 60 fps on typical hardware. The Z-axis is exaggerated (default: 12x) to make depth features visible in the 3D view. Contour lines are computed by plane-mesh intersection at configurable depth intervals, with one animated "active" contour sweeping through the depth range. Depth is color-coded using a perceptually optimized colormap with 14 stops, different for light and dark themes.

These are trade-offs. A production coverage analysis tool would use the full-resolution mesh, run the viewshed on a GPU, and integrate real turbidity and light attenuation models. What we have is a working prototype that gives correct qualitative results and lets you interact with the problem (place cameras, see what they cover, optimize placement, understand the relationship between station count and coverage) in a browser, on any device.

---

## Compromises and Convictions

This project is built on deliberate compromises. The simulation uses simplified physics. The coverage model uses approximated occlusion. The coral growth algorithm is analytical rather than biophysical. The comparison scores in the table above are qualitative estimates, not validated benchmarks. All of this needs more rigorous testing, field validation, and iteration.

We are comfortable with these compromises because the underlying model (sensors that cycle autonomously between seabed and surface, requiring no permanent power or data infrastructure underwater) is sound at the physics level. The forces involved in a 15-meter mooring under moderate tropical conditions are well within the envelope of standard marine engineering. The photogrammetric reconstruction workflow is proven technology. The asynchronous data model is not a limitation but a design choice aligned with the timescales of the ecosystems being observed.

What we are not comfortable compromising on is infrastructure.

The long-term goal is to eliminate *all* permanent underwater infrastructure, including the mooring cable and the surface buoy. Every cable trailing from an anchor, every buoy bobbing at the surface, sends a signal: this ecosystem cannot exist without our scaffolding. It encloses the reef rather than letting it grow. It frames the natural world as something that needs to be wired up, plugged in, kept on life support.

Discreet sensors that attach to nothing, disturb nothing, and cycle through on their own, that tells a different story. It says: this reef is so vast, so complex, that we can only sample it. We are not controlling it. We are not instrumenting it. We are watching, as quietly as we can, and trying to keep up.

That is the signal we want to send.
