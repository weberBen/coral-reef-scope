import * as THREE from 'three';
import { P, N, mbl } from './params.js';
import { nodes, forces, currentAt, simTime } from './physics.js';
import { waterVertexShader, waterFragmentShader } from './shaders.js';
import { getSceneColors } from './theme.js';

const MAX_FLOATS = 8;
const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();

export class MooringObjects {
  constructor(scene) {
    this.scene = scene;
    this.exportGroup = new THREE.Group();
    this.exportGroup.name = 'MooringSystem';
    scene.add(this.exportGroup);

    this._createWater();
    this._createSeabed();
    this._createAnchor();
    this._createCable();
    this._createDevice();
    this._createFloats();
    this._createForceArrows();
    this._createVerticalRef();
    this._createCurrentArrows();
    this._createParticles();
  }

  // ===== WATER =====

  _createWater() {
    const geo = new THREE.PlaneGeometry(200, 200, 128, 128);
    geo.rotateX(-Math.PI / 2);

    const tc = getSceneColors();
    this.waterUniforms = {
      uTime: { value: 0 },
      uWaveHeight: { value: P.wh },
      uWavePeriod: { value: P.wt },
      uWaveDir: { value: P.curDir * Math.PI / 180 },
      uDeepColor: { value: new THREE.Vector3(...tc.waterDeep) },
      uSurfColor: { value: new THREE.Vector3(...tc.waterSurf) },
      uHorizColor: { value: new THREE.Vector3(...tc.waterHoriz) },
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: this.waterUniforms,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.water = new THREE.Mesh(geo, mat);
    this.water.renderOrder = 1;
    this.scene.add(this.water);
  }

  // ===== SEABED =====

  _createSeabed() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Sandy base
    ctx.fillStyle = '#7a6545';
    ctx.fillRect(0, 0, 512, 512);

    // Noise grains
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      const b = Math.random() * 30 - 15;
      ctx.fillStyle = `rgb(${122 + b},${101 + b},${69 + b})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 2.5 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dark patches
    for (let i = 0; i < 25; i++) {
      ctx.fillStyle = `rgba(40,35,25,${Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 18 + 5, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);

    // Caustics light map (animated)
    const caustCanvas = document.createElement('canvas');
    caustCanvas.width = 256; caustCanvas.height = 256;
    this._caustCtx = caustCanvas.getContext('2d');
    this._caustTex = new THREE.CanvasTexture(caustCanvas);
    this._caustTex.wrapS = this._caustTex.wrapT = THREE.RepeatWrapping;
    this._caustTex.repeat.set(6, 6);

    const geo = new THREE.PlaneGeometry(200, 200);
    geo.rotateX(-Math.PI / 2);
    // lightMap requires uv2 — copy from uv
    geo.setAttribute('uv2', geo.attributes.uv.clone());
    const mat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.9, metalness: 0.05, color: 0x8B7355,
      lightMap: this._caustTex, lightMapIntensity: 0.6
    });

