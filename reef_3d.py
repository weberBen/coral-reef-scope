"""
Visualisation 3D interactive d'un récif corallien
à partir d'un modèle photogrammétrique téléchargé depuis Sketchfab.

Modèles de vrais récifs scannés sous l'eau (Structure-from-Motion).

Usage :
    1. Compte gratuit sur sketchfab.com
    2. Settings → Password & API → copier l'API Token
    3. export SKETCHFAB_TOKEN="votre-token"
    4. pip install requests numpy trimesh plotly
    5. python reef_3d.py
"""

import os
import zipfile
from pathlib import Path

import plotly.graph_objects as go
import requests
import trimesh

# ── Configuration ─────────────────────────────────────────────────────────────

SKETCHFAB_API = "https://api.sketchfab.com/v3"
SKETCHFAB_TOKEN = os.environ.get("SKETCHFAB_TOKEN", "")

# Modèles photogrammétrie de récifs (gratuits, CC BY 4.0)
MODELS = {
    "rexcor": {
        "uid": "96abab2a1bda4888af6f03ad3888aa66",
        "title": "Récif artificiel REXCOR — Marseille (2017)",
        "author": "Septentrion Environnement",
    },
    "guadeloupe": {
        "uid": "8bbfe22f29094e009fb0133f95c4b7f5",
        "title": "Récif corallien — Réserve Cousteau, Guadeloupe",
        "author": "Sea(e)scape",
    },
}

SELECTED_MODEL = "rexcor"
MAX_FACES = 300_000  # décimer si le maillage dépasse ce seuil
CACHE_DIR = Path("models")


# ── Téléchargement Sketchfab ─────────────────────────────────────────────────


def get_model_path(uid: str) -> Path:
    """Télécharge le modèle glTF depuis Sketchfab (avec cache local)."""
    model_dir = CACHE_DIR / uid
    existing = list(model_dir.glob("**/*.gltf")) + list(model_dir.glob("**/*.glb"))
    if existing:
        return existing[0]

    if not SKETCHFAB_TOKEN:
        raise SystemExit(
            "\n  Token Sketchfab requis :\n"
            "    1. Compte gratuit → sketchfab.com\n"
            "    2. Settings → Password & API → API Token\n"
            "    3. export SKETCHFAB_TOKEN='votre-token'\n"
        )

    headers = {"Authorization": f"Token {SKETCHFAB_TOKEN}"}

    # Obtenir l'URL de téléchargement
    r = requests.get(
        f"{SKETCHFAB_API}/models/{uid}/download", headers=headers, timeout=30
    )
    if r.status_code == 403:
        raise SystemExit(
            "Modèle non téléchargeable (403). "
            "Vérifiez votre token et que le modèle est téléchargeable."
        )
    r.raise_for_status()

    gltf_info = r.json().get("gltf")
    if not gltf_info:
        raise SystemExit("Format glTF non disponible pour ce modèle.")

    # Télécharger l'archive ZIP
    print("  Téléchargement…", end=" ", flush=True)
    dl = requests.get(gltf_info["url"], stream=True, timeout=300)
    dl.raise_for_status()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = CACHE_DIR / f"{uid}.zip"
    size = 0
    with open(zip_path, "wb") as f:
        for chunk in dl.iter_content(8192):
            f.write(chunk)
            size += len(chunk)
    print(f"{size / 1e6:.1f} Mo")

    # Extraire
    model_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(model_dir)
    zip_path.unlink()

    found = list(model_dir.glob("**/*.gltf")) + list(model_dir.glob("**/*.glb"))
    if not found:
        raise SystemExit("Aucun fichier glTF trouvé dans l'archive.")
    return found[0]


# ── Chargement du maillage ───────────────────────────────────────────────────


def load_mesh(path: Path) -> trimesh.Trimesh:
    """Charge un glTF et fusionne tous les sous-maillages."""
    loaded = trimesh.load(str(path))

    if isinstance(loaded, trimesh.Scene):
        meshes = [
            g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)
        ]
        if not meshes:
            raise SystemExit("Aucun maillage trouvé dans la scène.")
        mesh = trimesh.util.concatenate(meshes)
    else:
        mesh = loaded

    print(f"  {len(mesh.vertices):,} sommets · {len(mesh.faces):,} faces")

    # Décimation si trop lourd pour le navigateur
    if len(mesh.faces) > MAX_FACES:
        print(f"  Décimation → {MAX_FACES:,} faces…")
        mesh = mesh.simplify_quadric_decimation(MAX_FACES)
        print(f"  → {len(mesh.vertices):,} sommets · {len(mesh.faces):,} faces")

    return mesh


# ── Visualisation 3D ─────────────────────────────────────────────────────────


def build_figure(mesh: trimesh.Trimesh, title: str) -> go.Figure:
    """Construit la figure Plotly 3D interactive."""
    verts = mesh.vertices
    faces = mesh.faces

    # Tenter d'utiliser les couleurs de vertex (photogrammétrie texturée)
    vertex_colors = None
    try:
        vc = mesh.visual.vertex_colors
        if vc is not None and vc.shape[0] == len(verts) and vc.shape[1] >= 3:
            vertex_colors = [f"rgb({r},{g},{b})" for r, g, b in vc[:, :3]]
    except Exception:
        pass

    mesh_kwargs = dict(
        x=verts[:, 0],
        y=verts[:, 1],
        z=verts[:, 2],
        i=faces[:, 0],
        j=faces[:, 1],
        k=faces[:, 2],
        hovertemplate="x: %{x:.2f}<br>y: %{y:.2f}<br>z: %{z:.2f}<extra></extra>",
        lighting=dict(ambient=0.4, diffuse=0.6, specular=0.2, roughness=0.8),
        lightposition=dict(x=1000, y=1000, z=2000),
    )

    if vertex_colors:
        mesh_kwargs["vertexcolor"] = vertex_colors
        print("  Couleurs de vertex (photogrammétrie) détectées")
    else:
        # Coloration par profondeur (axe Z)
        mesh_kwargs["intensity"] = verts[:, 2]
        mesh_kwargs["colorscale"] = "deep_r"
        mesh_kwargs["colorbar"] = dict(title="Profondeur (m)")
        print("  Coloration par profondeur (Z)")

    fig = go.Figure(data=[go.Mesh3d(**mesh_kwargs)])

    fig.update_layout(
        title=dict(
            text=f"{title}<br><sup>Photogrammétrie sous-marine</sup>",
            x=0.5,
        ),
        scene=dict(
            aspectmode="data",
            xaxis_title="X (m)",
            yaxis_title="Y (m)",
            zaxis_title="Z (m)",
        ),
        template="plotly_dark",
        margin=dict(l=0, r=0, t=70, b=0),
    )

    return fig


# ── Point d'entrée ────────────────────────────────────────────────────────────


def main():
    info = MODELS[SELECTED_MODEL]
    print(f"{info['title']}")
    print(f"Auteur : {info['author']}\n")

    # 1. Télécharger le modèle
    path = get_model_path(info["uid"])
    print(f"  Fichier : {path.name}")

    # 2. Charger le maillage 3D
    print("Chargement…")
    mesh = load_mesh(path)

    # 3. Visualiser
    print("Construction de la visualisation 3D…")
    fig = build_figure(mesh, info["title"])

    output = "reef_3d.html"
    fig.write_html(output, include_plotlyjs=True)
    print(f"\nSauvegardé → {output}")
    fig.show()


if __name__ == "__main__":
    main()
