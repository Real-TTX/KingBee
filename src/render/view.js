import * as THREE from 'three';
import { UNIT, DX, DY, CELL, N, E, S, W } from '../game/constants.js';
import {
  beeGeometry, hornetGeometry, queenGeometry, wingGeometry, wingMaterial,
  creatureMaterial, makeHive, makeFlower, arrowGeometry,
} from './models.js';
import { Particles } from './particles.js';
import { Scenery } from './scenery.js';

const MAX_BEES = 480;
const VARIANT_TINT = { normal: '#ffffff', gold: '#ffe066', pollen: '#ff9ad8' };
const m4 = new THREE.Matrix4();
const m4b = new THREE.Matrix4();
const q = new THREE.Quaternion();
const v3 = new THREE.Vector3();
const sc = new THREE.Vector3();
const yAxis = new THREE.Vector3(0, 1, 0);
const zAxis = new THREE.Vector3(0, 0, 1);
const tmpCol = new THREE.Color();

const dirYaw = (d) => Math.atan2(DX[d], DY[d]); // creature yaw (+Z forward)
const arrowYaw = (d) => -d * Math.PI / 2;        // arrow yaw (north = -Z)
const lerpAngle = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class View {
  constructor(container) {
    this.container = container;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    this.renderer = r;

    this.overlay = document.createElement('div');
    this.overlay.className = 'world-overlay';
    container.appendChild(this.overlay);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#d4f0ff', 34, 110);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
    this.camBase = { pos: new THREE.Vector3(0, 12, 9), look: new THREE.Vector3() };
    this.camBack = new THREE.Vector3(0, 0, 1); // horizontal direction from board to camera
    this.camYaw = 0;
    this.portrait = false;
    this.camAnim = null;
    this.shake = 0;

    this.setupLights();
    this.scenery = new Scenery(this.scene);

    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);

    // instanced bees (live bees + ghosts)
    const mat = creatureMaterial();
    this.beeMesh = new THREE.InstancedMesh(beeGeometry(), mat, MAX_BEES);
    this.beeMesh.castShadow = true;
    this.beeMesh.frustumCulled = false;
    this.beeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.beeMesh.setColorAt(0, tmpCol.set('#fff'));
    const wGeo = wingGeometry();
    this.wingMesh = new THREE.InstancedMesh(wGeo, wingMaterial(), MAX_BEES * 2);
    this.wingMesh.frustumCulled = false;
    this.wingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.beeMesh, this.wingMesh);

    this.hornetGeo = hornetGeometry();
    this.hornetWingGeo = wingGeometry(1.5);
    this.hornetMat = creatureMaterial();
    this.hornetWingMat = wingMaterial();
    this.hornets = new Map();

    this.particles = new Particles(this.scene);
    this.state = new Map(); // id -> {yaw, x, z}
    this.ghosts = [];
    this.arrowObjs = new Map();
    this.arrowGeo = arrowGeometry();
    this.arrowMats = new Map();
    this.hiveObjs = [];
    this.labels = [];
    this.floaters = [];
    this.markers = [];
    this.cinematic = null;
    this.time = 0;
    this.flowerObjs = [];
    this.hiveAnims = [];
    this.flowerAnims = [];
    this.debris = [];
    this.rings = [];
    this.arrowSpinUntil = 0;

    this.hover = this.makeHover();
    this.scene.add(this.hover);

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ------------------------------------------------------------------ setup

  setupLights() {
    const hemi = new THREE.HemisphereLight('#fff8e6', '#5d8a3a', 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff1d0', 2.2);
    sun.position.set(-6, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.sun = sun;
    const fill = new THREE.DirectionalLight('#cfe8ff', 0.5);
    fill.position.set(8, 6, -6);
    this.scene.add(fill);
  }

  makeHover() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.47, 4, 1, Math.PI / 4),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(1.41);
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.94, 0.94),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false }),
    );
    fill.rotation.x = -Math.PI / 2;
    const arrow = new THREE.Mesh(
      arrowGeometry(),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }),
    );
    arrow.position.y = 0.06;
    arrow.scale.setScalar(1.1);
    arrow.visible = false;
    g.add(ring, fill, arrow);
    g.position.y = 0.012;
    g.visible = false;
    g.userData = { ring, fill, arrow };
    return g;
  }

  // ------------------------------------------------------------------ board

  /**
   * Build all static meshes for a board.
   * opts.colors: colour per hive owner; opts.labels: show score labels.
   */
  setBoard(board, opts) {
    this.board = board;
    this.opts = opts;
    this.levelGroup.clear();
    for (const o of this.arrowObjs.values()) o.mesh.removeFromParent();
    this.arrowObjs.clear();
    for (const h of this.hornets.values()) h.group.removeFromParent();
    this.hornets.clear();
    this.state.clear();
    this.ghosts.length = 0;
    this.particles.clear();
    for (const l of this.labels) l.el.remove();
    this.labels = [];
    for (const f of this.floaters) f.el.remove();
    this.floaters = [];
    this.clearMarkers();
    this.endCinematic();
    for (const d of this.debris) d.mesh.removeFromParent();
    this.debris = [];
    for (const r of this.rings) r.mesh.removeFromParent();
    this.rings = [];
    this.hiveAnims = [];
    this.flowerAnims = [];
    this.flowerObjs = [];
    const { w, h } = board;
    this.ox = -w / 2;
    this.oz = -h / 2;

    // base tray
    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.7, 0.42, h + 0.7),
      new THREE.MeshStandardMaterial({ color: '#9b6a35', roughness: 0.8 }),
    );
    tray.position.y = -0.21;
    tray.receiveShadow = true;
    tray.castShadow = true;
    this.levelGroup.add(tray);

    // tile surface
    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: this.boardTexture(board), roughness: 0.85 }),
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.001;
    top.receiveShadow = true;
    this.levelGroup.add(top);

    // holes: dark rim
    const rimMat = new THREE.MeshStandardMaterial({ color: '#5a3818', roughness: 1 });
    for (const hole of board.holes) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.05, 8, 24), rimMat);
      rim.rotation.x = -Math.PI / 2;
      const p = this.tileToWorld(hole.x, hole.y);
      rim.position.set(p.x, 0.01, p.z);
      this.levelGroup.add(rim);
    }

    // walls
    const segs = board.wallSegments();
    const wallGeo = new THREE.BoxGeometry(1.1, 0.34, 0.13);
    wallGeo.translate(0, 0.17, 0);
    const wallMesh = new THREE.InstancedMesh(
      wallGeo,
      new THREE.MeshStandardMaterial({ color: '#c9822b', roughness: 0.45, metalness: 0.05 }),
      segs.length,
    );
    const capGeo = new THREE.BoxGeometry(1.12, 0.05, 0.17);
    capGeo.translate(0, 0.36, 0);
    const capMesh = new THREE.InstancedMesh(
      capGeo,
      new THREE.MeshStandardMaterial({ color: '#f1c463', roughness: 0.35 }),
      segs.length,
    );
    const d = new THREE.Object3D();
    segs.forEach((s, i) => {
      let x = s.x, z = s.y, rot = 0;
      if (s.side === N) { x += 0.5; }
      else if (s.side === S) { x += 0.5; z += 1; }
      else if (s.side === W) { z += 0.5; rot = Math.PI / 2; }
      else { x += 1; z += 0.5; rot = Math.PI / 2; }
      d.position.set(this.ox + x, 0, this.oz + z);
      d.rotation.set(0, rot, 0);
      d.updateMatrix();
      wallMesh.setMatrixAt(i, d.matrix);
      capMesh.setMatrixAt(i, d.matrix);
    });
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    capMesh.castShadow = true;
    this.levelGroup.add(wallMesh, capMesh);

    // hives
    this.hiveObjs = [];
    for (const hv of board.hives) {
      const color = opts.colors[hv.owner] || '#999';
      const g = makeHive(color);
      const p = this.tileToWorld(hv.x, hv.y);
      g.position.set(p.x, 0, p.z);
      this.levelGroup.add(g);
      const obj = { group: g, x: hv.x, y: hv.y, owner: hv.owner, bounce: 0, shake: 0, shield: null };
      this.hiveObjs.push(obj);
      if (opts.labels) {
        const el = document.createElement('div');
        el.className = 'hive-label';
        el.style.setProperty('--c', color);
        el.innerHTML = '<span class="n">0</span><span class="bar"><i></i></span>';
        this.overlay.appendChild(el);
        this.labels.push({ el, owner: hv.owner, hive: obj, pos: new THREE.Vector3(p.x, 1.45, p.z) });
      }
    }

    // flowers
    board.spawners.forEach((s, i) => {
      const f = makeFlower(i, arrowYaw(s.dir));
      const p = this.tileToWorld(s.x, s.y);
      f.position.set(p.x, 0, p.z);
      this.levelGroup.add(f);
      this.flowerObjs.push({ group: f, x: s.x, y: s.y, pivot: f.userData.pivot, pop: 0 });
    });

    this.scenery.build(w, h);
    this.fitCamera();
  }

  boardTexture(board) {
    const T = 96;
    const c = document.createElement('canvas');
    c.width = board.w * T;
    c.height = board.h * T;
    const g = c.getContext('2d');
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        g.fillStyle = (x + y) % 2 ? '#f3d98e' : '#fbe9b4';
        g.fillRect(x * T, y * T, T, T);
      }
    }
    // honeycomb pattern
    g.strokeStyle = 'rgba(160, 110, 30, 0.10)';
    g.lineWidth = 2;
    const r = T / 4;
    const hh = Math.sqrt(3) * r;
    for (let row = -1; row < c.height / hh + 1; row++) {
      for (let col = -1; col < c.width / (r * 3) + 1; col++) {
        const cx = col * r * 3 + (row % 2 ? r * 1.5 : 0);
        const cy = row * hh / 2;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k;
          g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        g.closePath();
        g.stroke();
      }
    }
    // tile seams
    g.strokeStyle = 'rgba(140, 90, 20, 0.22)';
    g.lineWidth = 2;
    for (let x = 0; x <= board.w; x++) { g.beginPath(); g.moveTo(x * T, 0); g.lineTo(x * T, c.height); g.stroke(); }
    for (let y = 0; y <= board.h; y++) { g.beginPath(); g.moveTo(0, y * T); g.lineTo(c.width, y * T); g.stroke(); }
    // holes
    for (const hole of board.holes) {
      const cx = (hole.x + 0.5) * T, cy = (hole.y + 0.5) * T;
      const grad = g.createRadialGradient(cx, cy, 2, cx, cy, T * 0.38);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(0.7, '#1b0f05');
      grad.addColorStop(1, '#4a2e12');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, T * 0.38, 0, Math.PI * 2);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  tileToWorld(x, y) {
    return { x: this.ox + x + 0.5, z: this.oz + y + 0.5 };
  }

  simToWorld(wx, wy) {
    return { x: this.ox + wx / UNIT, z: this.oz + wy / UNIT };
  }

  // ----------------------------------------------------------------- camera

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.board) this.fitCamera();
  }

  /**
   * Frame the board. On portrait screens (phones held upright) the camera
   * looks at the board from the side, so the long edge runs top to bottom and
   * the tiles get much bigger.
   */
  fitCamera() {
    const { w, h } = this.board;
    const aspect = this.camera.aspect;
    this.portrait = aspect < 0.82 && w > h;
    this.camYaw = this.portrait ? Math.PI / 2 : 0;
    this.camBack.set(-Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const across = this.portrait ? h : w; // board extent left-right on screen
    const depth = this.portrait ? w : h;  // board extent towards the camera
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const elev = THREE.MathUtils.degToRad(this.portrait ? 62 : 57);
    const needH = (depth + 2.6) / 2 / Math.tan(fov / 2) * Math.sin(elev) * 1.05;
    const needW = (across + (this.portrait ? 0.6 : 1.6)) / 2 / Math.tan(fov / 2) / aspect;
    const dist = Math.max(needH, needW);
    this.camBase.pos.copy(this.camBack).multiplyScalar(Math.cos(elev) * dist + 0.4);
    this.camBase.pos.y = Math.sin(elev) * dist;
    this.camBase.look.copy(this.camBack).multiplyScalar(0.55);
    if (!this.camAnim) {
      this.camera.position.copy(this.camBase.pos);
      this.currentLook = this.camBase.look.clone();
      this.camera.lookAt(this.camBase.look);
    }
  }

  /** Slight push-in while an event pauses the game (and back afterwards). */
  eventFocus(on) {
    if (this.cinematic) return;
    if (on) {
      const pos = this.camBase.pos.clone().lerp(this.camBase.look, this.portrait ? 0.05 : 0.12);
      this.tweenCamera(pos, this.camBase.look, 0.6);
    } else {
      this.tweenCamera(this.camBase.pos, this.camBase.look, 0.5);
      this.camAnim.release = true;
    }
  }

  tweenCamera(pos, look, dur) {
    this.camAnim = {
      fromPos: this.camera.position.clone(),
      fromLook: this.currentLook ? this.currentLook.clone() : this.camBase.look.clone(),
      pos: pos.clone(), look: look.clone(), t: 0, dur,
    };
  }

  resetCamera() {
    this.camAnim = null;
    this.camera.position.copy(this.camBase.pos);
    this.currentLook = this.camBase.look.clone();
    this.camera.lookAt(this.currentLook);
  }

  updateCamera(dt) {
    if (this.camAnim) {
      const a = this.camAnim;
      a.t = Math.min(1, a.t + dt / a.dur);
      const k = ease(a.t);
      this.camera.position.lerpVectors(a.fromPos, a.pos, k);
      this.currentLook = (this.currentLook || new THREE.Vector3()).lerpVectors(a.fromLook, a.look, k);
      this.camera.lookAt(this.currentLook);
      if (a.t >= 1 && a.release) this.camAnim = null;
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * 0.12;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    } else if (!this.camAnim && this.board) {
      this.camera.position.copy(this.camBase.pos);
    }
  }

  // ------------------------------------------------------------------ input

  pickTile(clientX, clientY) {
    if (!this.board) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    const x = Math.floor(hit.x - this.ox), y = Math.floor(hit.z - this.oz);
    if (!this.board.inside(x, y)) return null;
    return { x, y };
  }

  /**
   * Board direction (N/E/S/W) that best matches a screen-space vector at a
   * tile. Works for any camera angle (also the rotated portrait view).
   */
  dirFromScreen(tile, sx, sy) {
    const p = this.tileToWorld(tile.x, tile.y);
    const c = this.project(new THREE.Vector3(p.x, 0, p.z));
    const len = Math.hypot(sx, sy) || 1;
    let best = 0;
    let bestDot = -Infinity;
    for (let d = 0; d < 4; d++) {
      const q2 = this.project(new THREE.Vector3(p.x + DX[d] * 0.5, 0, p.z + DY[d] * 0.5));
      const vx = q2.x - c.x, vy = q2.y - c.y;
      const dot = (vx * sx + vy * sy) / ((Math.hypot(vx, vy) || 1) * len);
      if (dot > bestDot) { bestDot = dot; best = d; }
    }
    return best;
  }

  setHover(tile, color, ok = true, dir = null) {
    if (!tile) { this.hover.visible = false; return; }
    const arrow = this.hover.userData.arrow;
    arrow.visible = dir !== null && ok;
    if (arrow.visible) {
      arrow.rotation.y = arrowYaw(dir);
      arrow.material.color.set(color);
    }
    const p = this.tileToWorld(tile.x, tile.y);
    this.hover.visible = true;
    this.hover.position.x = p.x;
    this.hover.position.z = p.z;
    this.hover.userData.ring.material.color.set(ok ? color : '#ff3b3b');
    this.hover.userData.fill.material.color.set(ok ? color : '#ff3b3b');
  }

  // ----------------------------------------------------------------- arrows

  arrowMat(owner, color) {
    const key = owner;
    if (!this.arrowMats.has(key)) {
      this.arrowMats.set(key, new THREE.MeshStandardMaterial({
        color, roughness: 0.35, emissive: color, emissiveIntensity: 0.25,
      }));
    }
    return this.arrowMats.get(key);
  }

  syncArrows(sim, dt) {
    const seen = new Set();
    for (let c = 0; c < sim.arrows.length; c++) {
      const a = sim.arrows[c];
      if (!a) continue;
      seen.add(c);
      let o = this.arrowObjs.get(c);
      if (!o || o.owner !== a.owner) {
        if (o) o.mesh.removeFromParent();
        const mesh = new THREE.Mesh(this.arrowGeo, this.arrowMat(a.owner, this.opts.colors[a.owner]));
        mesh.castShadow = true;
        const p = this.tileToWorld(c % sim.board.w, (c / sim.board.w) | 0);
        mesh.position.set(p.x, 0.02, p.z);
        this.scene.add(mesh);
        o = { mesh, owner: a.owner, dir: a.dir, placed: -1, pop: 0, yaw: arrowYaw(a.dir) };
        this.arrowObjs.set(c, o);
      }
      if (o.placed !== a.placed) {
        o.placed = a.placed;
        o.pop = 1;
      }
      o.dir = a.dir;
      o.yaw = lerpAngle(o.yaw, arrowYaw(a.dir), Math.min(1, dt * (this.time < this.arrowSpinUntil ? 3.5 : 20)));
      o.pop = Math.max(0, o.pop - dt * 5);
      const damaged = a.hp < sim.arrowHp;
      const s = (damaged ? 0.78 : 1) * (1 + o.pop * 0.35);
      o.mesh.scale.set(s, damaged ? 0.6 : 1, s);
      o.mesh.rotation.y = o.yaw;
      o.mesh.position.y = 0.02 + o.pop * 0.25;
      o.mesh.visible = !damaged || Math.sin(this.time * 14) > -0.6;
    }
    for (const [c, o] of this.arrowObjs) {
      if (!seen.has(c)) {
        o.mesh.removeFromParent();
        this.arrowObjs.delete(c);
      }
    }
  }

  // --------------------------------------------------------------- creatures

  beeMatrix(x, y, z, yaw, scale, out) {
    q.setFromAxisAngle(yAxis, yaw);
    sc.setScalar(scale);
    v3.set(x, y, z);
    return out.compose(v3, q, sc);
  }

  writeWings(i, base, flap, scale = 1) {
    // right wing
    m4b.makeRotationZ(-flap).premultiply(m4.makeTranslation(0.06, 0.3, -0.02));
    m4b.multiply(m4.makeRotationY(0.45));
    this.wingMesh.setMatrixAt(i * 2, m4.copy(base).multiply(m4b));
    // left wing (mirrored)
    m4b.makeRotationZ(Math.PI + flap).premultiply(m4.makeTranslation(-0.06, 0.3, -0.02));
    m4b.multiply(m4.makeRotationY(0.45));
    this.wingMesh.setMatrixAt(i * 2 + 1, m4.copy(base).multiply(m4b));
  }

  syncCreatures(sim, alpha, dt) {
    const t = this.time;
    let n = 0;
    const live = new Set();
    const base = new THREE.Matrix4();
    for (const e of sim.entities) {
      if (!e.alive) continue;
      live.add(e.id);
      const wx = e.pwx + (e.wx - e.pwx) * alpha;
      const wy = e.pwy + (e.wy - e.pwy) * alpha;
      const p = this.simToWorld(wx, wy);
      let st = this.state.get(e.id);
      const target = dirYaw(e.dir);
      if (!st) {
        st = { yaw: target, x: p.x, z: p.z, kind: e.kind, variant: e.variant };
        this.state.set(e.id, st);
      }
      st.yaw = lerpAngle(st.yaw, target, Math.min(1, dt * 16));
      st.x = p.x; st.z = p.z;
      if (e.kind === 'bee') {
        if (n >= MAX_BEES) continue;
        const bob = Math.sin(t * 9 + e.id * 1.7) * 0.035;
        this.beeMatrix(p.x, 0.12 + bob, p.z, st.yaw, 1, base);
        this.beeMesh.setMatrixAt(n, base);
        this.beeMesh.setColorAt(n, tmpCol.set(VARIANT_TINT[e.variant] || '#fff'));
        this.writeWings(n, base, Math.sin(t * 55 + e.id) * 0.55 + 0.25);
        n++;
        if (e.variant !== 'normal' && Math.random() < dt * 12) {
          this.particles.emit({ x: p.x, y: 0.35, z: p.z }, {
            count: 1, speed: 0.2, up: 0.6, gravity: -0.3, life: 0.6, size: 0.6,
            color: e.variant === 'gold' ? '#ffe55c' : '#ff9ad8',
          });
        }
      } else {
        let h = this.hornets.get(e.id);
        if (!h) h = this.addHornet(e.id);
        h.group.position.set(p.x, 0.1 + Math.sin(t * 6 + e.id) * 0.04, p.z);
        h.group.rotation.y = st.yaw;
        const flap = Math.sin(t * 45 + e.id) * 0.6 + 0.2;
        h.wingR.rotation.z = -flap;
        h.wingL.rotation.z = Math.PI + flap;
        const chewing = e.fullUntil > sim.tickCount;
        h.body.scale.setScalar(chewing ? 1 + Math.sin(t * 30) * 0.06 : 1);
      }
    }
    // ghosts (bees entering hives / falling into holes)
    for (let i = 0; i < this.ghosts.length; i++) {
      const g = this.ghosts[i];
      g.t += dt;
      const k = Math.min(1, g.t / g.dur);
      if (k >= 1) { this.ghosts.splice(i--, 1); continue; }
      if (g.kind !== 'bee' || n >= MAX_BEES) continue;
      let x, y, z, s, yaw = g.yaw;
      if (g.type === 'hive') {
        x = g.x + (g.tx - g.x) * k; z = g.z + (g.tz - g.z) * k;
        y = 0.12 + Math.sin(k * Math.PI) * 0.15;
        s = 1 - k * 0.8;
      } else {
        x = g.x; z = g.z;
        y = 0.12 - k * 0.7;
        s = 1 - k * 0.7;
        yaw += k * 9;
      }
      this.beeMatrix(x, y, z, yaw, s, base);
      this.beeMesh.setMatrixAt(n, base);
      this.beeMesh.setColorAt(n, tmpCol.set(VARIANT_TINT[g.variant] || '#fff'));
      this.writeWings(n, base, Math.sin(t * 55 + i) * 0.55);
      n++;
    }
    this.beeMesh.count = n;
    this.wingMesh.count = n * 2;
    this.beeMesh.instanceMatrix.needsUpdate = true;
    if (this.beeMesh.instanceColor) this.beeMesh.instanceColor.needsUpdate = true;
    this.wingMesh.instanceMatrix.needsUpdate = true;

    // hornets that are gone: play exit animation or remove
    for (const [id, h] of this.hornets) {
      if (live.has(id)) continue;
      if (!h.exit) h.exit = { type: 'vanish', t: 0 };
      h.exit.t += dt;
      const k = h.exit.t / 0.9;
      if (k >= 1) {
        h.group.removeFromParent();
        this.hornets.delete(id);
        continue;
      }
      if (h.exit.type === 'leave') {
        h.group.position.y += dt * 3;
        h.group.position.z -= dt * 2;
        h.group.rotation.y += dt * 4;
      } else if (h.exit.type === 'fall') {
        h.group.position.y -= dt * 1.2;
        h.group.scale.setScalar(1 - k);
        h.group.rotation.y += dt * 10;
      } else if (h.exit.type === 'hive') {
        h.group.position.lerp(h.exit.target, Math.min(1, dt * 10));
        h.group.scale.setScalar(Math.max(0.01, 1 - k * 1.5));
      } else {
        h.group.scale.setScalar(Math.max(0.01, 1 - k * 2));
      }
      const flap = Math.sin(t * 45 + id) * 0.6;
      h.wingR.rotation.z = -flap;
      h.wingL.rotation.z = Math.PI + flap;
    }
    // forget render state of dead creatures
    if (this.state.size > live.size + 50) {
      for (const id of this.state.keys()) if (!live.has(id)) this.state.delete(id);
    }
  }

  addHornet(id) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.hornetGeo, this.hornetMat);
    body.castShadow = true;
    const wingR = new THREE.Mesh(this.hornetWingGeo, this.hornetWingMat);
    wingR.position.set(0.07, 0.38, 0.1);
    const wingL = new THREE.Mesh(this.hornetWingGeo, this.hornetWingMat);
    wingL.position.set(-0.07, 0.38, 0.1);
    for (const wg of [wingR, wingL]) wg.rotation.order = 'YXZ';
    wingR.rotation.y = 0.5;
    wingL.rotation.y = -0.5;
    group.add(body, wingR, wingL);
    this.scene.add(group);
    const h = { group, body, wingR, wingL, exit: null };
    this.hornets.set(id, h);
    return h;
  }

  /** Drop all creature visuals immediately (puzzle restart). */
  clearCreatures() {
    for (const h of this.hornets.values()) h.group.removeFromParent();
    this.hornets.clear();
    this.state.clear();
    this.ghosts.length = 0;
  }

  // ----------------------------------------------------------------- events

  hiveObjAt(x, y) {
    return this.hiveObjs.find((h) => h.x === x && h.y === y);
  }

  onEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'hiveIn': {
          const st = this.state.get(ev.id);
          const p = this.tileToWorld(ev.x, ev.y);
          if (st) {
            this.ghosts.push({ kind: 'bee', type: 'hive', x: st.x, z: st.z, tx: p.x, tz: p.z + 0.3, yaw: st.yaw, t: 0, dur: 0.18, variant: ev.variant });
          }
          const hv = this.hiveObjAt(ev.x, ev.y);
          if (hv) hv.bounce = Math.min(1.4, hv.bounce + 0.35);
          this.particles.emit({ x: p.x, y: 0.5, z: p.z + 0.2 }, {
            count: ev.variant === 'normal' ? 3 : 24, speed: 1, up: 2,
            color: ev.variant === 'gold' ? ['#ffe55c', '#fff4b0', '#ffc400'] : ev.variant === 'pollen' ? ['#ff9ad8', '#ffffff'] : '#ffd84a',
            size: ev.variant === 'normal' ? 0.6 : 1,
          });
          if (ev.value > 1) this.floatText(`+${ev.value}`, p.x, 1.1, p.z, this.opts.colors[ev.owner] || '#ffd84a', true);
          break;
        }
        case 'hornetIn': {
          const p = this.tileToWorld(ev.x, ev.y);
          const hv = this.hiveObjAt(ev.x, ev.y);
          if (hv) { hv.shake = 1; hv.bounce = 1.5; }
          const h = this.hornets.get(ev.id);
          if (h) h.exit = { type: 'hive', t: 0, target: new THREE.Vector3(p.x, 0.3, p.z) };
          this.particles.emit({ x: p.x, y: 0.6, z: p.z }, { count: 40, speed: 2.4, up: 3, color: ['#ffc928', '#2a1a0c', '#ff5a3c'], size: 1.1 });
          this.floatText(ev.lost > 0 ? `−${ev.lost}` : 'Hornisse!', p.x, 1.2, p.z, '#ff3b3b', true);
          this.shake = Math.max(this.shake, 0.6);
          this.ring(p.x, p.z, '#ff3b3b', 2.6, 0.8);
          break;
        }
        case 'hornetBlocked': {
          const p = this.tileToWorld(ev.x, ev.y);
          const h = this.hornets.get(ev.id);
          if (h) h.exit = { type: 'vanish', t: 0 };
          this.particles.emit({ x: p.x, y: 0.6, z: p.z }, { count: 30, speed: 2, up: 2, color: ['#9fe2ff', '#ffffff'], size: 1 });
          this.floatText('Abgewehrt!', p.x, 1.2, p.z, '#5fd0ff');
          break;
        }
        case 'fall': {
          const p = this.tileToWorld(ev.x, ev.y);
          if (ev.kind === 'bee') {
            const st = this.state.get(ev.id);
            this.ghosts.push({ kind: 'bee', type: 'hole', x: p.x, z: p.z, yaw: st ? st.yaw : 0, t: 0, dur: 0.6, variant: ev.variant });
          } else {
            const h = this.hornets.get(ev.id);
            if (h) h.exit = { type: 'fall', t: 0 };
          }
          this.particles.emit({ x: p.x, y: 0.1, z: p.z }, { count: 6, speed: 0.6, up: 1, color: '#6b4420', size: 0.7 });
          break;
        }
        case 'eaten': {
          const p = this.simToWorld(ev.wx, ev.wy);
          this.particles.emit({ x: p.x, y: 0.25, z: p.z }, { count: 14, speed: 1.4, up: 1.6, color: ['#ffc928', '#2a1a0c', '#ffffff'], size: 0.9 });
          if (Math.random() < 0.35) this.floatText('Mampf!', p.x, 0.8, p.z, '#ff8a1c');
          break;
        }
        case 'hornetLeave': {
          const h = this.hornets.get(ev.id);
          if (h) h.exit = { type: 'leave', t: 0 };
          break;
        }
        case 'smoked': {
          const p = this.simToWorld(ev.wx, ev.wy);
          const h = this.hornets.get(ev.id);
          if (h) h.exit = { type: 'leave', t: 0 };
          this.particles.emit({ x: p.x, y: 0.4, z: p.z }, { count: 30, speed: 0.8, up: 1.2, gravity: -0.5, life: 1.4, color: ['#d8d8d8', '#bdbdbd', '#f2f2f2'], size: 2 });
          break;
        }
        case 'arrowRemoved': {
          const obj = this.arrowObjs.get(ev.cell);
          if (ev.reason === 'wind' && obj) {
            // the arrow is blown off the board
            this.arrowObjs.delete(ev.cell);
            const a = Math.random() * Math.PI * 2;
            this.debris.push({
              mesh: obj.mesh, t: 0,
              vx: 3.5 + Math.random() * 2, vy: 2.5 + Math.random() * 2, vz: Math.sin(a) * 1.5,
              spin: (Math.random() - 0.5) * 16,
            });
          }
          if (ev.reason === 'broken' || ev.reason === 'wind' || ev.reason === 'expired') {
            const p = this.tileToWorld(ev.cell % this.board.w, (ev.cell / this.board.w) | 0);
            this.particles.emit({ x: p.x, y: 0.1, z: p.z }, { count: 10, speed: 1.4, up: 1.4, color: this.opts.colors[ev.owner], size: 1 });
          }
          break;
        }
        case 'spawn': {
          if (ev.kind === 'hornet') {
            const p = this.tileToWorld(ev.x, ev.y);
            this.particles.emit({ x: p.x, y: 0.3, z: p.z }, { count: 14, speed: 1, up: 1.5, color: ['#ff8a1c', '#1d1208'], size: 0.9 });
          }
          break;
        }
        default: break;
      }
    }
  }

  setShield(owner, on) {
    for (const hv of this.hiveObjs) {
      if (hv.owner !== owner) continue;
      if (on && !hv.shield) {
        hv.shield = new THREE.Mesh(
          new THREE.SphereGeometry(0.62, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: '#7fdcff', transparent: true, opacity: 0.28, emissive: '#3fb6ff', emissiveIntensity: 0.4, depthWrite: false }),
        );
        hv.group.add(hv.shield);
      } else if (!on && hv.shield) {
        hv.shield.removeFromParent();
        hv.shield = null;
      }
    }
  }

  // ------------------------------------------------------- event animations

  /** Expanding ring on the ground (damage / landing effects). */
  ring(x, z, color, size = 2, dur = 0.7) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.05, z);
    this.scene.add(mesh);
    this.rings.push({ mesh, t: 0, dur, size });
  }

  /** Strong feedback when the local player's hive got raided. */
  hurtHive(owner) {
    const hv = this.hiveObjs.find((h) => h.owner === owner);
    this.shake = Math.max(this.shake, 1.3);
    if (!hv) return;
    const p = hv.group.position;
    this.ring(p.x, p.z, '#ff2a2a', 4, 1.1);
    setTimeout(() => this.ring(p.x, p.z, '#ff7a1c', 3, 0.9), 160);
    hv.shake = 1.4;
  }

  /** "Everybody move": hives fly to their new spots. */
  moveHives(moves, dur = 1.9) {
    moves.forEach((m, i) => {
      const obj = this.hiveObjs.find((h) => h.owner === m.owner);
      if (!obj) return;
      const from = this.tileToWorld(m.fx, m.fy);
      const to = this.tileToWorld(m.tx, m.ty);
      obj.x = m.tx;
      obj.y = m.ty;
      this.hiveAnims.push({ obj, from, to, t: -i * 0.12, dur, landed: false, lifted: false });
    });
  }

  /** Flowers spin round to their new spawn direction. */
  turnFlowers(turns, dur = 1.0) {
    for (const tr of turns) {
      const fo = this.flowerObjs.find((o) => o.x === tr.x && o.y === tr.y);
      if (!fo) continue;
      const from = arrowYaw(tr.from);
      let to = arrowYaw(tr.to);
      while (to > from - Math.PI * 2) to -= Math.PI * 2; // always one full extra turn
      this.flowerAnims.push({ fo, from, to, t: 0, dur });
      fo.pop = 1;
      this.particles.emit({ x: fo.group.position.x, y: 0.4, z: fo.group.position.z }, {
        count: 18, speed: 1.4, up: 1.6, color: ['#ff8fc8', '#ffffff', '#ffe066'], size: 1,
      });
    }
  }

  /** Spin all arrows slowly for a moment (used by "flip"). */
  spinArrows(sec = 1.2) {
    this.arrowSpinUntil = this.time + sec;
  }

  /** Board-wide 3D flourish for an event (on top of the event's own logic). */
  eventFx(id) {
    if (!this.board) return;
    const { w, h } = this.board;
    const rnd = () => ({ x: this.ox + Math.random() * w, z: this.oz + Math.random() * h });
    if (id === 'swarm') {
      for (const fo of this.flowerObjs) {
        fo.pop = 1;
        this.particles.emit({ x: fo.group.position.x, y: 0.5, z: fo.group.position.z }, {
          count: 30, speed: 2, up: 2.5, color: ['#ffd84a', '#fff4b0', '#ffb300'], size: 1,
        });
      }
    } else if (id === 'gold') {
      for (let i = 0; i < 40; i++) {
        const p = rnd();
        this.particles.emit({ x: p.x, y: 2.5 + Math.random() * 2, z: p.z }, {
          count: 2, speed: 0.3, up: 0, gravity: 2, life: 1.6, color: ['#ffe55c', '#fff4b0', '#ffc400'], size: 1.2,
        });
      }
    } else if (id === 'smoke') {
      for (let i = 0; i < 24; i++) {
        const p = rnd();
        this.particles.emit({ x: p.x, y: 0.3, z: p.z }, {
          count: 3, speed: 0.6, up: 0.8, gravity: -0.4, life: 1.6, color: ['#d8d8d8', '#bdbdbd', '#f2f2f2'], size: 2.4,
        });
      }
    } else if (id === 'swirl' || id === 'wind') {
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const r = Math.max(w, h) * 0.45;
        this.particles.emit({ x: Math.cos(a) * r, y: 0.4 + Math.random(), z: Math.sin(a) * r * 0.75 }, {
          count: 1, speed: 1.5, up: 0.8, gravity: -0.2, life: 1.2, color: ['#ffffff', '#d6f3ff'], size: 1.3,
        });
      }
    } else if (id === 'hornets') {
      for (const fo of this.flowerObjs) {
        this.particles.emit({ x: fo.group.position.x, y: 0.4, z: fo.group.position.z }, {
          count: 16, speed: 1.6, up: 2, color: ['#ff8a1c', '#1d1208', '#ff3b3b'], size: 1,
        });
      }
    } else if (id === 'arrows') {
      for (let i = 0; i < 30; i++) {
        const p = rnd();
        this.particles.emit({ x: p.x, y: 3 + Math.random() * 2, z: p.z }, {
          count: 2, speed: 0.2, up: 0, gravity: 3, life: 1.3, color: ['#2f8cff', '#ff4d5e', '#38c95a', '#b25cff'], size: 1.1,
        });
      }
    }
  }

  updateEventAnims(dt) {
    for (let i = 0; i < this.hiveAnims.length; i++) {
      const a = this.hiveAnims[i];
      a.t += dt;
      const g = a.obj.group;
      if (a.t < 0) continue;
      if (!a.lifted) {
        a.lifted = true;
        this.particles.emit({ x: a.from.x, y: 0.1, z: a.from.z }, { count: 16, speed: 1.4, up: 1, color: ['#c9a36b', '#8a6a3a'], size: 1 });
      }
      const k = Math.min(1, a.t / a.dur);
      const e = ease(k);
      g.position.x = a.from.x + (a.to.x - a.from.x) * e;
      g.position.z = a.from.z + (a.to.z - a.from.z) * e;
      g.position.y = Math.sin(k * Math.PI) * 2.4;
      g.rotation.y = e * Math.PI * 2;
      if (k >= 1) {
        g.position.set(a.to.x, 0, a.to.z);
        g.rotation.y = 0;
        a.obj.bounce = 1.5;
        this.ring(a.to.x, a.to.z, this.opts.colors[a.obj.owner] || '#ffd84a', 2.4, 0.6);
        this.particles.emit({ x: a.to.x, y: 0.1, z: a.to.z }, { count: 22, speed: 1.8, up: 1.2, color: ['#c9a36b', '#8a6a3a', '#ffe066'], size: 1.1 });
        this.shake = Math.max(this.shake, 0.35);
        this.hiveAnims.splice(i--, 1);
      }
    }
    for (let i = 0; i < this.flowerAnims.length; i++) {
      const a = this.flowerAnims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.fo.pivot.rotation.y = a.from + (a.to - a.from) * ease(k);
      if (k >= 1) this.flowerAnims.splice(i--, 1);
    }
    for (const fo of this.flowerObjs) {
      if (fo.pop <= 0) continue;
      fo.pop = Math.max(0, fo.pop - dt * 2);
      const sc2 = 1 + Math.sin(fo.pop * Math.PI) * 0.35;
      fo.group.scale.set(sc2, sc2, sc2);
    }
    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      d.t += dt;
      const m = d.mesh;
      m.position.x += d.vx * dt;
      m.position.y += d.vy * dt;
      m.position.z += d.vz * dt;
      d.vy -= dt * 1.5;
      m.rotation.x += d.spin * dt;
      m.rotation.z += d.spin * 0.7 * dt;
      if (d.t > 1.6) { m.removeFromParent(); this.debris.splice(i--, 1); }
    }
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { r.mesh.removeFromParent(); r.mesh.geometry.dispose(); this.rings.splice(i--, 1); continue; }
      const sc2 = 0.6 + k * r.size;
      r.mesh.scale.set(sc2, sc2, sc2);
      r.mesh.material.opacity = 1 - k;
    }
  }

  // ------------------------------------------------------------- overlays

  project(pos) {
    v3.copy(pos).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: (v3.x * 0.5 + 0.5) * rect.width, y: (-v3.y * 0.5 + 0.5) * rect.height };
  }

  floatText(text, x, y, z, color, big = false) {
    const el = document.createElement('div');
    el.className = 'float-text' + (big ? ' big' : '');
    el.textContent = text;
    el.style.color = color;
    this.overlay.appendChild(el);
    this.floaters.push({ el, pos: new THREE.Vector3(x, y, z), t: 0 });
  }

  updateHiveLabel(owner, score, frac) {
    for (const l of this.labels) {
      if (l.owner !== owner) continue;
      if (l.score !== score) {
        l.score = score;
        l.el.querySelector('.n').textContent = score;
      }
      l.el.querySelector('i').style.width = `${Math.min(100, frac * 100).toFixed(1)}%`;
    }
  }

  setLabelsVisible(v) {
    for (const l of this.labels) l.el.style.display = v ? '' : 'none';
  }

  markerAt(x, z, color = '#ff3b3b') {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.42, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.03, z);
    this.scene.add(ring);
    this.markers.push(ring);
  }

  clearMarkers() {
    for (const m of this.markers) m.removeFromParent();
    this.markers = [];
  }

  // ------------------------------------------------------------ cinematic

  /** Queen hatches from the given hive. Resolves when the show is over. */
  hatchQueen(owner, { color = '#ffd84a' } = {}) {
    const hv = this.hiveObjs.find((h) => h.owner === owner) || this.hiveObjs[0];
    this.endCinematic();
    const queen = new THREE.Group();
    const body = new THREE.Mesh(queenGeometry(), creatureMaterial());
    body.castShadow = true;
    const wg = wingGeometry(2.1);
    const wm = wingMaterial();
    const wingR = new THREE.Mesh(wg, wm);
    const wingL = new THREE.Mesh(wg, wm);
    wingR.position.set(0.07, 0.4, 0.05);
    wingL.position.set(-0.07, 0.4, 0.05);
    wingR.rotation.order = wingL.rotation.order = 'YXZ';
    wingR.rotation.y = 0.5;
    wingL.rotation.y = -0.5;
    queen.add(body, wingR, wingL);
    queen.visible = false;
    const hp = hv.group.position;
    queen.position.set(hp.x, 0.6, hp.z);
    this.scene.add(queen);

    const cell = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.14, 0.2, 6, 14),
      new THREE.MeshStandardMaterial({ color: '#f2cf72', roughness: 0.4, emissive: '#ffb300', emissiveIntensity: 0.1 }),
    );
    cell.position.set(hp.x, 0.8, hp.z);
    cell.scale.setScalar(0.01);
    this.scene.add(cell);

    const camPos = new THREE.Vector3(hp.x, 2.6, hp.z).addScaledVector(this.camBack, 5.4);
    const camLook = new THREE.Vector3(hp.x, 1.25, hp.z);
    this.tweenCamera(camPos, camLook, 1.4);
    return new Promise((resolve) => {
      this.cinematic = { hv, queen, wingR, wingL, cell, t: 0, resolve, color, done: false, burst: false };
    });
  }

  updateCinematic(dt) {
    const c = this.cinematic;
    if (!c) return;
    c.t += dt;
    const t = c.t;
    const hp = c.hv.group.position;
    // phase 1: royal cell grows, hive trembles
    if (t < 1.8) {
      const k = Math.min(1, t / 1.2);
      c.cell.scale.setScalar(0.01 + k);
      c.cell.rotation.z = Math.sin(t * 30) * 0.08 * k;
      c.hv.shake = Math.max(c.hv.shake, 0.4 * k);
      if (Math.random() < dt * 25) {
        this.particles.emit({ x: hp.x, y: 0.9, z: hp.z }, { count: 1, speed: 0.6, up: 1.2, gravity: -0.2, life: 1, color: ['#ffe55c', '#fff8d0'], size: 0.8 });
      }
    } else if (!c.burst) {
      c.burst = true;
      c.cell.removeFromParent();
      c.queen.visible = true;
      this.particles.emit({ x: hp.x, y: 0.9, z: hp.z }, { count: 120, speed: 3.2, up: 4, life: 1.6, color: ['#ffe55c', '#fff4b0', '#f2cf72', '#ffffff', c.color], size: 1.4 });
      this.shake = 0.8;
      c.hv.bounce = 1.5;
    }
    if (c.burst) {
      const k = t - 1.8;
      const q2 = c.queen;
      const flap = Math.sin(t * 50) * 0.6 + 0.3;
      c.wingR.rotation.z = -flap;
      c.wingL.rotation.z = Math.PI + flap;
      if (k < 0.4) {
        q2.scale.setScalar(0.3 + (k / 0.4) * 1.0);
        q2.position.set(hp.x, 0.7 + k, hp.z);
        q2.rotation.y = 0;
      } else if (k < 3.2) {
        const s = (k - 0.4) / 2.8;
        const ang = s * Math.PI * 4;
        const rad = 0.9 * Math.sin(s * Math.PI);
        q2.scale.setScalar(1.3);
        q2.position.set(hp.x + Math.sin(ang) * rad, 1.1 + s * 0.75, hp.z + Math.cos(ang) * rad * 0.6);
        q2.rotation.y = ang + Math.PI / 2;
        if (Math.random() < dt * 40) {
          this.particles.emit(q2.position, { count: 1, speed: 0.2, up: 0.2, gravity: 0.5, life: 0.9, color: ['#ffe55c', '#ffffff', c.color], size: 0.9 });
        }
      } else {
        q2.position.set(hp.x, 1.85 + Math.sin(t * 2.5) * 0.08, hp.z);
        q2.rotation.y = lerpAngle(q2.rotation.y, 0, Math.min(1, dt * 4));
        q2.scale.setScalar(1.3);
        if (Math.random() < dt * 6) {
          this.particles.emit({ x: hp.x + (Math.random() - 0.5) * 3, y: 3.2, z: hp.z + (Math.random() - 0.5) * 1.5 }, {
            count: 8, speed: 1, up: 0.5, gravity: 1.2, life: 1.8, color: ['#ff5f8f', '#ffe55c', '#5fd0ff', '#7dff8a', '#c99bff'], size: 1.1,
          });
        }
        if (!c.done && k > 3.4) {
          c.done = true;
          c.resolve();
        }
      }
    }
  }

  endCinematic() {
    const c = this.cinematic;
    if (!c) return;
    c.queen.removeFromParent();
    c.cell.removeFromParent();
    if (!c.done) c.resolve();
    this.cinematic = null;
  }

  // ------------------------------------------------------------------ frame

  update(sim, alpha, dt) {
    this.time += dt;
    if (sim) {
      this.syncCreatures(sim, alpha, dt);
      this.syncArrows(sim, dt);
    }
    for (const hv of this.hiveObjs) {
      hv.bounce = Math.max(0, hv.bounce - dt * 4);
      hv.shake = Math.max(0, hv.shake - dt * 1.5);
      const b = hv.bounce;
      hv.group.scale.set(1 + b * 0.08, 1 - b * 0.06 + Math.sin(this.time * 30) * b * 0.03, 1 + b * 0.08);
      hv.group.rotation.z = hv.shake ? Math.sin(this.time * 40) * hv.shake * 0.12 : 0;
      const flag = hv.group.userData.flag;
      flag.rotation.y = Math.sin(this.time * 3 + hv.owner) * 0.3;
    }
    if (this.hover.visible) {
      const s = 1 + Math.sin(this.time * 6) * 0.03;
      this.hover.scale.set(s, 1, s);
    }
    for (const m of this.markers) {
      m.material.opacity = 0.5 + Math.sin(this.time * 8) * 0.4;
    }
    this.updateCinematic(dt);
    this.updateEventAnims(dt);
    this.scenery.update(dt, this.time);
    this.particles.update(dt);
    this.updateCamera(dt);

    // labels & floating texts follow the camera projection
    for (const l of this.labels) {
      const hp = l.hive.group.position;
      l.pos.set(hp.x, hp.y + 1.45, hp.z);
      const p = this.project(l.pos);
      l.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    }
    for (let i = 0; i < this.floaters.length; i++) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t > 1.1) { f.el.remove(); this.floaters.splice(i--, 1); continue; }
      f.pos.y += dt * 0.9;
      const p = this.project(f.pos);
      f.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.3 - f.t)})`;
      f.el.style.opacity = String(Math.min(1, 2.2 - f.t * 2));
    }
    this.renderer.render(this.scene, this.camera);
  }
}