    this.seabed = new THREE.Mesh(geo, mat);
    this.seabed.position.y = -P.D;
    this.seabed.receiveShadow = true;
    this.scene.add(this.seabed);
  }

  _updateCaustics() {
    const ctx = this._caustCtx;
    const w = 256;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, w, w);
    const t = simTime * 0.8;
    for (let i = 0; i < 18; i++) {
      const cx = w / 2 + Math.sin(t * 0.7 + i * 1.1) * 60 + Math.cos(t * 0.3 + i * 2.3) * 40;
      const cy = w / 2 + Math.cos(t * 0.5 + i * 0.9) * 60 + Math.sin(t * 0.4 + i * 1.7) * 40;
      const r = 30 + Math.sin(t + i) * 15;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, 'rgba(180,220,255,0.35)');
      gradient.addColorStop(1, 'rgba(180,220,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    this._caustTex.needsUpdate = true;
  }

  // ===== ANCHOR + WINCH =====

  _createAnchor() {
    const group = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.7, roughness: 0.3 });
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x718096, metalness: 0.8, roughness: 0.2 });

    // Base plate
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.8), baseMat);
    base.castShadow = true;
    group.add(base);

    // Winch drum
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 16), drumMat);
    drum.rotation.z = Math.PI / 2;
    drum.position.y = 0.35;
    drum.castShadow = true;
    group.add(drum);

    // Side flanges
    for (const s of [-1, 1]) {
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16), baseMat);
      flange.rotation.z = Math.PI / 2;
      flange.position.set(s * 0.28, 0.35, 0);
      group.add(flange);
    }

    group.position.set(0, -P.D, 0);
    this.anchor = group;
    this.scene.add(group);
    this.exportGroup.add(group.clone());
  }

  // ===== CABLE =====

  _createCable() {
    const segGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
    this.cableSegments = [];

    for (let i = 0; i < N; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.2 });
      const mesh = new THREE.Mesh(segGeo, mat);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.cableSegments.push(mesh);
    }
  }

  // ===== DEVICE (camera + battery + float) =====

  _createDevice() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.15, roughness: 0.5 });
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, metalness: 0.9, roughness: 0.1 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.4, roughness: 0.3 });
    const battMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.3, roughness: 0.4 });
    const floatMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.1, roughness: 0.6, emissive: 0xf97316, emissiveIntensity: 0.15 });

    // Body housing
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.3), bodyMat);
    body.castShadow = true;
    group.add(body);

    // Camera lens
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), lensMat);
    lens.position.set(0, -0.05, 0.18);
    group.add(lens);

    // Lens ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 8, 24), ringMat);
    ring.position.set(0, -0.05, 0.17);
    group.add(ring);

    // Battery strip
    const batt = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.07, 0.25), battMat);
    batt.position.y = -0.25;
    group.add(batt);

    // Integrated float (orange sphere on top)
    const flt = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), floatMat);
    flt.position.y = 0.48;
    flt.castShadow = true;
    group.add(flt);

    // Small rod connecting float to body
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
    );
    rod.position.y = 0.35;
    group.add(rod);

    this.device = group;
    this.scene.add(group);
  }

  // ===== INTERMEDIATE FLOATS =====

  _createFloats() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xfde68a, metalness: 0.1, roughness: 0.5 });
    const outlineMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.3, roughness: 0.4 });
    const geo = new THREE.SphereGeometry(0.14, 12, 12);
    this.floatMeshes = [];

    for (let i = 0; i < MAX_FLOATS; i++) {
      const group = new THREE.Group();
      const sphere = new THREE.Mesh(geo, mat);
      sphere.castShadow = true;
      group.add(sphere);

      // Equatorial band
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.015, 6, 16), outlineMat);
      group.add(band);

      group.visible = false;
      this.scene.add(group);
      this.floatMeshes.push(group);
    }
  }

  // ===== FORCE ARROWS =====

  _createForceArrows() {
    this.forceArrows = [];
    const colors = [0x38bdf8, 0xf97316, 0xef4444, 0x34d399, 0xa78bfa];

    // Create arrows for: anchor(1) + device(1) + floats(MAX_FLOATS) + cable samples(6)
    const count = 2 + MAX_FLOATS + 6;
    for (let i = 0; i < count; i++) {
      const arrow = new THREE.ArrowHelper(UP, new THREE.Vector3(), 1, colors[i % colors.length], 0.2, 0.1);
      arrow.visible = false;
      this.scene.add(arrow);
      this.forceArrows.push(arrow);
    }
  }

  // ===== VERTICAL REFERENCE LINE =====

  _createVerticalRef() {
    const mat = new THREE.LineDashedMaterial({
      color: 0x38bdf8, dashSize: 0.5, gapSize: 0.3, transparent: true, opacity: 0.35
    });
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -P.D, 0),
      new THREE.Vector3(0, 2, 0)
    ]);
    this.vertRef = new THREE.Line(geo, mat);
    this.vertRef.computeLineDistances();
    this.scene.add(this.vertRef);
  }

  // ===== CURRENT ARROWS =====

  _createCurrentArrows() {
    this.currentArrows = [];
    for (let i = 0; i < 8; i++) {
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x7dd3fc, 0.15, 0.08
      );
      arrow.line.material.transparent = true;
      arrow.line.material.opacity = 0.4;
      arrow.cone.material.transparent = true;
      arrow.cone.material.opacity = 0.5;
      this.scene.add(arrow);
      this.currentArrows.push(arrow);
    }
  }

  // ===== PARTICLES (plankton + bubbles) =====

  _createParticles() {
    // Plankton — small white drifting particles
    const planktonCount = 400;
    const planktonPos = new Float32Array(planktonCount * 3);
    for (let i = 0; i < planktonCount; i++) {
      planktonPos[i * 3] = (Math.random() - 0.5) * 60;
      planktonPos[i * 3 + 1] = -Math.random() * P.D;
      planktonPos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const planktonGeo = new THREE.BufferGeometry();
    planktonGeo.setAttribute('position', new THREE.BufferAttribute(planktonPos, 3));
    this.plankton = new THREE.Points(planktonGeo, new THREE.PointsMaterial({
      color: 0xccddee, size: 0.05, transparent: true, opacity: 0.2,
      sizeAttenuation: true, depthWrite: false
    }));
    this.scene.add(this.plankton);

    // Bubbles — larger, rising slowly
    const bubbleCount = 60;
    const bubblePos = new Float32Array(bubbleCount * 3);
    const bubbleSizes = new Float32Array(bubbleCount);
    for (let i = 0; i < bubbleCount; i++) {
      bubblePos[i * 3] = (Math.random() - 0.5) * 30;
      bubblePos[i * 3 + 1] = -Math.random() * P.D;
      bubblePos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      bubbleSizes[i] = 0.04 + Math.random() * 0.08;
    }
    const bubbleGeo = new THREE.BufferGeometry();
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));
    bubbleGeo.setAttribute('size', new THREE.BufferAttribute(bubbleSizes, 1));
    this.bubbles = new THREE.Points(bubbleGeo, new THREE.PointsMaterial({
      color: 0xaaddff, size: 0.1, transparent: true, opacity: 0.35,
      sizeAttenuation: true, depthWrite: false
    }));
    this.scene.add(this.bubbles);
  }

  // ===================================================================
  //  UPDATE (called each frame)
  // ===================================================================

  update(tensions) {
    this._updateWater();
    this._updateCable(tensions);
    this._updateDevice();
    this._updateFloats();
    this._updateForceArrows(tensions);
    this._updateVerticalRef();
    this._updateCurrentArrows();
    this._updateParticles();
    this._updateCaustics();
    this._updateAnchorPos();
    this._updateSeabedPos();
    this._rebuildExportGroup(tensions);
  }

  updateDepth() {
    this.anchor.position.y = -P.D;
    this.seabed.position.y = -P.D;

    // Update vertical ref
    const pts = this.vertRef.geometry.attributes.position.array;
    pts[1] = -P.D; // bottom y
    this.vertRef.geometry.attributes.position.needsUpdate = true;
    this.vertRef.computeLineDistances();
  }

  // --- Water ---

  _updateWater() {
    const u = this.waterUniforms;
    u.uTime.value = simTime;
    u.uWaveHeight.value = P.wh;
    u.uWavePeriod.value = P.wt;
    u.uWaveDir.value = P.curDir * Math.PI / 180;
  }

  // --- Cable ---

  _updateCable(tensions) {
    const radius = Math.max(0.008, P.dia / 2000) * 8; // visual scale factor

    // Find max force magnitude for auto-scaling the gradient
    let maxF = 1;
    for (let i = 1; i <= N; i++) {
      const f = forces[i].total;
      const mag = Math.hypot(f.x, f.y, f.z);
      if (mag > maxF) maxF = mag;
    }

    for (let i = 0; i < N; i++) {
      const mesh = this.cableSegments[i];
      mesh.visible = true;

      const a = nodes[i], b = nodes[i + 1];
      _dir.set(b.x - a.x, b.y - a.y, b.z - a.z);
      const len = _dir.length() || 0.01;
      _mid.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);

      mesh.position.copy(_mid);
      mesh.scale.set(radius, len, radius);
      mesh.quaternion.setFromUnitVectors(UP, _dir.normalize());

      // Color by force: green (low) → yellow → red (high), smooth Hermite blend
      const LOW = new THREE.Color('#34d399');
      const MID = new THREE.Color('#fbbf24');
      const HIGH = new THREE.Color('#ef4444');
      const f = forces[i + 1].total;
      const frac = Math.min(1, Math.hypot(f.x, f.y, f.z) / maxF);
      const t = frac * frac * (3 - 2 * frac); // smoothstep
      const cLow = new THREE.Color().lerpColors(LOW, MID, t);
      const cHigh = new THREE.Color().lerpColors(MID, HIGH, t);
      mesh.material.color.lerpColors(cLow, cHigh, t);
    }
  }

  // --- Device ---

  _updateDevice() {
    const dv = nodes[N];
    this.device.position.set(dv.x, dv.y, dv.z);
  }

  // --- Intermediate floats ---

  _updateFloats() {
    const floatIndices = [];
    for (let j = 1; j <= P.fn; j++) {
      floatIndices.push(Math.round(j * N / (P.fn + 1)));
    }

    for (let i = 0; i < MAX_FLOATS; i++) {
      if (i < floatIndices.length) {
        const ni = floatIndices[i];
        const nd = nodes[ni];
        this.floatMeshes[i].position.set(nd.x, nd.y, nd.z);
        this.floatMeshes[i].visible = true;
      } else {
        this.floatMeshes[i].visible = false;
      }
    }
  }

  // --- Force arrows ---

  _updateForceArrows(tensions) {
    const show = P.showForces;
    let idx = 0;

    // Anchor arrow (total anchor force)
    const aArrow = this.forceArrows[idx++];
    if (show) {
      const scale = 0.005;
      const len = tensions.anchorT * scale;
      _dir.set(0, -1, 0); // anchor force points down (reaction)
      aArrow.position.set(0, -P.D + 0.5, 0);
      aArrow.setDirection(_dir);
      aArrow.setLength(Math.max(0.3, len), 0.15, 0.08);
      aArrow.setColor(new THREE.Color(0xef4444));
    }
    aArrow.visible = show;

    // Device arrow (net upward)
    const dArrow = this.forceArrows[idx++];
    if (show) {
      const dv = nodes[N];
      _dir.set(0, 1, 0);
      dArrow.position.set(dv.x, dv.y + 0.4, dv.z);
      dArrow.setDirection(_dir);
      dArrow.setLength(Math.max(0.3, P.db * 0.005), 0.15, 0.08);
      dArrow.setColor(new THREE.Color(0x34d399));
    }
    dArrow.visible = show;

    // Float arrows
    const floatIndices = [];
    for (let j = 1; j <= P.fn; j++) floatIndices.push(Math.round(j * N / (P.fn + 1)));

    for (let i = 0; i < MAX_FLOATS; i++) {
      const arrow = this.forceArrows[idx++];
      if (show && i < floatIndices.length) {
        const ni = floatIndices[i];
        const nd = nodes[ni];
        _dir.set(0, 1, 0);
        arrow.position.set(nd.x, nd.y + 0.25, nd.z);
        arrow.setDirection(_dir);
        arrow.setLength(Math.max(0.2, P.fb * 0.004), 0.12, 0.06);
        arrow.setColor(new THREE.Color(0xfde68a));
        arrow.visible = true;
      } else {
        arrow.visible = false;
      }
    }

    // Cable sample arrows (drag direction, every 4th node)
    for (let s = 0; s < 6; s++) {
      const arrow = this.forceArrows[idx++];
      const ni = Math.min(N, Math.round((s + 1) * N / 7));
      if (show && ni > 0 && ni <= N) {
        const nd = nodes[ni];
        const cur = currentAt(nd.y);
        const mag = Math.hypot(cur.x, cur.z);
        if (mag > 0.01) {
          _dir.set(cur.x, 0, cur.z).normalize();
          arrow.position.set(nd.x, nd.y, nd.z);
          arrow.setDirection(_dir);
          arrow.setLength(Math.max(0.2, mag * 1.5), 0.1, 0.06);
          arrow.setColor(new THREE.Color(0x38bdf8));
          arrow.visible = true;
        } else {
          arrow.visible = false;
        }
      } else {
        arrow.visible = false;
      }
    }
  }

  // --- Vertical reference ---

  _updateVerticalRef() {
    this.vertRef.visible = P.showVertRef;
  }

  // --- Current arrows ---

  _updateCurrentArrows() {
    const show = P.showCurrentGrid;
    const spacing = P.D / (this.currentArrows.length + 1);

    for (let i = 0; i < this.currentArrows.length; i++) {
      const arrow = this.currentArrows[i];
      if (!show) { arrow.visible = false; continue; }

      const depth = -(i + 1) * spacing;
      const cur = currentAt(depth);
      const mag = Math.hypot(cur.x, cur.z);

      if (mag < 0.01) { arrow.visible = false; continue; }

      arrow.visible = true;
      _dir.set(cur.x, 0, cur.z).normalize();
      arrow.position.set(-8, depth, 0);
      arrow.setDirection(_dir);
      arrow.setLength(Math.max(0.3, mag * 3), 0.15, 0.08);
    }
  }

  // --- Particles ---

  _updateParticles() {
    // Plankton: drift with current
    const pp = this.plankton.geometry.attributes.position.array;
    for (let i = 0, n = pp.length / 3; i < n; i++) {
      const y = pp[i * 3 + 1];
      const cur = currentAt(y);
      pp[i * 3] += cur.x * 0.003 + (Math.random() - 0.5) * 0.003;
      pp[i * 3 + 1] += (Math.random() - 0.5) * 0.002;
      pp[i * 3 + 2] += cur.z * 0.003 + (Math.random() - 0.5) * 0.003;
      if (pp[i * 3] > 30) pp[i * 3] -= 60;
      if (pp[i * 3] < -30) pp[i * 3] += 60;
      if (pp[i * 3 + 2] > 30) pp[i * 3 + 2] -= 60;
      if (pp[i * 3 + 2] < -30) pp[i * 3 + 2] += 60;
      if (pp[i * 3 + 1] > 0) pp[i * 3 + 1] = -P.D * Math.random();
      if (pp[i * 3 + 1] < -P.D) pp[i * 3 + 1] = -Math.random() * 2;
    }
    this.plankton.geometry.attributes.position.needsUpdate = true;

    // Bubbles: rise slowly + slight wobble
    const bp = this.bubbles.geometry.attributes.position.array;
    for (let i = 0, n = bp.length / 3; i < n; i++) {
      bp[i * 3] += (Math.random() - 0.5) * 0.015;
      bp[i * 3 + 1] += 0.008 + Math.random() * 0.006; // rise
      bp[i * 3 + 2] += (Math.random() - 0.5) * 0.015;
      // Respawn at bottom when reaching surface
      if (bp[i * 3 + 1] > 0) {
        bp[i * 3] = (Math.random() - 0.5) * 30;
        bp[i * 3 + 1] = -P.D + Math.random() * 3;
        bp[i * 3 + 2] = (Math.random() - 0.5) * 30;
      }
    }
    this.bubbles.geometry.attributes.position.needsUpdate = true;
  }

  // --- Helpers ---

  _updateAnchorPos() {
    this.anchor.position.y = -P.D;
  }

  _updateSeabedPos() {
    this.seabed.position.y = -P.D;
  }

  _rebuildExportGroup(tensions) {
    // Rebuild on next export call (lazy)
    this._latestTensions = tensions;
  }

  /** Build fresh geometry group for OBJ export */
  buildExportGeometry() {
    const group = new THREE.Group();
    group.name = 'MooringSystem';

    // Anchor
    group.add(this.anchor.clone());

    // Cable as tube
    const points = nodes.map(n => new THREE.Vector3(n.x, n.y, n.z));
    const curve = new THREE.CatmullRomCurve3(points);
    const radius = Math.max(0.008, P.dia / 2000) * 8; // visual scale factor
    const tubeGeo = new THREE.TubeGeometry(curve, N * 4, radius, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.name = 'Cable';
    group.add(tube);

    // Device
    const deviceClone = this.device.clone();
    deviceClone.name = 'Device';
    group.add(deviceClone);

    // Visible floats
    for (let i = 0; i < MAX_FLOATS; i++) {
      if (this.floatMeshes[i].visible) {
        const c = this.floatMeshes[i].clone();
        c.name = `Float_${i}`;
        group.add(c);
      }
    }

    return group;
  }
}
