"""Simulation interactive d'un ancrage à câble enrouleur.

MuJoCo pour la physique (câble, drag, flottabilité).
Viser pour la visualisation temps réel dans le navigateur.

Usage :
    python -m coral_sim.anchor_sim config.yaml
"""

from __future__ import annotations

import math
import time
from typing import Any

import mujoco
import numpy as np
import trimesh
import viser

from .terrain import load_config


# ── Génération du modèle MuJoCo XML ──────────────────────────────────────────


def generate_mujoco_xml(config: dict[str, Any]) -> str:
    """Génère le XML MuJoCo pour le système ancrage + câble + dispositif."""
    cable = config.get("cable", {})
    device = config.get("device", {})
    env = config.get("environment", {})
    current = config.get("current", {})

    depth = env.get("depth", 15)
    slope_deg = env.get("slope", 0)
    cable_diam = cable.get("diameter", 0.01)
    cable_mass_per_m = cable.get("mass_per_meter", 0.5)
    cable_cd = cable.get("Cd", 1.2)
    n_seg = cable.get("n_segments", 20)
    device_mass = device.get("mass", 20)
    float_radius = (device.get("float_volume", 0.04) * 3 / (4 * math.pi)) ** (1/3)
    float_mass = device.get("float_mass", 8)
    current_speed = current.get("speed", 0.3)
    current_dir_deg = current.get("direction", 0)

    seg_len = depth / n_seg
    seg_mass = cable_mass_per_m * seg_len
    half_seg = seg_len / 2

    wind_x = current_speed * math.cos(math.radians(current_dir_deg))
    wind_y = current_speed * math.sin(math.radians(current_dir_deg))

    # Floor rotation for slope
    xml = f"""<mujoco model="anchor_station">
  <option gravity="0 0 -9.81" density="1025" viscosity="0.001"
          wind="{wind_x:.3f} {wind_y:.3f} 0" timestep="0.001">
    <flag gravity="enable"/>
  </option>

  <default>
    <geom rgba="0.5 0.5 0.5 1"/>
    <joint damping="20" stiffness="50"/>
  </default>

  <asset>
    <texture name="floor_tex" type="2d" builtin="checker" rgb1="0.2 0.3 0.4" rgb2="0.1 0.2 0.3" width="256" height="256"/>
    <material name="floor_mat" texture="floor_tex" texrepeat="10 10"/>
    <material name="cable_mat" rgba="0.9 0.9 0.2 1"/>
    <material name="anchor_mat" rgba="1 0.2 0.2 1"/>
    <material name="device_mat" rgba="0.2 0.8 0.3 1"/>
  </asset>

  <worldbody>
    <!-- Seafloor -->
    <geom name="floor" type="plane" size="5 5 0.1" pos="0 0 {-depth}"
          euler="{slope_deg} 0 0" material="floor_mat"/>

    <!-- Water surface (collision plane, invisible, blocks from below) -->
    <geom name="water_surface" type="plane" size="10 10 0.01" pos="0 0 0"
          euler="180 0 0" rgba="0 0 0 0" contype="1" conaffinity="1"/>

    <!-- Anchor -->
    <geom name="anchor" type="cylinder" size="0.15 0.05" pos="0 0 {-depth + 0.1}" material="anchor_mat" mass="100"/>

    <!-- Cable segments -->
"""

    # Build chain of segments
    indent = "    "
    for i in range(n_seg):
        if i == 0:
            z_offset = -depth + seg_len / 2  # premier segment part du fond
        else:
            z_offset = seg_len  # chaque segment suivant est relatif au parent
        xml += f"""{indent}<body name="seg_{i}" pos="0 0 {z_offset:.3f}">
{indent}  <joint name="j_{i}" type="ball"/>
{indent}  <geom name="cable_{i}" type="capsule" size="{cable_diam/2:.4f} {half_seg:.3f}"
{indent}        material="cable_mat" mass="{seg_mass:.3f}"
{indent}        fluidshape="ellipsoid" fluidcoef="{cable_cd} 0.2 0.8 0.8 0.4"/>
"""
        indent += "  "

    # Device at the top
    xml += f"""{indent}<body name="device" pos="0 0 {seg_len:.3f}">
{indent}  <joint name="j_device" type="ball"/>
{indent}  <geom name="device_body" type="box" size="0.15 0.15 0.15" material="device_mat"
{indent}        mass="{device_mass}" fluidshape="ellipsoid" fluidcoef="1.5 0.3 1.0 1.0 0.5"/>
{indent}  <geom name="float" type="sphere" size="{float_radius:.3f}" pos="0 0 0.25"
{indent}        rgba="1 0.8 0 0.8" mass="{float_mass}"
{indent}        fluidshape="ellipsoid" fluidcoef="0.5 0.1 0.5 0.5 0.2"/>
{indent}</body>
"""

    # Close all body tags
    for i in range(n_seg):
        indent = indent[:-2]
        xml += f"{indent}</body>\n"

    xml += """  </worldbody>
</mujoco>
"""
    return xml


