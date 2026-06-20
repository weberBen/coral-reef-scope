# ReefScope: Autonomous Coral Reef Monitoring

## Part I: The System

### The problem with underwater monitoring today

Every existing approach to coral reef monitoring forces a trade-off between cost, risk, and coverage.

**Fixed cameras** suffer from biofouling within weeks. Cleaning and maintaining them requires sending divers down repeatedly, indefinitely. Operational expenditure scales with time, not with insight.

**Underwater drones** require full 3D navigation in water, which is fundamentally hard for the same reasons 3D navigation in air is hard: six degrees of freedom, turbulent flow, no fixed reference frame. Doing this near fragile coral structures adds collision risk on top. R&D costs are high. Failure modes are destructive.

**Permanent infrastructure** (subsea cables, solar buoy arrays, shore-linked platforms) delivers reliable power and data. But it imposes a physical footprint on the reef: cables crossing the seabed, buoys cluttering the surface, anchor blocks on the substrate. The visual and ecological impact is non-trivial. These systems are expensive to install, expensive to expand, and expensive to decommission. They do not scale.

The table below is a thinking framework, not a benchmark. The scores are qualitative, not quantitative. They reflect how we reason about trade-offs across three axes: naturalness (how little the system disrupts the site), operational cost, and scalability. They are not validated measurements and should not be read as such.

| Criterion | Subsea Cable | Solar Buoys | ReefOS | **ReefScope** |
|---|---|---|---|---|
| **Naturalness** | 0.4, cable crossing the reef, seabed infrastructure | 0.1, permanent surface buoys | 0.2, concentrated but permanent platform | **0.65**, seabed anchor, temporary buoy |
| **OPEX** | 0.4, divers for biofouling + cable upkeep | 0.3, divers for biofouling + panel upkeep | 0.3, divers + platform + WiFi mesh | **0.6**, onshore cleaning, limited seabed maintenance |
| **Scalability** | 0.1, linear cost, expensive to expand | 0.4, deployable but per-unit maintenance | 0.3, high cost per station, heavy monitoring | **0.6**, eventually zero seabed installation |

*These scores are subjective estimates intended to structure the comparison, not to conclude it. The ReefScope column in particular blends the current state (Phases 1-2, which still use permanent cable and anchor) with the target state (Phase 3, zero seabed installation). Rigorous benchmarking against field data is needed before these numbers carry weight.*

### What if the sensors came to us?

ReefScope inverts the maintenance problem. Instead of sending divers to service fixed equipment, the equipment services itself.

The operational cycle has four phases. The anchor assembly on the seabed includes a cable spool. Two designs are being explored: the spool fixed in the anchor at the bottom, or integrated into the mobile assembly itself (self-tracking, self-retaining). In both cases, the principle is the same: the cable holds the sensor and buoy near the seabed when wound, and releases them to the surface when unwound.

**Phase 1: Deep capture.** The cable is wound. The sensor and its buoy are held near the seabed by the spool. The sensor captures images continuously for the full duration of its battery, roughly 24 hours. No intervention is needed. Nothing is visible at the surface.

**Phase 2: Automatic ascent.** When the battery is depleted, the spool unwinds and buoyancy pulls the mobile assembly (sensor + buoy) to the surface. No detachment, no propulsion: the cable pays out and the assembly floats up passively. The ascent is slow and gradual, respecting marine life. During ascent, downward-facing cameras capture the reef at increasing altitudes, producing a multi-scale image set usable for photogrammetric 3D reconstruction.

**Phase 3: Surface transit and data transmission.** Once at the surface, the sensor separates from the buoy and heads for shore. This is not a drone or a submarine: it is a simple motorized float that moves in a straight line at constant speed toward the coast. No 3D navigation, no obstacle avoidance, no underwater intelligence. Captured data is transmitted by radio to a shore station. The transmission delay is approximately 24 hours from capture to reception. The buoy remains at the surface, marking the station for the next sensor.

**Phase 4: Replacement and collection.** A fresh sensor arrives from shore (same principle: simple motorized float, straight line, constant speed). The buoy is designed to absorb a low-speed surface impact, and the collision itself is the docking mechanism. Once the new sensor is attached, the spool rewinds and pulls the entire assembly (sensor + buoy) back to the seabed. Nothing remains visible at the surface. The exchange window (from ascent to full rewinding) takes minutes. The spent sensor is recovered at shore: either by boat during periodic rounds (Phase 1 of deployment), by a passive coastal collection net (like a floating anti-pollution barrier), or by catapult relaunch from a shore station (Phase 2). The old sensor is cleaned, recharged, and returned to the pool.

### Three phases toward full autonomy

The system is designed to be deployed incrementally:

