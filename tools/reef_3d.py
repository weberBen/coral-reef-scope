"""
Interactive 3D visualization of a coral reef
from a photogrammetric model downloaded from Sketchfab.

Models of real reefs scanned underwater (Structure-from-Motion).

Usage:
    1. Free account on sketchfab.com
    2. Settings -> Password & API -> copy the API Token
    3. export SKETCHFAB_TOKEN="your-token"
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

# Photogrammetry reef models (free, CC BY 4.0)
MODELS = {
    "rexcor": {
        "uid": "96abab2a1bda4888af6f03ad3888aa66",
        "title": "Artificial reef REXCOR — Marseille (2017)",
        "author": "Septentrion Environnement",
    },
    "guadeloupe": {
        "uid": "8bbfe22f29094e009fb0133f95c4b7f5",
        "title": "Coral reef — Cousteau Reserve, Guadeloupe",
        "author": "Sea(e)scape",
    },
}

SELECTED_MODEL = "rexcor"
MAX_FACES = 300_000  # decimate if the mesh exceeds this threshold
CACHE_DIR = Path("models")


# ── Sketchfab download ───────────────────────────────────────────────────────


def get_model_path(uid: str) -> Path:
    """Download the glTF model from Sketchfab (with local cache)."""
    model_dir = CACHE_DIR / uid
    existing = list(model_dir.glob("**/*.gltf")) + list(model_dir.glob("**/*.glb"))
    if existing:
        return existing[0]

    if not SKETCHFAB_TOKEN:
        raise SystemExit(
            "\n  Sketchfab token required:\n"
            "    1. Free account -> sketchfab.com\n"
            "    2. Settings -> Password & API -> API Token\n"
            "    3. export SKETCHFAB_TOKEN='your-token'\n"
        )

    headers = {"Authorization": f"Token {SKETCHFAB_TOKEN}"}

    # Get the download URL
    r = requests.get(
        f"{SKETCHFAB_API}/models/{uid}/download", headers=headers, timeout=30
    )
    if r.status_code == 403:
        raise SystemExit(
            "Model not downloadable (403). "
            "Check your token and that the model is downloadable."
        )
    r.raise_for_status()

    gltf_info = r.json().get("gltf")
    if not gltf_info:
        raise SystemExit("glTF format not available for this model.")

    # Download the ZIP archive
    print("  Downloading...", end=" ", flush=True)
    dl = requests.get(gltf_info["url"], stream=True, timeout=300)
    dl.raise_for_status()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = CACHE_DIR / f"{uid}.zip"
    size = 0
    with open(zip_path, "wb") as f:
        for chunk in dl.iter_content(8192):
            f.write(chunk)
            size += len(chunk)
    print(f"{size / 1e6:.1f} MB")

    # Extract
    model_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(model_dir)
    zip_path.unlink()

    found = list(model_dir.glob("**/*.gltf")) + list(model_dir.glob("**/*.glb"))
    if not found:
        raise SystemExit("No glTF file found in the archive.")
    return found[0]


# ── Mesh loading ─────────────────────────────────────────────────────────────


def load_mesh(path: Path) -> trimesh.Trimesh:
    """Load a glTF and merge all sub-meshes."""
    loaded = trimesh.load(str(path))

    if isinstance(loaded, trimesh.Scene):
        meshes = [
            g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)
        ]
        if not meshes:
            raise SystemExit("No mesh found in the scene.")
        mesh = trimesh.util.concatenate(meshes)
    else:
        mesh = loaded

    print(f"  {len(mesh.vertices):,} vertices · {len(mesh.faces):,} faces")

    # Decimation if too heavy for the browser
    if len(mesh.faces) > MAX_FACES:
        print(f"  Decimating to {MAX_FACES:,} faces...")
        mesh = mesh.simplify_quadric_decimation(MAX_FACES)
        print(f"  -> {len(mesh.vertices):,} vertices · {len(mesh.faces):,} faces")

    return mesh


# ── 3D Visualization ─────────────────────────────────────────────────────────


def build_figure(mesh: trimesh.Trimesh, title: str) -> go.Figure:
    """Build the interactive Plotly 3D figure."""
    verts = mesh.vertices
    faces = mesh.faces

    # Try to use vertex colors (textured photogrammetry)
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
        print("  Vertex colors (photogrammetry) detected")
    else:
        # Coloring by depth (Z axis)
        mesh_kwargs["intensity"] = verts[:, 2]
        mesh_kwargs["colorscale"] = "deep_r"
        mesh_kwargs["colorbar"] = dict(title="Depth (m)")
        print("  Coloring by depth (Z)")

    fig = go.Figure(data=[go.Mesh3d(**mesh_kwargs)])

    fig.update_layout(
        title=dict(
            text=f"{title}<br><sup>Underwater photogrammetry</sup>",
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


# ── Entry point ───────────────────────────────────────────────────────────────


def main():
    info = MODELS[SELECTED_MODEL]
    print(f"{info['title']}")
    print(f"Author: {info['author']}\n")

    # 1. Download the model
    path = get_model_path(info["uid"])
    print(f"  File: {path.name}")

    # 2. Load the 3D mesh
    print("Loading...")
    mesh = load_mesh(path)

    # 3. Visualize
    print("Building 3D visualization...")
    fig = build_figure(mesh, info["title"])

    output = "reef_3d.html"
    fig.write_html(output, include_plotlyjs=True)
    print(f"\nSaved -> {output}")
    fig.show()


if __name__ == "__main__":
    main()
