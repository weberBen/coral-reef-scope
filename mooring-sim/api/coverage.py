"""
Coverage computation API server.
Loads the full-resolution reef mesh, computes camera coverage exactly.

Usage: python api/coverage.py
Runs on port 3001. Vite proxies /api/* to this server.
"""

import json
import math
import http.server
import numpy as np
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
MESH_PATH = DATA_DIR / "reef.glb"

# =============================================
#  MESH LOADING (once at startup)
# =============================================

vertices = None       # (N, 3) float64
face_centers = None   # (F, 3) float64
face_areas = None     # (F,) float64
face_normals = None   # (F, 3) float64
underwater_mask = None # (F,) bool — faces with z < 0
total_underwater_area = 0.0
bbox_min = None
bbox_max = None


def load_mesh():
    global vertices, face_centers, face_areas, face_normals
    global underwater_mask, total_underwater_area, bbox_min, bbox_max

    try:
        import trimesh
    except ImportError:
        print("ERROR: trimesh not installed. Run: uv add trimesh")
        return False

    print(f"Loading {MESH_PATH}...")
    scene = trimesh.load(str(MESH_PATH))

    if isinstance(scene, trimesh.Scene):
        mesh = trimesh.util.concatenate(scene.dump())
    else:
        mesh = scene

    vertices = np.array(mesh.vertices, dtype=np.float64)
    faces = np.array(mesh.faces, dtype=np.int32)

    # Face centers, areas, normals
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]
    face_centers = (v0 + v1 + v2) / 3.0
    cross = np.cross(v1 - v0, v2 - v0)
    face_areas = np.linalg.norm(cross, axis=1) * 0.5
    norms = np.linalg.norm(cross, axis=1, keepdims=True)
    norms[norms < 1e-10] = 1.0
    face_normals = cross / norms

    # Underwater faces (Z < 0 in this mesh)
    underwater_mask = (face_centers[:, 2] < 0) & (face_areas > 1e-6)
    total_underwater_area = float(face_areas[underwater_mask].sum())

    bbox_min = vertices.min(axis=0).tolist()
    bbox_max = vertices.max(axis=0).tolist()

    n_uw = int(underwater_mask.sum())
    print(f"Mesh loaded: {len(vertices)} vertices, {len(faces)} faces, {n_uw} underwater")
    print(f"BBox: {bbox_min} -> {bbox_max}")
    print(f"Total underwater area: {total_underwater_area:.1f} m^2")
    return True


# =============================================
#  COVERAGE COMPUTATION
# =============================================

def compute_coverage(cameras, fov, vis_range, ascent):
    """
    cameras: list of {x, y, anchorZ}
    fov: field of view in degrees
    vis_range: max visibility distance in meters
    ascent: 0 (at anchor) to 1 (at surface z=0)

    Returns: {coveragePct, coveredIndices}
    """
    if face_centers is None or len(cameras) == 0:
        return {"coveragePct": 0, "coveredIndices": []}

    half_angle = math.radians(fov / 2)
    cos_half = math.cos(half_angle)
    down = np.array([0, 0, -1], dtype=np.float64)

    # Only check underwater faces
    uw_indices = np.where(underwater_mask)[0]
    uw_centers = face_centers[uw_indices]
    covered = np.zeros(len(uw_indices), dtype=bool)

    for cam in cameras:
        cam_z = cam["anchorZ"] + (0 - cam["anchorZ"]) * ascent
        cam_pos = np.array([cam["x"], cam["y"], cam_z + 0.5])

        # Effective range decreases with depth
        depth = abs(cam_z)
        eff_range = vis_range * max(0.2, 1 - depth / 40)

        # Vector from camera to each face center
        to_face = uw_centers - cam_pos
        dists = np.linalg.norm(to_face, axis=1)

        # Distance check
        in_range = dists <= eff_range

        # Must be below camera (negative Z direction)
        below = to_face[:, 2] < 0

        # FOV cone check: angle between to_face and down vector
        to_face_norm = to_face / np.maximum(dists[:, None], 1e-10)
        cos_angle = np.dot(to_face_norm, down)  # dot with (0,0,-1)
        in_fov = cos_angle >= cos_half

        # Mark covered
        covered |= (in_range & below & in_fov)

    covered_area = float(face_areas[uw_indices[covered]].sum())
    pct = (covered_area / total_underwater_area * 100) if total_underwater_area > 0 else 0

    # Return indices of covered underwater faces (for visualization)
    covered_global = uw_indices[covered].tolist()

    return {
        "coveragePct": round(pct, 2),
        "coveredCount": int(covered.sum()),
        "totalCount": int(len(uw_indices)),
        "coveredArea": round(covered_area, 1),
        "totalArea": round(total_underwater_area, 1),
        "coveredIndices": covered_global,
    }