**Phase 1: Boat recovery.** Sensors rise and float. A boat collects them during periodic rounds. GPS on each sensor. Infrastructure is minimal. This validates the concept.

**Phase 2: Automated collection.** Two variants depending on site and budget. *Active*: straight-line navigation to shore, coastal recharging station, catapult relaunch toward buoys. *Passive*: natural drift, sensors float, current brings them to shore, a coastal collection net recovers them without intervention.

**Research direction: sensor swarm.** This is not a planned deployment phase. It is a distant research direction that becomes relevant only if sensor unit cost drops far enough. The idea: produce many low-resolution sensors rather than few high-resolution ones. Sensors are deposited at the water surface (by a small vessel, or catapulted from shore) and sink slowly to the seabed. No cable, no anchor, no spool. They capture for the duration of their battery, then become buoyant and rise to the surface, where they drift toward an offshore collection net (similar to anti-pollution floating barriers) installed around the reef perimeter.

This raises real concerns. Catapulting from shore produces noise and splash near the reef. Sensors sinking through the water column and rising back up in free ascent risk contact with coral structures, particularly in dense reef areas. For this reason, initial testing would target clear, flat zones and use rigid passive reception platforms with wide catchment areas. These platforms require installation but no maintenance, and are designed to blend into the environment over time, unlike cameras or cables that need regular servicing. The collection net is anchored away from the reef itself, with no cable or structure crossing the coral.

Cost in this model concentrates entirely on mass production. Reef coverage scales linearly with the number of sensors produced. But the naturalité argument only holds if the physical interaction between sensors and reef (repeated sinking, rising, occasional snagging) is demonstrated to be benign. This is unproven.

*References: Ramsby 2026, Restoration Ecology (drone-deployed coral restoration monitoring). TumblerBots (arXiv 2410.23049) for slow tumbling descent through fluid.*

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

#### Two tracks: field testing now, simulation later

There is no end-to-end, plug-and-play simulation tool for prototyping underwater mooring systems at the iteration speed that early-stage hardware development requires. Industry tools (OrcaFlex, Orcina, Project Chrono) are designed for certified offshore engineering: precise, validated, and slow to set up. Research tools (MoorPy, MoorDyn) solve specific subproblems well but do not integrate into a rapid prototyping loop. This is a real gap in the ecosystem, but it is not ReefScope's gap to fill. Building such a tool is a separate project entirely, and treating it as a prerequisite would be scope creep.

The short-term track is trial and error on real sites. The real-world forces in calm to moderate conditions (the typical operating envelope for reef monitoring) are well-understood and the engineering is not extreme. A 10mm cable at 15m depth under 0.3 m/s current is a tractable problem. Building a few prototypes, deploying them, and measuring what actually happens will produce usable engineering data faster than waiting for a perfect simulation.

The medium-term track is building a simulation that reproduces field results. Once real-world measurements exist (cable angles, tension readings, anchor loads, drift patterns), a simulation can be calibrated against them and used to explore configurations that would be expensive or slow to test physically. This is valuable for scaling to dozens of reefs with different conditions, but it comes after field data, not before. The simulation we have today (described above) is a first approximation for building intuition and sizing, not a validated engineering tool.

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

## Open Questions

The sections above describe what we've built and the reasoning behind it. This section is about what we haven't solved, what we've deliberately deferred, and where the real risks are. Some of these are next steps. Some are hard problems. None of them are hidden.

### Energy budget

No energy budget figures are provided in this document. This is the number one risk and we know it.

That said, the problem is less dramatic than it sounds. Storing 24 hours of video is not a storage challenge unless you film in 4K. At 1080p with reasonable compression, a full day fits on a modest SD card. The power draw depends on capture strategy: continuous filming is one option, but periodic capture triggered on a timer or by motion detection is another. A sensor that records 10 seconds every 5 minutes produces a fraction of the data and power consumption of continuous capture, while still delivering useful temporal coverage of a largely static scene.

No budget figures are given because the budget depends on choices that haven't been locked yet: device weight, enclosure materials, thermal dissipation, capture resolution, and duty cycle. These are conditioned on the simulation work described above. The mooring simulation determines what the device can weigh and how it behaves; the coverage analysis determines what resolution and angle are needed. The energy budget is the next step once those constraints converge.

### Docking mechanics

The operational cycle requires a fresh sensor to reach the buoy, attach, and descend. This sounds like it reintroduces the precise underwater maneuvering problem criticized earlier, but the mechanics are different. The sensor is a simple motorized float that moves at the surface, in a straight line at constant speed, toward a visible buoy. Not a drone, not a submarine: closer to a radio-controlled boat. No 3D underwater navigation, no obstacle avoidance, no proximity control near coral. The docking itself is impact-based: the buoy is designed so that a low-speed surface collision locks the sensor in place. The cable and buoy absorb the impact. Once docked, the spool rewinds and pulls the assembly back to the seabed.

