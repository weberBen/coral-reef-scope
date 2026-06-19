/**
 * Main app: wires map picker, Allen fetch, KJMA, and Three.js viewer.
 */

import { MapPicker } from "./map-picker.js";
import { fetchAllenTerrain } from "./allen.js";
import { generateReef, heightmapToMesh } from "./kjma.js";
import { ReefViewer } from "./viewer.js";

// ── DOM elements ──
const bboxDisplay = document.getElementById("bbox-display");
const btnGenerate = document.getElementById("btn-generate");
const btnLoadGlb = document.getElementById("btn-load-glb");
const fileInput = document.getElementById("file-input");
const statusEl = document.getElementById("status");
const progressBar = document.getElementById("progress-bar");
const progressFill = progressBar.querySelector(".fill");

const zExagSlider = document.getElementById("z-exag");
const zExagVal = document.getElementById("z-exag-val");
const opacitySlider = document.getElementById("opacity");
const opacityVal = document.getElementById("opacity-val");
const wireframeCheck = document.getElementById("wireframe");
const autoRotateCheck = document.getElementById("auto-rotate");

const infoVerts = document.getElementById("info-verts");
const infoFaces = document.getElementById("info-faces");
const infoDepth = document.getElementById("info-depth");
const infoSize = document.getElementById("info-size");
const infoSource = document.getElementById("info-source");

const viewerContainer = document.getElementById("viewer");
const dropOverlay = document.getElementById("drop-overlay");

// ── State ──
let currentBbox = null;
let generating = false;

// ── Status helpers ──
function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className = type;
}

function setProgress(pct) {
  if (pct < 0) {
    progressBar.style.display = "none";
    return;
  }
  progressBar.style.display = "block";
  progressFill.style.width = `${pct}%`;
}

function updateInfo(info, source = "-") {
  if (!info) return;
  infoVerts.textContent = info.nVerts?.toLocaleString() || "-";
  infoFaces.textContent = info.nFaces?.toLocaleString() || "-";
  if (info.depthMin !== undefined && info.depthMax !== undefined) {
    infoDepth.textContent = `${info.depthMin.toFixed(1)} - ${info.depthMax.toFixed(1)} m`;
  }
  if (info.extentX && info.extentY) {
    infoSize.textContent = `${info.extentX.toFixed(0)} x ${info.extentY.toFixed(0)} m`;
  }
  infoSource.textContent = source;
}

// ── Map picker ──
const mapPicker = new MapPicker("map", (bbox) => {
  currentBbox = bbox;
  if (bbox) {
    bboxDisplay.textContent =
      `${bbox[0].toFixed(4)}, ${bbox[1].toFixed(4)} → ${bbox[2].toFixed(4)}, ${bbox[3].toFixed(4)}`;
    btnGenerate.disabled = false;
  } else {
    bboxDisplay.textContent = "Draw a rectangle on the map";
    btnGenerate.disabled = true;
  }
});

// ── 3D Viewer ──
const viewer = new ReefViewer(viewerContainer);

// ── Sliders ──
zExagSlider.addEventListener("input", () => {
  const v = parseFloat(zExagSlider.value);
  zExagVal.textContent = v.toFixed(1);
  viewer.setZExag(v);
});

opacitySlider.addEventListener("input", () => {
  const v = parseFloat(opacitySlider.value);
  opacityVal.textContent = v.toFixed(2);
  viewer.setOpacity(v);
});

wireframeCheck.addEventListener("change", () => {
  viewer.setWireframe(wireframeCheck.checked);
});

autoRotateCheck.addEventListener("change", () => {
  viewer.setAutoRotate(autoRotateCheck.checked);
});

// ── Generate reef ──
btnGenerate.addEventListener("click", async () => {
  if (!currentBbox || generating) return;
  generating = true;
  btnGenerate.disabled = true;

  const resolution = parseFloat(document.getElementById("param-resolution").value) || 33;
  const maxHeight = parseFloat(document.getElementById("param-max-height").value) || 0.5;
  const anisotropy = parseFloat(document.getElementById("param-anisotropy").value) || 2.0;
  const density = parseFloat(document.getElementById("param-density").value) || 0.004;

  // Convert resolution from meters to degrees (~)
  const latCenter = (currentBbox[1] + currentBbox[3]) / 2;
  const mPerDeg = 111320 * Math.cos((latCenter * Math.PI) / 180);
  const resDeg = resolution / mPerDeg;

  try {
    setProgress(10);

    // 1. Fetch Allen data
    setStatus("Fetching Allen Coral Atlas data...");
    const terrain = await fetchAllenTerrain(currentBbox, resDeg, (msg) => setStatus(msg));
    setProgress(40);

    if (terrain.nFeatures === 0) {
      setStatus("No Allen data for this area. Empty terrain generated.", "error");
      const mesh = heightmapToMesh(
        terrain.heightmap, terrain.xCoords, terrain.yCoords, terrain.nx, terrain.ny
      );
      viewer.setGeneratedMesh(mesh);
      updateInfo(viewer.getInfo(), "Allen (vide)");
      setProgress(-1);
      generating = false;
      btnGenerate.disabled = false;
      return;
    }

    // 2. KJMA nucleation
    setStatus("KJMA nucleation...");
    setProgress(50);

    // Use setTimeout to let the UI update
    await new Promise((r) => setTimeout(r, 50));

    const mesh = generateReef(terrain, {
      seed: 42,
      anisotropy,
      maxHeight,
      density,
      boundarySharpness: 3.0,
    }, (msg) => setStatus(msg));

    setProgress(90);

    // 3. Display
    setStatus("Displaying...");
    viewer.setGeneratedMesh(mesh);
    updateInfo(viewer.getInfo(), "Allen + KJMA");

    setStatus(`Reef generated: ${mesh.nVerts.toLocaleString()} vertices`, "success");
    setProgress(-1);
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, "error");
    setProgress(-1);
  }

  generating = false;
  btnGenerate.disabled = false;
});

// ── Load GLB ──
btnLoadGlb.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await loadGlbFile(file);
  fileInput.value = "";
});

async function loadGlbFile(file) {
  setStatus(`Loading ${file.name}...`);
  setProgress(30);
  try {
    const buffer = await file.arrayBuffer();
    setProgress(60);
    const info = await viewer.loadGlb(buffer);
    updateInfo(info, file.name);
    setStatus(`${file.name} loaded`, "success");
    setProgress(-1);
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, "error");
    setProgress(-1);
  }
}

// ── Drag & drop GLB ──
viewerContainer.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropOverlay.style.display = "flex";
});

viewerContainer.addEventListener("dragleave", () => {
  dropOverlay.style.display = "none";
});

viewerContainer.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropOverlay.style.display = "none";
  const file = e.dataTransfer?.files?.[0];
  if (file && (file.name.endsWith(".glb") || file.name.endsWith(".gltf"))) {
    await loadGlbFile(file);
  }
});

// ── Load existing reef.glb on startup ──
async function tryLoadExisting() {
  try {
    const resp = await fetch("/data/reef.glb", { method: "HEAD" });
    if (resp.ok) {
      setStatus("Loading existing reef.glb...");
      const info = await viewer.loadGlb("/data/reef.glb");
      updateInfo(info, "data/reef.glb");
      setStatus("reef.glb loaded", "success");
    }
  } catch {
    // no existing file, that's fine
  }
}

tryLoadExisting();