# ── App Viser ─────────────────────────────────────────────────────────────────


def run_anchor_sim(config: dict[str, Any]):
    """Lance la simulation interactive dans le navigateur."""
    sim_cfg = config.get("anchor_sim", {})
    port = sim_cfg.get("port", 8080)

    # Générer et charger le modèle MuJoCo
    xml = generate_mujoco_xml(sim_cfg)
    model = mujoco.MjModel.from_xml_string(xml)
    data = mujoco.MjData(model)

    n_seg = sim_cfg.get("cable", {}).get("n_segments", 20)
    depth = sim_cfg.get("environment", {}).get("depth", 15)

    # IDs des bodies
    device_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, "device")
    seg_ids = []
    for i in range(n_seg):
        bid = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, f"seg_{i}")
        seg_ids.append(bid)

    # Simuler quelques pas pour stabiliser
    for _ in range(5000):
        mujoco.mj_step(model, data)

    print(f"Simulation initialisée ({n_seg} segments, {depth}m)")

    # ── Viser ──
    server = viser.ViserServer(host="0.0.0.0", port=port)
    server.scene.set_background_image(np.full((1, 1, 3), [10, 20, 40], dtype=np.uint8))

    # GUI
    with server.gui.add_folder("Environment"):
        current_slider = server.gui.add_slider("Current speed (m/s)", min=0, max=3, step=0.05, initial_value=0.3)
        current_dir = server.gui.add_slider("Current direction (°)", min=0, max=360, step=5, initial_value=0)
        wave_h = server.gui.add_slider("Wave height Hs (m)", min=0, max=5, step=0.1, initial_value=0)
        wave_t = server.gui.add_slider("Wave period T (s)", min=4, max=15, step=0.5, initial_value=8)
        wave_freq_text = server.gui.add_text("Wave freq", initial_value="—")

    with server.gui.add_folder("Cable"):
        damping_slider = server.gui.add_slider("Joint damping", min=0.1, max=50, step=0.5, initial_value=5)
        stiffness_slider = server.gui.add_slider("Joint stiffness", min=1, max=200, step=1, initial_value=30)

    with server.gui.add_folder("Winch"):
        ascent_speed = server.gui.add_slider("Ascent speed (m/min)", min=0.5, max=10, step=0.5, initial_value=2.0)
        winch_btn = server.gui.add_button("Start / Stop Winch")
        winch_status = server.gui.add_text("Winch", initial_value="Stopped")

    with server.gui.add_folder("Display"):
        speed_slider = server.gui.add_slider("Playback speed", min=0.1, max=5, step=0.1, initial_value=1.0)
        show_current_field = server.gui.add_checkbox("Current field (arrows)", initial_value=True)
        show_particles = server.gui.add_checkbox("Current particles", initial_value=True)
        show_forces = server.gui.add_checkbox("Force vectors", initial_value=False)
        reset_btn = server.gui.add_button("Reset")
        pause_btn = server.gui.add_button("Pause / Resume")

    with server.gui.add_folder("Status"):
        angle_text = server.gui.add_text("Cable angle", initial_value="—")
        device_depth_text = server.gui.add_text("Device depth", initial_value="—")
        cable_len_text = server.gui.add_text("Cable deployed", initial_value="—")
        anchor_force_text = server.gui.add_text("Anchor force", initial_value="—")

    # Seafloor mesh
    floor_size = 3.0
    floor_mesh = trimesh.creation.box([floor_size * 2, floor_size * 2, 0.02])
    floor_mesh.apply_translation([0, 0, -depth])
    floor_mesh.visual.vertex_colors = np.full((len(floor_mesh.vertices), 4), [60, 80, 100, 200], dtype=np.uint8)
    server.scene.add_mesh_trimesh("floor", floor_mesh)

    # Water surface (semi-transparent)
    surface_mesh = trimesh.creation.box([floor_size * 2, floor_size * 2, 0.01])
    surface_mesh.visual.vertex_colors = np.full((len(surface_mesh.vertices), 4), [80, 140, 200, 60], dtype=np.uint8)
    server.scene.add_mesh_trimesh("surface", surface_mesh)

    # Anchor sphere
    anchor_mesh = trimesh.creation.icosphere(radius=0.15)
    anchor_mesh.apply_translation([0, 0, -depth + 0.1])
    anchor_mesh.visual.vertex_colors = np.full((len(anchor_mesh.vertices), 4), [255, 50, 50, 255], dtype=np.uint8)
    server.scene.add_mesh_trimesh("anchor", anchor_mesh)

    paused = False
    winch_active = False

    @reset_btn.on_click
    def _(_ev):
        mujoco.mj_resetData(model, data)
        for _ in range(5000):
            mujoco.mj_step(model, data)

    @pause_btn.on_click
    def _(_ev):
        nonlocal paused
        paused = not paused

    @winch_btn.on_click
    def _(_ev):
        nonlocal winch_active
        winch_active = not winch_active
        winch_status.value = "Running ▲" if winch_active else "Stopped"

    # Dynamic handles
    cable_handles = []
    device_handle = None
    arrows_handle = None
    particles_handle = None
    force_handles = []

    # Current field particles (drift with the current)
    n_particles = 150
    particle_domain = 2.5  # half-size of domain around cable
    particle_pos = np.column_stack([
        np.random.uniform(-particle_domain, particle_domain, n_particles),
        np.random.uniform(-particle_domain, particle_domain, n_particles),
        np.random.uniform(-depth, 0, n_particles),
    ]).astype(np.float32)

    # Winch state
    winch_pull_force = 0.0

    print(f"\nServeur Viser → http://localhost:{port}")
    print("Ctrl+C pour arrêter\n")

    last_current = -1.0
    last_dir = -1.0
    last_damping = -1.0
    last_stiffness = -1.0
    frame = 0

    try:
        while True:
            # ── Update MuJoCo params from GUI ──
            if current_slider.value != last_current or current_dir.value != last_dir:
                last_current = current_slider.value
                last_dir = current_dir.value
                model.opt.wind[0] = last_current * math.cos(math.radians(last_dir))
                model.opt.wind[1] = last_current * math.sin(math.radians(last_dir))

            if damping_slider.value != last_damping:
                last_damping = damping_slider.value
                model.dof_damping[:] = last_damping
            if stiffness_slider.value != last_stiffness:
                last_stiffness = stiffness_slider.value
                model.jnt_stiffness[:] = last_stiffness  # stiffness reste sur jnt

            # Wave frequency display
            wave_freq_text.value = f"{1.0/wave_t.value:.3f} Hz | λ={1.56*wave_t.value**2:.0f} m"

            # ── Physics steps ──
            if not paused:
                n_steps = max(1, int(speed_slider.value * 10))
                cur_dir_rad = math.radians(current_dir.value)

                for _ in range(n_steps):
                    data.xfrc_applied[:] = 0

                    # Houle
                    if wave_h.value > 0:
                        t = data.time
                        T = wave_t.value
                        H = wave_h.value
                        wl = 1.56 * T * T
                        for bid in seg_ids + [device_id]:
                            z = data.xpos[bid][2]
                            if z < 0:
                                u = (math.pi * H / T) * math.exp(2 * math.pi * z / wl) * math.cos(2 * math.pi * t / T)
                                # Morison-style force along current direction
                                data.xfrc_applied[bid][0] += u * 80 * math.cos(cur_dir_rad)
                                data.xfrc_applied[bid][1] += u * 80 * math.sin(cur_dir_rad)

                    # Winch: pull the device downward (simulates reeling in)
                    if winch_active:
                        pull = ascent_speed.value / 60.0 * 200  # force proportionnelle à la vitesse
                        data.xfrc_applied[device_id][2] -= pull

                    mujoco.mj_step(model, data)

            # ── Extract state ──
            cable_pts = [[0, 0, -depth + 0.1]]  # anchor
            for sid in seg_ids:
                cable_pts.append(data.xpos[sid].copy().tolist())
            device_pos = data.xpos[device_id].copy()
            cable_pts.append(device_pos.tolist())
            cable_pts = np.array(cable_pts, dtype=np.float32)

            # Cable angle
            dx, dy = device_pos[0], device_pos[1]
            dz = device_pos[2] - (-depth)
            horiz = math.sqrt(dx*dx + dy*dy)
            cable_angle = math.degrees(math.atan2(horiz, abs(dz))) if abs(dz) > 0.01 else 0

            # Cable length (sum of segment distances)
            cable_length = sum(np.linalg.norm(cable_pts[i+1] - cable_pts[i]) for i in range(len(cable_pts)-1))

            # ── Update cable viz ──
            for h in cable_handles:
                h.remove()
            cable_handles = []
            for i in range(len(cable_pts) - 1):
                color = (50, 255, 50) if cable_angle < 10 else (255, 255, 50) if cable_angle < 20 else (255, 50, 50)
                h = server.scene.add_spline_catmull_rom(
                    f"cable/seg_{i}",
                    positions=cable_pts[i:i+2],
                    color=color,
                    line_width=3.0,
                )
                cable_handles.append(h)

            # ── Update device viz ──
            if device_handle is not None:
                device_handle.remove()
            dev_mesh = trimesh.creation.icosphere(radius=0.15)
            dev_mesh.apply_translation(device_pos)
            dev_mesh.visual.vertex_colors = np.full((len(dev_mesh.vertices), 4), [50, 255, 100, 255], dtype=np.uint8)
            device_handle = server.scene.add_mesh_trimesh("device", dev_mesh)

            # ── Current + wave field arrows (animated every 3 frames) ──
            if frame % 3 == 0 and show_current_field.value:
                if arrows_handle is not None:
                    arrows_handle.remove()

                # Grille 3D de points
                gx = np.linspace(-2, 2, 5)
                gy = np.linspace(-2, 2, 5)
                gz = np.linspace(-depth, -0.5, max(2, int(depth / 3)))
                grid = np.array(np.meshgrid(gx, gy, gz)).reshape(3, -1).T

                # Courant statique
                cur_speed = current_slider.value
                cur_vec = np.array([
                    cur_speed * math.cos(cur_dir_rad),
                    cur_speed * math.sin(cur_dir_rad),
                    0,
                ])

                # Houle (vitesse orbitale animée, dépend de z et t)
                t_sim = data.time
                T = wave_t.value
                H = wave_h.value
                wl = 1.56 * T * T

                # Vitesse orbitale par point de la grille
                z_arr = grid[:, 2]
                u_horiz = np.zeros(len(grid))
                u_vert = np.zeros(len(grid))
                if H > 0:
                    amp = (math.pi * H / T)
                    decay = np.exp(2 * math.pi * z_arr / wl)
                    phase = 2 * math.pi * t_sim / T
                    # Composante horizontale (dans la direction du courant)
                    u_horiz = amp * decay * np.cos(phase + grid[:, 0] * 0.5)
                    # Composante verticale (mouvement orbital)
                    u_vert = amp * decay * np.sin(phase + grid[:, 0] * 0.5)

                # Vecteur total = courant + houle
                dirs = np.zeros_like(grid)
                dirs[:, 0] = (cur_vec[0] + u_horiz * math.cos(cur_dir_rad)) * 0.4
                dirs[:, 1] = (cur_vec[1] + u_horiz * math.sin(cur_dir_rad)) * 0.4
                dirs[:, 2] = u_vert * 0.4  # mouvement vertical des vagues

                ends = grid + dirs
                pts = np.stack([grid, ends], axis=1).astype(np.float32)

                # Couleur : bleu pour le courant, plus clair si vagues
                magnitudes = np.linalg.norm(dirs, axis=1)
                max_mag = max(magnitudes.max(), 0.01)
                intensity = (magnitudes / max_mag * 155 + 100).astype(np.uint8)
                colors = np.column_stack([
                    np.full(len(grid), 80, dtype=np.uint8),
                    intensity,
                    np.full(len(grid), 255, dtype=np.uint8),
                ])

                arrows_handle = server.scene.add_arrows(
                    "current_field", pts, colors,
                    shaft_radius=0.008, head_radius=0.025, head_length=0.04,
                )
            elif not show_current_field.value and arrows_handle is not None:
                arrows_handle.remove()
                arrows_handle = None

            # ── Current + wave particles (drift every frame) ──
            if show_particles.value:
                cur_vec_full = np.array([
                    current_slider.value * math.cos(cur_dir_rad),
                    current_slider.value * math.sin(cur_dir_rad),
                    0,
                ], dtype=np.float32)

                # Drift du courant
                particle_pos += cur_vec_full * 0.03

                # Mouvement orbital des vagues (sur chaque particule)
                if wave_h.value > 0:
                    t_sim = data.time
                    T_w = wave_t.value
                    H_w = wave_h.value
                    wl_w = 1.56 * T_w * T_w
                    amp_w = (math.pi * H_w / T_w) * 0.02  # scale pour le déplacement
                    decay_w = np.exp(2 * math.pi * particle_pos[:, 2] / wl_w)
                    phase_w = 2 * math.pi * t_sim / T_w + particle_pos[:, 0] * 0.5
                    particle_pos[:, 0] += amp_w * decay_w * np.cos(phase_w) * math.cos(cur_dir_rad)
                    particle_pos[:, 1] += amp_w * decay_w * np.cos(phase_w) * math.sin(cur_dir_rad)
                    particle_pos[:, 2] += amp_w * decay_w * np.sin(phase_w)  # mouvement vertical

                # Recycle particles that leave the domain
                out = (np.abs(particle_pos[:, 0]) > particle_domain) | \
                      (np.abs(particle_pos[:, 1]) > particle_domain) | \
                      (particle_pos[:, 2] > 0)
                particle_pos[out, 0] = np.random.uniform(-particle_domain, particle_domain, out.sum())
                particle_pos[out, 1] = np.random.uniform(-particle_domain, particle_domain, out.sum())
                particle_pos[out, 2] = np.random.uniform(-depth, 0, out.sum())

                if particles_handle is not None:
                    particles_handle.remove()
                colors_p = np.full((n_particles, 3), [80, 160, 220], dtype=np.uint8)
                particles_handle = server.scene.add_point_cloud(
                    "particles", particle_pos, colors_p, point_size=0.03,
                )
            elif particles_handle is not None:
                particles_handle.remove()
                particles_handle = None

            # ── Force vectors on cable nodes ──
            if show_forces.value and frame % 5 == 0:
                for h in force_handles:
                    h.remove()
                force_handles = []
                force_pts = []
                force_colors = []
                for bid in seg_ids:
                    f = data.xfrc_applied[bid][:3]
                    f_mag = np.linalg.norm(f)
                    if f_mag > 0.1:
                        origin = data.xpos[bid].copy()
                        end = origin + f * 0.05  # scale forces for visibility
                        force_pts.append([origin, end])
                        # Color by magnitude
                        intensity = min(1, f_mag / 100)
                        force_colors.append([
                            int(255 * intensity),
                            int(255 * (1 - intensity)),
                            50,
                        ])
                if force_pts:
                    pts_arr = np.array(force_pts, dtype=np.float32)
                    col_arr = np.array(force_colors, dtype=np.uint8)
                    fh = server.scene.add_arrows(
                        "forces", pts_arr, col_arr,
                        shaft_radius=0.008, head_radius=0.02, head_length=0.03,
                    )
                    force_handles.append(fh)
            elif not show_forces.value:
                for h in force_handles:
                    h.remove()
                force_handles = []

            # ── Status ──
            angle_text.value = f"{cable_angle:.1f}°" + (" ⚠" if cable_angle > 15 else " ✓")
            device_depth_text.value = f"{-device_pos[2]:.1f} m"
            cable_len_text.value = f"{cable_length:.1f} m"

            frame += 1
            time.sleep(1/30)

    except KeyboardInterrupt:
        print("\nArrêt du serveur.")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m coral_sim.anchor_sim <config.yaml>")
        sys.exit(1)

    config = load_config(sys.argv[1])
    run_anchor_sim(config)