The impact force matters: it transmits down the cable and could affect the anchor or the cable angle. This needs to be simulated. Higher approach speed means faster turnaround but more force and more noise, which affects marine life around the mooring. This is a simulation target, not a fundamental blocker.

### Biofouling

The 24-hour cycle eliminates biofouling on the optical system, which is the component most sensitive to it. But the cable and anchor stay permanently submerged and will foul over time. The "onshore cleaning" mentioned in the comparison table applies to the sensor only, not to the submerged infrastructure.

Two points here. First, surface biofouling cleaning is drastically simpler than underwater cleaning. Once sensors are collected (eventually automatically) at a single location, they can pass through an autonomous washing station. Even a simple offshore platform with a single power cable driving a high-pressure water pump solves this. Second, the cable and anchor fouling is a real maintenance cost, acknowledged as part of the infrastructure we ultimately want to eliminate (see Phase 3, where there is no cable or anchor at all). In Phases 1 and 2, it's an accepted cost, lower than the alternatives because the frequency and complexity of intervention is reduced.

### Loss rate and failure modes

A sensor that drifts off course can be lost: current, storm, boat traffic, marine life, theft. Each loss is 24 hours of data and one unit of hardware. The passive collection net assumes favorable currents or at least predictable drift patterns. What percentage of sensors is lost per cycle? We don't have a number yet. This is a field measurement, not something we can simulate. It conditions OPEX directly and needs to be quantified during Phase 1 trials with real hardware in real water. If the loss rate is 5%, the economics work. If it's 30%, they don't. We expect the answer depends heavily on site selection (sheltered lagoon vs. exposed outer reef) and on net placement.

### Spatial recalibration between cycles

If a sensor is removed and another takes its place, the new sensor is not in exactly the same position and orientation. The cable constrains location loosely, but there is variance at each redeployment. This matters because the claimed value is temporal comparison: seeing how the same patch of reef changes over weeks and months.

This is a known problem in multi-sensor, multi-pass capture. It is the same problem faced by any repeat photogrammetry survey, any satellite revisit, any drone mapping campaign. Registration and alignment between passes is a solved (though non-trivial) discipline. The photogrammetric reconstruction workflow already handles this: overlapping images from different viewpoints are aligned by feature matching, not by assuming identical camera positions. The passive tumbling descent approach referenced at the end of the presentation (Ramsby 2026) relies on this same principle for coral restoration monitoring.

### Data transfer bandwidth

24 hours of continuous imagery plus photogrammetric capture during ascent represents a significant data volume. Transmitting all of it by radio from a small floating device is not realistic at full resolution. The approach is two-tier: a compressed, degraded version is transmitted by radio while the sensor is still at sea, sufficient for a first assessment and integration into the monitoring pipeline. The full-resolution dataset is recovered physically once the sensor reaches shore, either by collection net or by boat. Post-processing on the full data happens onshore. This means the radio link is not a bottleneck; it's a preview channel.

### Turbidity as a hard ceiling

The coverage analysis penalizes turbidity, but in practice turbidity is closer to a hard cutoff than a gradual penalty. Even in clear tropical water, useful optical imagery is limited to a few meters to a few tens of meters. The coverage percentages reported by the tool are geometric: they compute what is visible assuming ideal water clarity. Real coverage will be lower, potentially much lower.

This means the coverage numbers produced by the tool are not solid enough to draw operational conclusions from directly. They indicate relative differences (this placement is better than that one) more reliably than absolute values (42% of the reef is covered). Grounding these numbers in reality requires a dedicated turbidity simulation layer, and ultimately field validation to confirm or invalidate the model quickly.

The system does not solve the turbidity problem. It is a constraint of optical sensing in water. The mitigation is multi-modal: during the brief ascent phase (once per day, a few minutes), the sensor could run a LiDAR or acoustic sonar pulse. The light or sound only needs to travel a few meters down and back, not the full water column, so effective range is better than surface-based bathymetric surveys. Where turbidity degrades optical capture, the reconstruction can interpolate between high-confidence zones (bottom captures in clear conditions, external survey data from drones or dive teams, or known cartography from previous passes) and partial ascent captures. The coverage tool is designed to help frame this question: given what we know precisely from some zones and what we captured during ascent, how much can we reconstruct, and what remains unknown.

### Sensor swarm feasibility

The sensor swarm concept described earlier is a research direction, not an engineering plan. It abandons the cable and spool mechanism that Phases 1 and 2 rely on, and replaces it with disposable sensors deposited at the surface that sink, capture, rise, and drift to a collection net. The engineering question is not whether this can work in principle. It is whether the physical interaction with the reef is acceptable.