def optimize_placement(num_cameras, fov, vis_range):
    """Greedy placement: each camera maximizes new coverage."""
    if face_centers is None:
        return {"cameras": [], "coveragePct": 0}

    half_angle = math.radians(fov / 2)
    cos_half = math.cos(half_angle)
    down = np.array([0, 0, -1], dtype=np.float64)

    uw_indices = np.where(underwater_mask)[0]
    uw_centers = face_centers[uw_indices]
    uw_areas = face_areas[uw_indices]
    covered = np.zeros(len(uw_indices), dtype=bool)

    # Build candidate grid
    step_x = (bbox_max[0] - bbox_min[0]) / 25
    step_y = (bbox_max[1] - bbox_min[1]) / 25

    # For each candidate, find the mesh Z at that XY (nearest face center)
    xs = np.arange(bbox_min[0], bbox_max[0], step_x)
    ys = np.arange(bbox_min[1], bbox_max[1], step_y)
    xx, yy = np.meshgrid(xs, ys)
    candidates_xy = np.column_stack([xx.ravel(), yy.ravel()])

    # Find nearest face Z for each candidate
    from scipy.spatial import cKDTree
    tree = cKDTree(uw_centers[:, :2])
    _, nearest_idx = tree.query(candidates_xy)
    candidates_z = uw_centers[nearest_idx, 2]

    # Filter: only keep candidates with z < 0
    valid = candidates_z < 0
    candidates_xy = candidates_xy[valid]
    candidates_z = candidates_z[valid]

    placed_cameras = []

    for _ in range(num_cameras):
        best_score = -1
        best_idx = -1

        for ci in range(len(candidates_xy)):
            cx, cy = candidates_xy[ci]
            cz = candidates_z[ci]
            cam_pos = np.array([cx, cy, cz + 0.5])
            depth = abs(cz)
            eff_range = vis_range * max(0.2, 1 - depth / 40)

            to_face = uw_centers - cam_pos
            dists = np.linalg.norm(to_face, axis=1)
            in_range = dists <= eff_range
            below = to_face[:, 2] < 0
            to_face_norm = to_face / np.maximum(dists[:, None], 1e-10)
            cos_angle = np.dot(to_face_norm, down)
            in_fov = cos_angle >= cos_half

            newly_covered = in_range & below & in_fov & ~covered
            score = float(uw_areas[newly_covered].sum())

            if score > best_score:
                best_score = score
                best_idx = ci

        if best_idx < 0 or best_score <= 0:
            break

        # Place this camera
        cx, cy = candidates_xy[best_idx]
        cz = float(candidates_z[best_idx])
        placed_cameras.append({"x": float(cx), "y": float(cy), "anchorZ": cz})

        # Update covered
        cam_pos = np.array([cx, cy, cz + 0.5])
        depth = abs(cz)
        eff_range = vis_range * max(0.2, 1 - depth / 40)
        to_face = uw_centers - cam_pos
        dists = np.linalg.norm(to_face, axis=1)
        in_range = dists <= eff_range
        below = to_face[:, 2] < 0
        to_face_norm = to_face / np.maximum(dists[:, None], 1e-10)
        cos_angle = np.dot(to_face_norm, down)
        in_fov = cos_angle >= cos_half
        covered |= (in_range & below & in_fov)

        # Remove from candidates
        candidates_xy = np.delete(candidates_xy, best_idx, axis=0)
        candidates_z = np.delete(candidates_z, best_idx)

    covered_area = float(uw_areas[covered].sum())
    pct = (covered_area / total_underwater_area * 100) if total_underwater_area > 0 else 0

    return {
        "cameras": placed_cameras,
        "coveragePct": round(pct, 2),
        "coveredArea": round(covered_area, 1),
        "totalArea": round(total_underwater_area, 1),
    }


# =============================================
#  HTTP SERVER
# =============================================

class CoverageHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # quiet

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/coverage/info":
            data = {
                "loaded": face_centers is not None,
                "bboxMin": bbox_min,
                "bboxMax": bbox_max,
                "totalArea": round(total_underwater_area, 1),
                "underwaterFaces": int(underwater_mask.sum()) if underwater_mask is not None else 0,
            }
            self._json_response(data)
        else:
            self.send_error(404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        if self.path == "/api/coverage/compute":
            result = compute_coverage(
                cameras=body.get("cameras", []),
                fov=body.get("fov", 60),
                vis_range=body.get("visRange", 15),
                ascent=body.get("ascent", 0),
            )
            self._json_response(result)

        elif self.path == "/api/coverage/optimize":
            result = optimize_placement(
                num_cameras=body.get("numCameras", 5),
                fov=body.get("fov", 60),
                vis_range=body.get("visRange", 15),
            )
            self._json_response(result)

        else:
            self.send_error(404)

    def _json_response(self, data):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    if not load_mesh():
        exit(1)

    port = 3001
    server = http.server.HTTPServer(("0.0.0.0", port), CoverageHandler)
    print(f"Coverage API -> http://localhost:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStop.")
