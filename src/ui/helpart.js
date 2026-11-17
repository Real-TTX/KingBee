// Little 3D dioramas for the "So spielst du" screen. They are rendered once
// with the real game models into 2D canvases, then the WebGL context is freed.

import * as THREE from 'three';
import { DX, DY, N, E, S, W, PLAYER_COLORS } from '../game/constants.js';
import {
  beeGeometry, hornetGeometry, queenGeometry, wingGeometry, wingMaterial,
  creatureMaterial, makeHive, makeFlower, arrowGeometry,
} from '../render/models.js';

const IMG_W = 400;
const IMG_H = 300;
const TINT = { normal: '#ffffff', gold: '#ffe066', pollen: '#ff9ad8' };
const dirYaw = (d) => Math.atan2(DX[d], DY[d]);
const arrowYaw = (d) => -d * Math.PI / 2;

/** Shared geometry/material cache (lives only while rendering). */
function kit() {
  return {
    bee: beeGeometry(),
    hornet: hornetGeometry(),
    queen: queenGeometry(),
    wing: wingGeometry(),
    wingBig: wingGeometry(1.5),
    wingQueen: wingGeometry(2.1),
    wingMat: wingMaterial(),
    arrow: arrowGeometry(),
    dot: new THREE.SphereGeometry(0.045, 8, 6),
    dotMat: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }),
    tileA: new THREE.MeshStandardMaterial({ color: '#fbe9b4', roughness: 0.85 }),
    tileB: new THREE.MeshStandardMaterial({ color: '#f3d98e', roughness: 0.85 }),
    rim: new THREE.MeshStandardMaterial({ color: '#9b6a35', roughness: 0.7 }),
    wall: new THREE.MeshStandardMaterial({ color: '#c9822b', roughness: 0.45, metalness: 0.05 }),
    cap: new THREE.MeshStandardMaterial({ color: '#f1c463', roughness: 0.35 }),
  };
}

/** A tiny board: w x h tiles, helpers to place things on tiles. */
class Diorama {
  constructor(k, w, h) {
    this.k = k;
    this.w = w;
    this.h = h;
    this.scene = new THREE.Scene();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    const hemi = new THREE.HemisphereLight('#fff8e6', '#5d8a3a', 1.15);
    const sun = new THREE.DirectionalLight('#fff1d0', 2.3);
    sun.position.set(-4, 10, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    const fill = new THREE.DirectionalLight('#cfe8ff', 0.5);
    fill.position.set(6, 5, -5);
    this.scene.add(hemi, sun, fill);

    const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.36, 0.3, h + 0.36), k.rim);
    rim.position.y = -0.17;
    rim.receiveShadow = true;
    this.root.add(rim);
    const tile = new THREE.BoxGeometry(0.98, 0.04, 0.98);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const m = new THREE.Mesh(tile, (x + y) % 2 ? k.tileB : k.tileA);
        const p = this.pos(x, y);
        m.position.set(p.x, -0.02, p.z);
        m.receiveShadow = true;
        this.root.add(m);
      }
    }
  }

  pos(x, y) {
    return new THREE.Vector3(x - (this.w - 1) / 2, 0, y - (this.h - 1) / 2);
  }

  add(obj, x, y, yaw = 0, lift = 0) {
    const p = this.pos(x, y);
    obj.position.set(p.x, lift, p.z);
    obj.rotation.y = yaw;
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.root.add(obj);
    return obj;
  }

  creature(geo, wingGeo, { scale = 1, tint = '#ffffff', flap = 0.55, wingY = 0.3, spread = 0.06 } = {}) {
    const mat = creatureMaterial();
    mat.color.set(tint);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    for (const s of [1, -1]) {
      const wing = new THREE.Mesh(wingGeo, this.k.wingMat);
      const pivot = new THREE.Group();
      pivot.position.set(s * spread, wingY, -0.02);
      // same as View.writeWings: translate * rotZ(flap) * rotY(0.45)
      pivot.rotation.set(0, 0.45, s > 0 ? -flap : Math.PI + flap, 'ZYX');
      pivot.add(wing);
      g.add(pivot);
    }
    g.scale.setScalar(scale);
    return g;
  }

  bee(x, y, dir, variant = 'normal', lift = 0.18) {
    return this.add(this.creature(this.k.bee, this.k.wing, { scale: 1.25, tint: TINT[variant] }), x, y, dirYaw(dir), lift);
  }

  hornet(x, y, dir, lift = 0.25) {
    return this.add(this.creature(this.k.hornet, this.k.wingBig, { scale: 1.3, wingY: 0.36, spread: 0.07 }), x, y, dirYaw(dir), lift);
  }

  queen(x, y, lift) {
    const q = this.creature(this.k.queen, this.k.wingQueen, { scale: 1.9, wingY: 0.34, spread: 0.07, flap: 0.8 });
    return this.add(q, x, y, 0.35, lift);
  }

  hive(x, y, owner = 0) {
    return this.add(makeHive(PLAYER_COLORS[owner]), x, y);
  }

  flower(x, y, dir, i = 0) {
    return this.add(makeFlower(i, arrowYaw(dir)), x, y);
  }

  arrow(x, y, dir, owner = 0) {
    const c = PLAYER_COLORS[owner];
    const m = new THREE.Mesh(this.k.arrow, new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, emissive: c, emissiveIntensity: 0.25 }));
    return this.add(m, x, y, arrowYaw(dir), 0.02);
  }

  wall(x, y, side) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.34, 0.13), this.k.wall);
    body.position.y = 0.17;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.05, 0.17), this.k.cap);
    cap.position.y = 0.36;
    g.add(body, cap);
    const p = this.pos(x, y);
    const off = { [N]: [0, -0.5], [S]: [0, 0.5], [W]: [-0.5, 0], [E]: [0.5, 0] }[side];
    this.add(g, 0, 0, side === E || side === W ? Math.PI / 2 : 0);
    g.position.set(p.x + off[0], 0, p.z + off[1]);
    return g;
  }

  /** Dotted flight path through tile centres. */
  path(points, step = 0.22) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = this.pos(...points[i]);
      const b = this.pos(...points[i + 1]);
      const len = a.distanceTo(b);
      for (let t = 0; t < len; t += step) {
        const d = new THREE.Mesh(this.k.dot, this.k.dotMat);
        d.position.lerpVectors(a, b, t / len);
        d.position.y = 0.04;
        this.root.add(d);
      }
    }
  }

  /** Point the camera at the board from the game's usual angle. */
  camera(zoom = 1, { dx = 0, dz = 0, elev = 0.95, ly = 0.15 } = {}) {
    const cam = new THREE.PerspectiveCamera(30, IMG_W / IMG_H, 0.1, 100);
    const span = Math.max(this.w * 0.5 * (480 / 260) / (IMG_W / IMG_H), this.h * 1.0) + 0.6;
    const dist = (span / Math.tan((15 * Math.PI) / 180)) * 0.53 / zoom;
    const look = new THREE.Vector3(dx, ly, dz);
    cam.position.set(dx, Math.sin(elev) * dist, dz + Math.cos(elev) * dist);
    cam.lookAt(look);
    return cam;
  }
}

