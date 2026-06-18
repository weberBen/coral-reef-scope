"""Simulation 3D d'un ancrage à câble enrouleur.

Inspiré de reef-mooring-sim.html, adapté en 3D avec MuJoCo + Viser.

Features :
    - Courants marins avec profil de profondeur (linéaire, uniforme, surface)
    - Houle (vitesses orbitales Airy)
    - Vent en surface
    - Flotteurs intermédiaires configurables
    - Affichage des tensions, forces d'ancrage, coefficient de sécurité
    - Matériaux de câble sélectionnables
    - Mécanisme d'enroulement (treuil)

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


# ── Constantes ────────────────────────────────────────────────────────────────

RHO_W = 1025.0   # densité eau de mer (kg/m³)
RHO_AIR = 1.225   # densité air (kg/m³)
G = 9.81

MATERIALS: dict[str, dict] = {
    "poly":  {"rho": 1380, "sigma": 250e6,  "label": "Polyester (1380 kg/m³)"},
    "nylon": {"rho": 1140, "sigma": 280e6,  "label": "Nylon (1140 kg/m³)"},
    "dyn":   {"rho": 975,  "sigma": 1500e6, "label": "Dyneema (975 — flotte)"},
    "steel": {"rho": 7850, "sigma": 1400e6, "label": "Acier (7850 kg/m³)"},
}

PROFILES: dict[str, str] = {
    "lin":  "Linéaire (→0 au fond)",
    "uni":  "Uniforme",
    "surf": "Concentré en surface",
}


# ── Hydrodynamique ───────────────────────────────────────────────────────────


def current_at_depth(z: np.ndarray, depth: float, surface_speed: float,
                     profile: str, wind_speed: float) -> np.ndarray:
    """Vitesse du courant selon la profondeur (vectorisé).

    *z* ≤ 0, fond à *z* = −depth.  Retourne un tableau de même forme que *z*.
    """
    f = np.clip((z + depth) / depth, 0.0, 1.0)
    if profile == "lin":
        p = f
    elif profile == "surf":
        p = f ** 3
    else:  # uni
        p = np.ones_like(f)
    u = surface_speed * p
    # Courant induit par le vent dans les 2 m de surface
    near_surface = z > -2
    u = np.where(near_surface,
                 u + wind_speed * 0.03 * np.clip(z + 2, 0, 2) / 2, u)
    return u


def wave_orbital(pos: np.ndarray, t: float, H: float, T: float,
                 direction: float) -> np.ndarray:
    """Vitesses orbitales Airy aux positions (N, 3).  Retourne (N, 3)."""
    n = len(pos)
    if H < 0.01 or T < 1:
        return np.zeros((n, 3))
    omega = 2.0 * math.pi / T
    k = omega * omega / G           # approximation eau profonde
    a = H / 2.0
    cd, sd = math.cos(direction), math.sin(direction)
    x_proj = pos[:, 0] * cd + pos[:, 1] * sd
    z = pos[:, 2]
    phase = k * x_proj - omega * t
    decay = np.exp(k * np.maximum(z, -100.0))
    u_h = a * omega * decay * np.cos(phase)
    u_v = a * omega * decay * np.sin(phase)
    out = np.zeros((n, 3))
    out[:, 0] = u_h * cd
    out[:, 1] = u_h * sd
    out[:, 2] = u_v
    return out


def _cable_area(diam: float) -> float:
    return math.pi * (diam / 2.0) ** 2


def _cable_mbl(mat_key: str, diam: float) -> float:
    """Minimum Breaking Load (N)."""
    return MATERIALS[mat_key]["sigma"] * _cable_area(diam)


# ── Génération du modèle MuJoCo ──────────────────────────────────────────────


def _generate_xml(depth: float, n_seg: int, cable_diam: float,
                  cable_rho: float, device_mass: float) -> str:
    """Chaîne de segments capsule + dispositif.

    Gravité MuJoCo activée (matrice masse bien conditionnée).
    Le câble occupe ``depth - 2 m`` pour que le dispositif reste immergé.
    """
    cable_length = depth - 2.0          # marge sous la surface
    seg_len = cable_length / n_seg
    half = seg_len / 2.0
    seg_mass = max(0.2, cable_rho * _cable_area(cable_diam) * seg_len)

    xml = f"""<mujoco model="mooring_3d">
  <option gravity="0 0 -{G}" timestep="0.001" iterations="80"/>
  <default>
    <geom contype="1" conaffinity="1"/>
    <joint damping="20" stiffness="50"/>
  </default>
  <worldbody>
    <geom name="floor" type="plane" size="10 10 0.1"
          pos="0 0 {-depth}" rgba="0.15 0.12 0.08 1"/>
    <geom name="surface" type="plane" size="10 10 0.01"
          pos="0 0 0" euler="180 0 0" rgba="0 0 0 0"/>
    <geom name="anchor_geom" type="cylinder" size="0.2 0.06"
          pos="0 0 {-depth + 0.06}" rgba="0.6 0.6 0.6 1" mass="500"/>