The real tension with the naturalité argument is not the sensors themselves, but the repeated contact: sinking through the water column near coral structures, rising back up in free ascent, occasional snagging or collision. In dense reef areas this is a genuine concern, and it is unsolved. Initial testing would target clear, flat zones with rigid passive reception platforms that have wide catchment. These platforms require installation (subsea anchoring, away from the reef) but no ongoing maintenance, and are designed to blend in over time. This is fundamentally different from cameras, cables, or buoys that require regular servicing to function.

Recovery relies on an offshore collection net deployed around the reef perimeter, anchored at a distance from the reef itself. Drifting sensors accumulate in the net. No cables cross the coral, no buoys sit over the colonies. Installation cost is real, but it is a one-time perimeter setup.

This concept becomes relevant only when sensor unit cost drops far enough that loss rates and simplified logistics outweigh the complexity of per-unit cable-based recovery. Phases 1 and 2 are where the engineering is focused now.

---

## Compromises and Convictions

This project is built on deliberate compromises. The simulation uses simplified physics. The coverage model uses approximated occlusion. The coral growth algorithm is analytical rather than biophysical. The comparison table is a reasoning framework with subjective scores, not a validated benchmark. All of this needs more rigorous testing, field validation, and iteration.

We are comfortable with these compromises because the underlying model (sensors that cycle autonomously between seabed and surface, requiring no permanent power or data infrastructure underwater) is sound at the physics level. The forces involved in a 15-meter mooring under moderate tropical conditions are well within the envelope of standard marine engineering. The photogrammetric reconstruction workflow is proven technology. The asynchronous data model is not a limitation but a design choice aligned with the timescales of the ecosystems being observed.

What we are not comfortable compromising on is infrastructure.

The long-term goal is to eliminate *all* permanent underwater infrastructure: the anchor, the spool, the cable. Every piece of hardware bolted to the seabed sends a signal: this ecosystem cannot exist without our scaffolding. It encloses the reef rather than letting it grow. It frames the natural world as something that needs to be wired up, plugged in, kept on life support.

### What comes after cables

Some directions we think about, without pretending to know which will work.

**Floating fiber optics.** Instead of a rigid cable anchored to the seabed, imagine fiber optic filaments trailing from a sensor like the tentacles of a jellyfish: floating, drifting with the current, providing a data link without rigid attachment. The friction of these filaments with coral structures is an open question. Whether they tangle, abrade, or simply drift clear depends on material, length, current, and reef density. This is speculative. But the principle (soft, passive connectivity instead of rigid infrastructure) is worth exploring.

**Autonomous underwater photography.** Photographing a reef at high resolution can be done by an autonomous underwater vehicle. But the collision avoidance algorithm required to navigate near coral is extremely critical: any contact is destructive, and the failure mode is the thing you're trying to protect. Beyond collision, the noise and physical disturbance of a motorized vehicle moving through the water column affects the ecosystem you're trying to observe. Fish flee. Behavior changes. The observation contaminates the subject.

The closest viable concept is something closer to a jellyfish than a submarine: a system that does not fight the current but follows it, maintaining its position by adjusting its buoyancy and very slightly influencing its trajectory to avoid collision with structures. It does not decide where to go. It drifts, observes, and nudges itself away from obstacles. This is extremely complex to engineer and extremely critical to get right. It is not a near-term project.

**The hybrid fleet.** The final monitoring system will not be one type of sensor. It will be a combination:

- A small number of high-resolution sensors at fixed strategic positions, cable-based, high quality, covering critical zones with precision. These are the anchors of the monitoring network.
- Periodic autonomous mobile sweeps for broad photographic coverage. Underwater vehicles or drift systems that pass through periodically, mapping wide areas at lower frequency.
- Many low-cost, low-resolution sensors that are relatively stationary. They do not navigate. They do not decide where to go. They sit, capture, rise, drift, and get repatriated when they leave the zone.

Repatriation is a design problem, not a physics problem. A passive buoy could carry a sensor across the reef and release it to drift again from the other side. An autonomous surface collector (a simple boat dragging a net) could gather floating sensors periodically and redistribute them to new positions. The fleet recirculates. No individual sensor needs to be smart. The intelligence is in the logistics, not in the unit.

This is the shape of the system we think about. Not a single device doing everything, but a population of devices doing different things at different scales, with the infrastructure cost pushed as close to zero as possible per unit of coverage.

Discreet sensors that attach to nothing, disturb nothing, and cycle through on their own, that tells a different story. It says: this reef is so vast, so complex, that we can only sample it. We are not controlling it. We are not instrumenting it. We are watching, as quietly as we can, and trying to keep up.

That is the signal we want to send.