/** Scene recipes, keyed like the help cards. */
const SCENES = {
  collect(d) {
    d.hive(3, 0, 0);
    d.bee(0, 0, E);
    d.bee(1, 0, E, 'normal', 0.24);
    d.bee(2, 0, E, 'normal', 0.2);
    d.bee(1, 1, N);
    d.path([[1, 1], [1, 0]]);
    d.flower(0, 1, N, 1);
    return d.camera(1.08);
  },
  rules(d) {
    d.flower(0, 0, E, 0);
    d.wall(3, 0, E);
    d.wall(3, 2, S);
    d.path([[0, 0], [3, 0], [3, 2]]);
    d.bee(1.4, 0, E);
    d.bee(3, 1.1, S);
    return d.camera(1.02);
  },
  arrows(d) {
    d.flower(0, 0, S, 2);
    d.arrow(0, 2, E);
    d.arrow(3, 2, N);
    d.hive(3, 0, 0);
    d.path([[0, 0], [0, 2], [3, 2], [3, 0]]);
    d.bee(0, 1, S);
    d.bee(1.6, 2, E);
    return d.camera(1.02);
  },
  hornet(d) {
    d.hive(2, 0, 1);
    d.hornet(0.9, 0, E);
    d.bee(1.9, 1, W, 'normal', 0.3);
    d.bee(0.2, 1, W);
    d.path([[0, 0], [1.6, 0]]);
    return d.camera(1.05);
  },
  special(d) {
    d.bee(0, 0, S, 'gold', 0.25);
    d.bee(1, 0, S, 'normal', 0.18);
    d.bee(2, 0, S, 'pollen', 0.25);
    return d.camera(1.25, { elev: 0.75 });
  },
  queen(d) {
    d.hive(1, 0, 0);
    d.queen(1, 0, 0.9);
    d.bee(0, 0, E, 'normal', 0.5);
    d.bee(2, 0, W, 'normal', 0.45);
    return d.camera(1.05, { elev: 0.5, ly: 0.75 });
  },
};
const SIZES = { collect: [4, 2], rules: [4, 3], arrows: [4, 3], hornet: [3, 2], special: [3, 1], queen: [3, 1] };

let done = false;

/** Render every [data-art] canvas inside root once. */
export function renderHelpArt(root) {
  if (done) return;
  const canvases = [...root.querySelectorAll('canvas[data-art]')];
  if (!canvases.length) return;
  let r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return; // no WebGL: cards simply show without pictures
  }
  done = true;
  r.setPixelRatio(1);
  r.setSize(IMG_W, IMG_H, false);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.outputColorSpace = THREE.SRGBColorSpace;
  const k = kit();
  for (const cv of canvases) {
    const id = cv.dataset.art;
    if (!SCENES[id]) continue;
    const d = new Diorama(k, ...SIZES[id]);
    const cam = SCENES[id](d);
    r.render(d.scene, cam);
    cv.width = IMG_W;
    cv.height = IMG_H;
    cv.getContext('2d').drawImage(r.domElement, 0, 0);
    d.scene.traverse((o) => { if (o.isMesh && o.geometry && !Object.values(k).includes(o.geometry)) o.geometry.dispose(); });
  }
  for (const v of Object.values(k)) v.dispose?.();
  r.dispose();
  r.forceContextLoss();
}