"""
    indent = "    "
    for i in range(n_seg):
        z_off = -depth + seg_len / 2 if i == 0 else seg_len
        xml += (
            f'{indent}<body name="seg_{i}" pos="0 0 {z_off:.4f}">\n'
            f'{indent}  <joint name="j_{i}" type="ball"/>\n'
            f'{indent}  <geom name="c_{i}" type="capsule"'
            f' size="{cable_diam / 2:.4f} {half:.4f}"'
            f' rgba="0.9 0.9 0.2 1" mass="{seg_mass:.4f}"/>\n'
        )
        indent += "  "

    xml += (
        f'{indent}<body name="device" pos="0 0 {seg_len:.4f}">\n'
        f'{indent}  <joint name="j_dev" type="ball"/>\n'
        f'{indent}  <geom name="dev" type="box" size="0.15 0.15 0.12"'
        f' rgba="0.85 0.9 0.95 1" mass="{device_mass:.2f}"/>\n'
        f'{indent}</body>\n'
    )
    for _ in range(n_seg):
        indent = indent[:-2]
        xml += f"{indent}</body>\n"
    xml += "  </worldbody>\n</mujoco>\n"
    return xml


# ── App Viser ─────────────────────────────────────────────────────────────────


def run_anchor_sim(config: dict[str, Any]):
    """Lance la simulation 3D interactive."""
    sim_cfg = config.get("anchor_sim", {})
    port = sim_cfg.get("port", 8080)

    cable_cfg = sim_cfg.get("cable", {})
    dev_cfg = sim_cfg.get("device", {})
    env_cfg = sim_cfg.get("environment", {})

    # ── État mutable ──────────────────────────────────────────────────────────

    S: dict[str, Any] = {
        "depth":       env_cfg.get("depth", 30),
        "n_seg":       cable_cfg.get("n_segments", 24),
        "diam":        cable_cfg.get("diameter", 0.01),
        "mat":         "poly",
        "device_mass": dev_cfg.get("mass", 18),
        "device_buoy": 80.0,
        "n_floats":    0,
        "float_buoy":  40.0,
        "current_speed":   0.6,
        "current_dir":     0.0,
        "current_profile": "lin",
        "wave_h":   1.2,
        "wave_t":   7.0,
        "wind":     5.0,
        "target_L": 0.0,
        "cable_L":  0.0,
        "winch_F":  0.0,
        "paused":   False,
        "broken":   False,
        # MuJoCo objects (set by build())
        "model": None, "data": None,
        "seg_ids": [], "device_id": 0, "seg_len": 0.0,
    }

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _float_nodes() -> set[int]:
        n = int(S["n_floats"])
        if n <= 0:
            return set()
        ns = S["n_seg"]
        return {round(j * ns / (n + 1)) for j in range(1, n + 1)}

    # ── Construire / reconstruire le modèle ───────────────────────────────────

    def build():
        mat = MATERIALS[S["mat"]]
        xml = _generate_xml(S["depth"], S["n_seg"], S["diam"],
                            mat["rho"], S["device_mass"])
        S["model"] = mujoco.MjModel.from_xml_string(xml)
        S["data"] = mujoco.MjData(S["model"])
        cable_length = S["depth"] - 2.0
        S["seg_len"] = cable_length / S["n_seg"]
        S["device_id"] = mujoco.mj_name2id(
            S["model"], mujoco.mjtObj.mjOBJ_BODY, "device")
        S["seg_ids"] = [
            mujoco.mj_name2id(S["model"], mujoco.mjtObj.mjOBJ_BODY, f"seg_{i}")
            for i in range(S["n_seg"])
        ]
        S["broken"] = False
        S["target_L"] = cable_length
        # Stabilisation (uniquement flottabilité, MuJoCo gère la gravité)
        for _ in range(2000):
            _apply_forces(S, 0.0, stabilizing=True)
            mujoco.mj_step(S["model"], S["data"])

    # ── Forces ────────────────────────────────────────────────────────────────

    def _apply_forces(s: dict, t_sim: float, *, stabilizing: bool = False):
        """Calcule et applique flottabilité, drag, houle, vent, treuil.

        MuJoCo gère la gravité ; on ajoute la poussée d'Archimède et le drag.
        Pour le dispositif, ``device_buoy`` est la flottabilité *nette*
        (positif = flotte), donc on compense d'abord le poids MuJoCo
        puis on ajoute la valeur nette.
        """
        model, data = s["model"], s["data"]
        data.xfrc_applied[:] = 0

        seg_ids = s["seg_ids"]
        device_id = s["device_id"]
        n_seg = s["n_seg"]
        seg_len = s["seg_len"]
        diam = s["diam"]
        depth = s["depth"]

        V_seg = _cable_area(diam) * seg_len
        buoy_seg = RHO_W * G * V_seg         # poussée Archimède par segment

        float_nodes = _float_nodes()

        # ── Positions / vitesses câble ────────────────────────────────────────
        pos = data.xpos[seg_ids].copy()                    # (n_seg, 3)
        z = pos[:, 2]
        submerged = z < 0

        # 1) Poussée d'Archimède câble (MuJoCo gère déjà le poids)
        data.xfrc_applied[seg_ids, 5] += np.where(submerged, buoy_seg, 0.0)

        # 2) Flotteurs intermédiaires
        for idx in float_nodes:
            if 0 <= idx < n_seg:
                data.xfrc_applied[seg_ids[idx], 5] += s["float_buoy"]

        # 3) Dispositif : compense le poids MuJoCo + flottabilité nette
        dev_mass_mj = float(model.body_mass[device_id])
        data.xfrc_applied[device_id, 5] += s["device_buoy"] + dev_mass_mj * G

        if stabilizing:
            return

        # 4) Courant + houle → drag câble ─────────────────────────────────────
        vel = data.cvel[np.array(seg_ids), 3:].copy()      # (n_seg, 3)
        cur_dir = math.radians(s["current_dir"])
        cd_c, sd_c = math.cos(cur_dir), math.sin(cur_dir)

        cur_mag = current_at_depth(z, depth, s["current_speed"],
                                   s["current_profile"], s["wind"])
        fluid = np.zeros((n_seg, 3))
        fluid[:, 0] = cur_mag * cd_c
        fluid[:, 1] = cur_mag * sd_c
        fluid += wave_orbital(pos, t_sim, s["wave_h"], s["wave_t"], cur_dir)

        rel_v = fluid - vel

        # Vecteurs tangents (voisins)
        anchor_pos = np.array([[0.0, 0.0, -depth]])
        dev_pos_arr = data.xpos[device_id : device_id + 1].copy()
        prev = np.vstack([anchor_pos, pos[:-1]])
        nxt = np.vstack([pos[1:], dev_pos_arr])
        tang = nxt - prev
        tl = np.linalg.norm(tang, axis=1, keepdims=True).clip(min=1e-6)
        tu = tang / tl

        # Composantes normale / tangentielle
        v_t = np.sum(rel_v * tu, axis=1, keepdims=True)
        v_n = rel_v - v_t * tu
        v_n_mag = np.linalg.norm(v_n, axis=1, keepdims=True)

        A_n = diam * seg_len
        F_n = (0.5 * RHO_W * 1.2 * A_n) * v_n_mag * v_n
        F_t = (0.5 * RHO_W * 0.1 * math.pi * diam * seg_len
               * np.abs(v_t) * v_t * tu)
        F_drag = (F_n + F_t) * submerged[:, np.newaxis]
        data.xfrc_applied[seg_ids, 3:6] += F_drag

        # ── Dispositif — drag ────────────────────────────────────────────────
        dev_pos = data.xpos[device_id].copy()
        dev_vel = data.cvel[device_id, 3:].copy()
        dev_z = dev_pos[2]

        if dev_z < 0:
            dc = current_at_depth(np.array([dev_z]), depth, s["current_speed"],
                                  s["current_profile"], s["wind"])[0]
            d_fluid = np.array([dc * cd_c, dc * sd_c, 0.0])
            d_fluid += wave_orbital(dev_pos[np.newaxis], t_sim,
                                    s["wave_h"], s["wave_t"], cur_dir)[0]
            d_rel = d_fluid - dev_vel
            vm = np.linalg.norm(d_rel)
            A_dev = 0.3 * 0.24
            data.xfrc_applied[device_id, 3:6] += (
                0.5 * RHO_W * 1.5 * A_dev * vm * d_rel)

        # Vent (surface)
        if dev_z > -1:
            w_vec = np.array([s["wind"] * cd_c, s["wind"] * sd_c, 0.0])
            w_rel = w_vec - dev_vel
            wm = np.linalg.norm(w_rel)
            data.xfrc_applied[device_id, 3:6] += (
                0.5 * RHO_AIR * 0.9 * 0.15 * wm * w_rel)

        # ── Treuil (contrôle de longueur câble) ──────────────────────────────
        cable_pts = [np.array([0.0, 0.0, -depth])]
        for sid in seg_ids:
            cable_pts.append(data.xpos[sid].copy())
        cable_pts.append(data.xpos[device_id].copy())
        cur_len = sum(np.linalg.norm(cable_pts[i + 1] - cable_pts[i])
                      for i in range(len(cable_pts) - 1))
        s["cable_L"] = cur_len

        err = s["target_L"] - cur_len
        wf = float(np.clip(-err * 200.0, -500.0, 500.0))
        data.xfrc_applied[device_id, 5] += wf
        s["winch_F"] = wf

    # ── Tensions ──────────────────────────────────────────────────────────────

    def _compute_tensions(s: dict):
        """Tensions quasi-statiques par accumulation descendante.

        Force nette par corps = xfrc_applied + gravité MuJoCo.
        Retourne (joint_tensions, anchor_v, anchor_h, anchor_t, max_t).
        """
        model, data = s["model"], s["data"]
        seg_ids = s["seg_ids"]
        device_id = s["device_id"]
        n_seg = s["n_seg"]

        def _net_force(bid: int) -> np.ndarray:
            f = data.xfrc_applied[bid, 3:6].copy()
            f[2] -= model.body_mass[bid] * G          # gravité
            return f

        cum = _net_force(device_id)
        jt = np.empty(n_seg + 1)
        jt[n_seg] = np.linalg.norm(cum)

        for i in range(n_seg - 1, -1, -1):
            cum = cum + _net_force(seg_ids[i])
            jt[i] = np.linalg.norm(cum)

        return (jt, float(cum[2]), float(np.linalg.norm(cum[:2])),
                float(np.linalg.norm(cum)), float(jt.max()))

    # ── Première construction ─────────────────────────────────────────────────

    build()

    # ── Serveur Viser ─────────────────────────────────────────────────────────

    server = viser.ViserServer(host="0.0.0.0", port=port)
    server.scene.set_background_image(
        np.full((1, 1, 3), [10, 20, 40], dtype=np.uint8))

    # ── GUI — Déroulement ─────────────────────────────────────────────────────

    with server.gui.add_folder("Déroulement"):
        gui_cable_L = server.gui.add_slider(
            "Câble déployé (m)", min=2.0, max=65.0,
            step=0.5, initial_value=S["depth"])
        gui_deploy = server.gui.add_button("Déployer +5 m")
        gui_retract = server.gui.add_button("Rembobiner −5 m")
        gui_lock = server.gui.add_button("Bloquer")

    # ── GUI — Environnement ───────────────────────────────────────────────────

    with server.gui.add_folder("Environnement"):
        gui_cur = server.gui.add_slider(
            "Courant surface (m/s)", min=0.0, max=2.5,
            step=0.05, initial_value=0.6)
        gui_cur_dir = server.gui.add_slider(
            "Direction courant (°)", min=0, max=360, step=5, initial_value=0)
        _prof_labels = list(PROFILES.values())
        gui_prof = server.gui.add_dropdown(
            "Profil courant", options=_prof_labels,
            initial_value=_prof_labels[0])
        gui_wh = server.gui.add_slider(
            "Houle — hauteur (m)", min=0.0, max=4.0,
            step=0.1, initial_value=1.2)
        gui_wt = server.gui.add_slider(
            "Houle — période (s)", min=3.0, max=14.0,
            step=0.5, initial_value=7.0)
        gui_wind = server.gui.add_slider(
            "Vent surface (m/s)", min=0, max=25, step=1, initial_value=5)
        gui_depth = server.gui.add_slider(
            "Profondeur site (m)", min=10, max=60, step=1,
            initial_value=int(S["depth"]))

    # ── GUI — Câble ───────────────────────────────────────────────────────────

    with server.gui.add_folder("Câble"):
        gui_diam = server.gui.add_slider(
            "Diamètre (mm)", min=3.0, max=24.0, step=0.5, initial_value=10.0)
        _mat_labels = [v["label"] for v in MATERIALS.values()]
        gui_mat = server.gui.add_dropdown(
            "Matériau", options=_mat_labels, initial_value=_mat_labels[0])

    # ── GUI — Dispositif & flotteurs ──────────────────────────────────────────

    with server.gui.add_folder("Dispositif & Flotteurs"):
        gui_mass = server.gui.add_slider(
            "Masse dispositif (kg)", min=2, max=60, step=1, initial_value=18)
        gui_buoy = server.gui.add_slider(
            "Flottabilité nette (N)", min=10, max=400, step=5, initial_value=80)
        gui_nfloat = server.gui.add_slider(
            "Flotteurs intermédiaires", min=0, max=5, step=1, initial_value=0)
        gui_fbuoy = server.gui.add_slider(
            "Flottabilité / flotteur (N)", min=10, max=200, step=5, initial_value=40)

    # ── GUI — Simulation ──────────────────────────────────────────────────────

    with server.gui.add_folder("Simulation"):
        gui_stiff = server.gui.add_slider(
            "Raideur joints", min=1, max=200, step=1, initial_value=40)
        gui_damp = server.gui.add_slider(
            "Amortissement", min=0.1, max=50, step=0.5, initial_value=15)
        gui_speed = server.gui.add_slider(
            "Vitesse", min=0.1, max=5.0, step=0.1, initial_value=1.0)
        gui_show_cur = server.gui.add_checkbox(
            "Champ de courant", initial_value=True)
        gui_show_F = server.gui.add_checkbox(
            "Vecteurs de force", initial_value=False)
        gui_pause = server.gui.add_button("Pause / Lecture")
        gui_reset = server.gui.add_button("Réinitialiser")
        gui_rebuild = server.gui.add_button("Reconstruire modèle")

    # ── GUI — Mesures ─────────────────────────────────────────────────────────

    with server.gui.add_folder("Mesures"):
        ro = {}
        for key, label in [
            ("depth",    "Profondeur dispositif"),
            ("height",   "Hauteur / fond"),
            ("exc",      "Excursion horizontale"),
            ("angle",    "Angle max / verticale"),
            ("tmax",     "Tension max câble"),
            ("av",       "Ancrage — vertical (soulèvt)"),
            ("ah",       "Ancrage — horizontal"),
            ("at",       "Ancrage — total"),
            ("mbl",      "Résistance câble (MBL)"),
            ("sf",       "Coeff. de sécurité"),
            ("winch",    "Force treuil"),
            ("cable_L",  "Câble déployé"),
        ]:
            ro[key] = server.gui.add_text(label, initial_value="—")

    # ── Boutons ───────────────────────────────────────────────────────────────

    @gui_deploy.on_click
    def _(_ev: Any):
        gui_cable_L.value = min(65.0, gui_cable_L.value + 5)

    @gui_retract.on_click
    def _(_ev: Any):
        gui_cable_L.value = max(2.0, gui_cable_L.value - 5)

    @gui_lock.on_click
    def _(_ev: Any):
        gui_cable_L.value = round(S["cable_L"] * 2) / 2

    @gui_pause.on_click
    def _(_ev: Any):
        S["paused"] = not S["paused"]

    @gui_reset.on_click
    def _(_ev: Any):
        mujoco.mj_resetData(S["model"], S["data"])
        for _ in range(3000):
            _apply_forces(S, 0.0, stabilizing=True)
            mujoco.mj_step(S["model"], S["data"])
        S["broken"] = False

    @gui_rebuild.on_click
    def _(_ev: Any):
        S["depth"] = gui_depth.value
        S["diam"] = gui_diam.value / 1000
        build()
        gui_cable_L.value = S["depth"]

    # ── Lookups ───────────────────────────────────────────────────────────────

    _mat_label2key = {v["label"]: k for k, v in MATERIALS.items()}
    _prof_label2key = {v: k for k, v in PROFILES.items()}

    # ── Scène statique ────────────────────────────────────────────────────────

    def _build_scene():
        d = S["depth"]
        fm = trimesh.creation.box([8, 8, 0.02])
        fm.apply_translation([0, 0, -d])
        fm.visual.vertex_colors = np.full(
            (len(fm.vertices), 4), [60, 50, 35, 200], np.uint8)
        server.scene.add_mesh_trimesh("floor", fm)

        sm = trimesh.creation.box([8, 8, 0.01])
        sm.visual.vertex_colors = np.full(
            (len(sm.vertices), 4), [80, 160, 220, 50], np.uint8)
        server.scene.add_mesh_trimesh("water_surface", sm)

        am = trimesh.creation.cylinder(radius=0.2, height=0.12)
        am.apply_translation([0, 0, -d + 0.06])
        am.visual.vertex_colors = np.full(
            (len(am.vertices), 4), [150, 150, 160, 255], np.uint8)
        server.scene.add_mesh_trimesh("anchor", am)

    _build_scene()

    print(f"\nServeur Viser → http://localhost:{port}")
    print("Ctrl+C pour arrêter\n")

    # ── Handles dynamiques ────────────────────────────────────────────────────

    cable_handles: list = []
    float_handles: list = []
    device_handle = None
    arrows_handle = None
    force_handles: list = []
    frame = 0

    # ── Boucle principale ─────────────────────────────────────────────────────

    try:
        while True:
            # ── Lecture GUI → état ────────────────────────────────────────────
            S["current_speed"] = gui_cur.value
            S["current_dir"] = gui_cur_dir.value
            S["current_profile"] = _prof_label2key.get(gui_prof.value, "lin")
            S["wave_h"] = gui_wh.value
            S["wave_t"] = gui_wt.value
            S["wind"] = gui_wind.value
            S["target_L"] = gui_cable_L.value
            S["device_mass"] = gui_mass.value
            S["device_buoy"] = gui_buoy.value
            S["n_floats"] = int(gui_nfloat.value)
            S["float_buoy"] = gui_fbuoy.value
            S["mat"] = _mat_label2key.get(gui_mat.value, "poly")

            S["model"].jnt_stiffness[:] = gui_stiff.value
            S["model"].dof_damping[:] = gui_damp.value

            # ── Pas de physique ───────────────────────────────────────────────
            if not S["paused"]:
                n_steps = max(1, int(gui_speed.value * 10))
                t_sim = S["data"].time
                for _ in range(n_steps):
                    _apply_forces(S, t_sim)
                    mujoco.mj_step(S["model"], S["data"])
                    t_sim = S["data"].time
                # Recalcul pour cohérence affichage
                _apply_forces(S, S["data"].time)

            # ── Extraire l'état ───────────────────────────────────────────────
            data = S["data"]
            seg_ids = S["seg_ids"]
            device_id = S["device_id"]
            n_seg = S["n_seg"]
            depth = S["depth"]

            anchor_pt = np.array([0.0, 0.0, -depth], dtype=np.float32)
            cable_pts = [anchor_pt]
            for sid in seg_ids:
                cable_pts.append(data.xpos[sid].astype(np.float32))
            dev_pos = data.xpos[device_id].astype(np.float32)
            cable_pts.append(dev_pos)
            cable_arr = np.array(cable_pts)

            jt, anc_v, anc_h, anc_t, max_t = _compute_tensions(S)
            M = _cable_mbl(S["mat"], S["diam"])

            # Angle max / verticale
            max_angle = 0.0
            for i in range(len(cable_arr) - 1):
                d_vec = cable_arr[i + 1] - cable_arr[i]
                horiz = math.sqrt(d_vec[0] ** 2 + d_vec[1] ** 2)
                vert = abs(d_vec[2])
                a = math.degrees(math.atan2(horiz, vert)) if vert > 0.01 else 90
                max_angle = max(max_angle, a)

            dev_depth = max(0.0, -dev_pos[2])
            dev_height = dev_pos[2] + depth
            dev_exc = math.sqrt(float(dev_pos[0]) ** 2 + float(dev_pos[1]) ** 2)
            sf = M / max_t if max_t > 1 else 99.0

            # ── Câble (couleur par tension) ───────────────────────────────────
            for h in cable_handles:
                h.remove()
            cable_handles.clear()

            n_links = len(cable_arr) - 1
            for i in range(n_links):
                ti = min(i, n_seg)
                fr = jt[ti] / M if M > 0 else 0
                if S["broken"]:
                    col = (127, 29, 29)
                elif fr < 0.3:
                    col = (52, 211, 153)
                elif fr < 0.7:
                    col = (251, 191, 36)
                elif fr < 1.0:
                    col = (251, 146, 60)
                else:
                    col = (239, 68, 68)
                h = server.scene.add_spline_catmull_rom(
                    f"cable/s_{i}",
                    positions=cable_arr[i : i + 2],
                    color=col,
                    line_width=max(2.0, S["diam"] * 200),
                )
                cable_handles.append(h)

            # ── Flotteurs ─────────────────────────────────────────────────────
            for h in float_handles:
                h.remove()
            float_handles.clear()

            for idx in _float_nodes():
                if 0 <= idx < n_seg:
                    fp = data.xpos[seg_ids[idx]]
                    fm = trimesh.creation.icosphere(radius=0.07)
                    fm.apply_translation(fp)
                    fm.visual.vertex_colors = np.full(
                        (len(fm.vertices), 4), [253, 230, 138, 255], np.uint8)
                    fh = server.scene.add_mesh_trimesh(f"float_{idx}", fm)
                    float_handles.append(fh)

            # ── Dispositif ────────────────────────────────────────────────────
            if device_handle is not None:
                device_handle.remove()
            dm = trimesh.creation.box([0.3, 0.3, 0.24])
            dm.apply_translation(dev_pos)
            dm.visual.vertex_colors = np.full(
                (len(dm.vertices), 4), [226, 232, 240, 255], np.uint8)
            device_handle = server.scene.add_mesh_trimesh("device", dm)

            # ── Champ de courant ──────────────────────────────────────────────
            if gui_show_cur.value and (frame % 10 == 0 or frame == 0):
                if arrows_handle is not None:
                    arrows_handle.remove()
                cur_dir_rad = math.radians(S["current_dir"])
                gx = np.linspace(-2, 2, 4)
                gy = np.linspace(-2, 2, 4)
                gz = np.linspace(-depth + 1, -0.5, max(2, int(depth / 4)))
                grid = np.array(np.meshgrid(gx, gy, gz)).reshape(3, -1).T

                sp = current_at_depth(grid[:, 2], depth, S["current_speed"],
                                      S["current_profile"], S["wind"])
                cdc, sdc = math.cos(cur_dir_rad), math.sin(cur_dir_rad)
                dirs = np.zeros_like(grid)
                dirs[:, 0] = sp * cdc * 0.5
                dirs[:, 1] = sp * sdc * 0.5
                if S["wave_h"] > 0.01:
                    dirs += wave_orbital(grid, data.time,
                                         S["wave_h"], S["wave_t"],
                                         cur_dir_rad) * 0.5

                ends = grid + dirs
                pts = np.stack([grid, ends], axis=1).astype(np.float32)
                mags = np.linalg.norm(dirs, axis=1)
                mx = max(mags.max(), 0.01)
                inten = (mags / mx * 155 + 100).astype(np.uint8)
                colors = np.column_stack([
                    np.full(len(grid), 80, dtype=np.uint8),
                    inten,
                    np.full(len(grid), 255, dtype=np.uint8),
                ])
                arrows_handle = server.scene.add_arrows(
                    "current_field", pts, colors,
                    shaft_radius=0.008, head_radius=0.025, head_length=0.04)
            elif not gui_show_cur.value and arrows_handle is not None:
                arrows_handle.remove()
                arrows_handle = None

            # ── Vecteurs de force ─────────────────────────────────────────────
            if gui_show_F.value and frame % 5 == 0:
                for h in force_handles:
                    h.remove()
                force_handles.clear()
                fpts, fcols = [], []
                for bid in seg_ids:
                    f = data.xfrc_applied[bid, 3:6]
                    fm_val = float(np.linalg.norm(f))
                    if fm_val > 0.1:
                        origin = data.xpos[bid].copy()
                        end = origin + f * 0.01
                        fpts.append([origin, end])
                        t_i = min(1.0, fm_val / 200)
                        fcols.append([int(255 * t_i),
                                      int(255 * (1 - t_i)), 50])
                if fpts:
                    fh = server.scene.add_arrows(
                        "forces",
                        np.array(fpts, dtype=np.float32),
                        np.array(fcols, dtype=np.uint8),
                        shaft_radius=0.006, head_radius=0.018,
                        head_length=0.025)
                    force_handles.append(fh)
            elif not gui_show_F.value and force_handles:
                for h in force_handles:
                    h.remove()
                force_handles.clear()

            # ── Affichage mesures ─────────────────────────────────────────────
            warn = ""
            if S["broken"]:
                warn = " [CÂBLE ROMPU]"
            elif sf < 2:
                warn = " [ATTENTION]"

            ro["depth"].value = f"{dev_depth:.1f} m{warn}"
            ro["height"].value = f"{dev_height:.1f} m"
            ro["exc"].value = f"{dev_exc:.2f} m"
            ro["angle"].value = f"{max_angle:.0f}°"
            ro["tmax"].value = f"{max_t:.0f} N"
            ro["av"].value = f"{anc_v:.0f} N ↑"
            ro["ah"].value = f"{anc_h:.0f} N"
            ro["at"].value = f"{anc_t:.0f} N"
            ro["mbl"].value = f"{M:.0f} N"
            ro["sf"].value = f"{sf:.2f} ×" if sf < 99 else "—"
            ro["winch"].value = f"{S['winch_F']:.0f} N"
            ro["cable_L"].value = f"{S['cable_L']:.1f} m"

            # Rupture câble
            if max_t > M and not S["broken"]:
                S["broken"] = True

            frame += 1
            time.sleep(1 / 30)

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
