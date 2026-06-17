/**
 * Three.js 3D viewer with depth coloring, Z exaggeration, and GLB loading.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

// Depth colormap (matches Python viz.py)
const DEPTH_CMAP = [
  [0.0, [230, 255, 200]],
  [0.1, [160, 230, 100]],
  [0.25, [80, 200, 180]],
  [0.4, [30, 160, 200]],
  [0.55, [20, 100, 180]],
  [0.75, [15, 50, 140]],
  [1.0, [5, 15, 60]],
];

function depthColor(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < DEPTH_CMAP.length - 1; i++) {
    const [t0, c0] = DEPTH_CMAP[i];
    const [t1, c1] = DEPTH_CMAP[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return [
        (c0[0] + f * (c1[0] - c0[0])) / 255,
        (c0[1] + f * (c1[1] - c0[1])) / 255,
        (c0[2] + f * (c1[2] - c0[2])) / 255,
      ];
    }
  }
  return [5 / 255, 15 / 255, 60 / 255];
}

export class ReefViewer {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060a12);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
    this.camera.position.set(8, 8, 8);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 1.0;

    // Lights
    const ambient = new THREE.AmbientLight(0x405060, 0.6);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 10, 8);
    this.scene.add(dir);

    const dir2 = new THREE.DirectionalLight(0x8899aa, 0.4);
    dir2.position.set(-5, -3, 4);
    this.scene.add(dir2);

    // Grid helper
    this.gridHelper = new THREE.GridHelper(20, 40, 0x1a2a3a, 0x0d1520);
    this.scene.add(this.gridHelper);

    // State
    this.reefMesh = null;
    this.originalVertices = null; // before Z exag
    this.zExag = 5.0;
    this.isGlbMode = false; // true when displaying a loaded GLB
    this.meshInfo = null;

    // Resize
    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    this.resize();

    // Animate
    this._animate();
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Display a generated mesh from KJMA output.
   * meshData: { vertices: Float64Array, faces: Uint32Array, nVerts, nFaces }
   */
  setGeneratedMesh(meshData) {
    this._clearMesh();
    this.isGlbMode = false;

    const { vertices, faces, nVerts, nFaces } = meshData;

    // Center and normalize
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < nVerts; i++) {
      const x = vertices[i * 3], y = vertices[i * 3 + 1], z = vertices[i * 3 + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const extent = Math.max(maxX - minX, maxY - minY);
    const scale = 10 / (extent || 1);

    // Store original Z (real depth in meters) for info
    this.meshInfo = {
      depthMin: -maxZ,
      depthMax: -minZ,
      extentX: maxX - minX,
      extentY: maxY - minY,
      nVerts,
      nFaces,
    };

    // Create normalized vertices
    const normVerts = new Float32Array(nVerts * 3);
    for (let i = 0; i < nVerts; i++) {
      normVerts[i * 3 + 0] = (vertices[i * 3 + 0] - cx) * scale;
      normVerts[i * 3 + 1] = (vertices[i * 3 + 1] - cy) * scale;
      normVerts[i * 3 + 2] = vertices[i * 3 + 2] * scale;
    }

    // Store originals for Z exag
    this.originalVertices = new Float32Array(normVerts);

    // Depth colors (based on original Z, not exaggerated)
    const colors = new Float32Array(nVerts * 3);
    for (let i = 0; i < nVerts; i++) {
      const z = normVerts[i * 3 + 2];
      const zMin = minZ * scale;
      const zMax = maxZ * scale;
      const t = (z - zMin) / ((zMax - zMin) || 1);
      const [r, g, b] = depthColor(t);
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    // Build geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(normVerts, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Index
    const index = new Uint32Array(nFaces * 3);
    for (let i = 0; i < nFaces * 3; i++) index[i] = faces[i];
    geometry.setIndex(new THREE.BufferAttribute(index, 1));

    geometry.computeVertexNormals();

    // Double-sided material with vertex colors
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      shininess: 20,
      transparent: true,
      opacity: 1.0,
    });

    this.reefMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.reefMesh);

    // Apply current Z exaggeration
    this._applyZExag();

    // Fit camera
    this._fitCamera();
  }

  /**
   * Load and display a GLB file.
   */
  async loadGlb(urlOrBuffer) {
    this._clearMesh();
    this.isGlbMode = true;
    this.originalVertices = null;

    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      const onLoad = (gltf) => {
        const group = gltf.scene;

        // Compute total bounding box
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 10 / (maxDim || 1);

        // Center and scale
        group.position.sub(center);
        group.scale.multiplyScalar(scale);

        // Collect mesh info
        let totalVerts = 0, totalFaces = 0;
        group.traverse((child) => {
          if (child.isMesh) {
            totalVerts += child.geometry.attributes.position?.count || 0;
            totalFaces += (child.geometry.index?.count || 0) / 3;

            // If no vertex colors and no texture, add depth coloring
            if (!child.geometry.attributes.color && !child.material.map) {
              const pos = child.geometry.attributes.position;
              const colors = new Float32Array(pos.count * 3);
              // Need world positions for depth
              child.updateMatrixWorld(true);
              const v = new THREE.Vector3();
              let zMin = Infinity, zMax = -Infinity;
              for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i);
                v.applyMatrix4(child.matrixWorld);
                v.multiplyScalar(scale);
                if (v.z < zMin) zMin = v.z;
                if (v.z > zMax) zMax = v.z;
              }
              for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i);
                v.applyMatrix4(child.matrixWorld);
                v.multiplyScalar(scale);
                const t = (v.z - zMin) / ((zMax - zMin) || 1);
                const [r, g, b] = depthColor(t);
                colors[i * 3] = r;
                colors[i * 3 + 1] = g;
                colors[i * 3 + 2] = b;
              }
              child.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
              child.material = new THREE.MeshPhongMaterial({
                vertexColors: true,
                side: THREE.DoubleSide,
                shininess: 20,
              });
            }

            // Make all meshes double-sided
            if (child.material) {
              child.material.side = THREE.DoubleSide;
            }
          }
        });

        this.meshInfo = {
          nVerts: totalVerts,
          nFaces: totalFaces,
          depthMin: 0,
          depthMax: 0,
          extentX: size.x,
          extentY: size.y,
        };

        // Store original positions for Z exag
        this._storeGlbOriginals(group, scale);

        this.reefMesh = group;
        this.scene.add(this.reefMesh);

        this._applyZExag();
        this._fitCamera();
        resolve(this.meshInfo);
      };

      if (urlOrBuffer instanceof ArrayBuffer) {
        loader.parse(urlOrBuffer, "", onLoad, reject);
      } else {
        loader.load(urlOrBuffer, onLoad, undefined, reject);
      }
    });
  }

  _storeGlbOriginals(group, scale) {
    // Store per-mesh original Z values for Z exag
    this._glbOriginals = [];
    group.traverse((child) => {
      if (child.isMesh && child.geometry.attributes.position) {
        const pos = child.geometry.attributes.position;
        const origZ = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) {
          origZ[i] = pos.getZ(i);
        }
        this._glbOriginals.push({ mesh: child, origZ, pos });
      }
    });
  }

  /**
   * Apply Z exaggeration to current mesh.
   */
  _applyZExag() {
    if (this.isGlbMode && this._glbOriginals) {
      for (const { mesh, origZ, pos } of this._glbOriginals) {
        for (let i = 0; i < pos.count; i++) {
          pos.setZ(i, origZ[i] * this.zExag);
        }
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingSphere();
      }
    } else if (this.reefMesh && this.originalVertices) {
      const pos = this.reefMesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, this.originalVertices[i * 3 + 2] * this.zExag);
      }
      pos.needsUpdate = true;
      this.reefMesh.geometry.computeVertexNormals();
      this.reefMesh.geometry.computeBoundingSphere();
    }
  }

  setZExag(value) {
    this.zExag = value;
    this._applyZExag();
  }

  setOpacity(value) {
    if (this.isGlbMode && this.reefMesh) {
      this.reefMesh.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.transparent = value < 1;
          child.material.opacity = value;
        }
      });
    } else if (this.reefMesh) {
      this.reefMesh.material.transparent = value < 1;
      this.reefMesh.material.opacity = value;
    }
  }

  setWireframe(on) {
    if (this.isGlbMode && this.reefMesh) {
      this.reefMesh.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.wireframe = on;
        }
      });
    } else if (this.reefMesh) {
      this.reefMesh.material.wireframe = on;
    }
  }

  setAutoRotate(on) {
    this.controls.autoRotate = on;
  }

  _clearMesh() {
    if (this.reefMesh) {
      this.scene.remove(this.reefMesh);
      if (this.reefMesh.geometry) this.reefMesh.geometry.dispose();
      if (this.reefMesh.material) this.reefMesh.material.dispose();
      this.reefMesh = null;
    }
    this.originalVertices = null;
    this._glbOriginals = null;
  }

  _fitCamera() {
    const box = new THREE.Box3();
    if (this.reefMesh) {
      box.setFromObject(this.reefMesh);
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    this.controls.target.copy(center);
    this.camera.position.set(
      center.x + maxDim * 0.8,
      center.y + maxDim * 0.8,
      center.z + maxDim * 0.8
    );
    this.controls.update();
  }

  getInfo() {
    return this.meshInfo;
  }

  /**
   * Export current scene as GLB.
   */
  async exportGlb() {
    if (!this.reefMesh) return null;
    const exporter = new GLTFExporter();
    return new Promise((resolve) => {
      exporter.parse(
        this.reefMesh,
        (result) => resolve(result),
        (error) => { console.error(error); resolve(null); },
        { binary: true }
      );
    });
  }
}
