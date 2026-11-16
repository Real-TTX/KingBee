import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// All creature models face +Z, stand on y = 0 and use vertex colours so a
// whole creature can be drawn with one (instanced) mesh.

const tmpColor = new THREE.Color();

function paint(geo, color) {
  const fn = typeof color === 'function' ? color : () => color;
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    tmpColor.set(fn(pos.getX(i), pos.getY(i), pos.getZ(i)));
    arr[i * 3] = tmpColor.r;
    arr[i * 3 + 1] = tmpColor.g;
    arr[i * 3 + 2] = tmpColor.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function merge(parts) {
  const geos = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of geos) g.deleteAttribute('uv');
  const m = mergeGeometries(geos);
  m.computeBoundingSphere();
  return m;
}

const sphere = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);

function eyes(z, y, spread, r, iris = '#1a1208', white = '#ffffff') {
  const parts = [];
  for (const s of [-1, 1]) {
    parts.push(paint(sphere(r, 10, 8).translate(s * spread, y, z), white));
    parts.push(paint(sphere(r * 0.55, 8, 6).translate(s * spread * 1.05, y + r * 0.1, z + r * 0.62), iris));
    parts.push(paint(sphere(r * 0.18, 6, 4).translate(s * spread * 1.0 + r * 0.12, y + r * 0.35, z + r * 0.9), '#ffffff'));
  }
  return parts;
}

function antennae(z, y, color) {
  const parts = [];
  for (const s of [-1, 1]) {
    const stalk = new THREE.CylinderGeometry(0.008, 0.01, 0.16, 5);
    stalk.translate(0, 0.08, 0);
    stalk.rotateX(0.55);
    stalk.rotateZ(-s * 0.35);
    stalk.translate(s * 0.04, y, z);
    parts.push(paint(stalk, color));
    const tip = sphere(0.022, 6, 5);
    tip.translate(0, 0.16, 0);
    tip.rotateX(0.55);
    tip.rotateZ(-s * 0.35);
    tip.translate(s * 0.04, y, z);
    parts.push(paint(tip, color));
  }
  return parts;
}

/** Striped abdomen: ellipsoid along Z, stripe colours chosen by z. */
function stripedBody(radius, sx, sy, sz, colA, colB, bands, z0) {
  const g = sphere(radius, 18, 14);
  g.scale(sx, sy, sz);
  const len = radius * sz;
  paint(g, (x, y, z) => {
    const t = (z + len) / (2 * len); // 0 back .. 1 front
    const band = Math.floor(t * bands);
    return band % 2 === 0 ? colB : colA;
  });
  g.translate(0, 0, z0);
  return g;
}

export function beeGeometry() {
  const parts = [];
  const body = stripedBody(0.15, 1, 0.95, 1.35, '#ffc928', '#2a1a0c', 6, -0.03);
  body.translate(0, 0.2, 0);
  parts.push(body);
  parts.push(paint(sphere(0.105).translate(0, 0.23, 0.2), '#2a1a0c'));
  parts.push(...eyes(0.27, 0.26, 0.05, 0.042));
  parts.push(...antennae(0.24, 0.3, '#2a1a0c'));
  const sting = new THREE.ConeGeometry(0.025, 0.08, 6);
  sting.rotateX(-Math.PI / 2);
  sting.translate(0, 0.19, -0.26);
  parts.push(paint(sting, '#2a1a0c'));
  // little rosy cheeks
  for (const s of [-1, 1]) parts.push(paint(sphere(0.02, 6, 4).translate(s * 0.085, 0.2, 0.26), '#ff8c8c'));
  return merge(parts);
}

export function hornetGeometry() {
  const parts = [];
  const abdomen = stripedBody(0.16, 1, 0.9, 1.55, '#ff8a1c', '#1d1208', 7, -0.12);
  abdomen.translate(0, 0.26, 0);
  parts.push(abdomen);
  parts.push(paint(sphere(0.11).scale(1, 1, 1.1).translate(0, 0.28, 0.14), '#3a210d'));
  parts.push(paint(sphere(0.12).translate(0, 0.3, 0.3), '#e0701a'));
  // angry eyes + brows
  parts.push(...eyes(0.39, 0.33, 0.06, 0.045, '#5a0000', '#ffe14a'));
  for (const s of [-1, 1]) {
    const brow = new THREE.BoxGeometry(0.07, 0.018, 0.02);
    brow.rotateZ(s * 0.5);
    brow.translate(s * 0.058, 0.39, 0.41);
    parts.push(paint(brow, '#1d1208'));
  }
  // mandibles
  for (const s of [-1, 1]) {
    const m = new THREE.ConeGeometry(0.02, 0.07, 5);
    m.rotateX(Math.PI / 2);
    m.rotateY(-s * 0.4);
    m.translate(s * 0.035, 0.24, 0.42);
    parts.push(paint(m, '#1d1208'));
  }
  parts.push(...antennae(0.36, 0.38, '#1d1208'));
  const sting = new THREE.ConeGeometry(0.035, 0.14, 6);
  sting.rotateX(-Math.PI / 2);
  sting.translate(0, 0.24, -0.43);
  parts.push(paint(sting, '#1d1208'));
  return merge(parts);
}

export function queenGeometry() {
  const parts = [];
  const abdomen = stripedBody(0.17, 1, 0.95, 1.9, '#ffd84a', '#3b1d08', 8, -0.2);
  abdomen.translate(0, 0.25, 0);
  parts.push(abdomen);
  parts.push(paint(sphere(0.13).translate(0, 0.27, 0.1), '#7a3fc4'));
  parts.push(paint(sphere(0.115).translate(0, 0.3, 0.28), '#2a1a0c'));
  parts.push(...eyes(0.36, 0.33, 0.055, 0.045));
  parts.push(...antennae(0.32, 0.37, '#2a1a0c'));
  // crown
  const ring = new THREE.CylinderGeometry(0.085, 0.075, 0.07, 16, 1, true);
  ring.translate(0, 0.43, 0.27);
  parts.push(paint(ring, '#ffcf26'));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.ConeGeometry(0.025, 0.08, 5);
    spike.translate(Math.sin(a) * 0.08, 0.5, 0.27 + Math.cos(a) * 0.08);
    parts.push(paint(spike, '#ffcf26'));
    const gem = sphere(0.018, 6, 4);
    gem.translate(Math.sin(a) * 0.085, 0.43, 0.27 + Math.cos(a) * 0.085);
    parts.push(paint(gem, i % 2 ? '#ff2d6b' : '#3dd6ff'));
  }
  // collar fluff
  const collar = new THREE.TorusGeometry(0.11, 0.035, 6, 16);
  collar.translate(0, 0.27, 0.18);
  parts.push(paint(collar, '#fff6e0'));
  return merge(parts);
}

/** Single wing, pivot at its root, extending to +X. */
export function wingGeometry(size = 1) {
  const g = sphere(0.13 * size, 12, 6);
  g.scale(1, 0.06, 0.5);
  g.translate(0.13 * size, 0, 0);
  return g;
}

export function wingMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#eaf6ff',
    transparent: true,
    opacity: 0.55,
    roughness: 0.2,
    metalness: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function creatureMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
}

/** Straw skep beehive with an owner-coloured base and pennant. */
export function makeHive(color) {
  const group = new THREE.Group();
  const straw = [];
  const rings = 7;
  for (let i = 0; i < rings; i++) {
    const t = i / rings;
    const r = 0.36 * Math.sqrt(1 - t * t * 0.92) + 0.02;
    const torus = new THREE.TorusGeometry(r, 0.062, 8, 28);
    torus.rotateX(Math.PI / 2);
    torus.translate(0, 0.08 + i * 0.085, 0);
    const shade = i % 2 ? '#d9a13d' : '#e8b551';
    straw.push(paint(torus, shade));
  }
  straw.push(paint(sphere(0.09).translate(0, 0.66, 0), '#c98f2e'));
  // filled interior so you can't see through
  straw.push(paint(sphere(0.34, 16, 12).scale(1, 1.4, 1).translate(0, 0.12, 0), '#b07a26'));
  const skep = new THREE.Mesh(merge(straw), creatureMaterial());
  skep.castShadow = true;
  skep.receiveShadow = true;
  group.add(skep);

  const door = new THREE.Mesh(
    new THREE.CircleGeometry(0.1, 16, 0, Math.PI),
    new THREE.MeshBasicMaterial({ color: '#2a1606' }),
  );
  door.position.set(0, 0.06, 0.38);
  group.add(door);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.48, 0.06, 32),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
  );
  base.position.y = 0.03;
  base.receiveShadow = true;
  group.add(base);

  // pennant
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6),
    new THREE.MeshStandardMaterial({ color: '#6b4420' }),
  );
  pole.position.set(0, 0.86, 0);
  group.add(pole);
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0);
  flagShape.lineTo(0.22, -0.06);
  flagShape.lineTo(0, -0.13);
  flagShape.closePath();
  const flag = new THREE.Mesh(
    new THREE.ShapeGeometry(flagShape),
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6 }),
  );
  flag.position.set(0.01, 1.06, 0);
  group.add(flag);
  group.userData.flag = flag;
  group.userData.skep = skep;
  return group;
}

const PETAL_COLORS = ['#ff8fc7', '#fff1fa', '#c79bff', '#ffb35c', '#7fd3ff'];

/** Flower spawner (bees emerge from the middle). */
export function makeFlower(index, dirYaw) {
  const group = new THREE.Group();
  const parts = [];
  const petal = PETAL_COLORS[index % PETAL_COLORS.length];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const p = sphere(0.15, 10, 6);
    p.scale(1, 0.25, 0.55);
    p.translate(0.24, 0.05, 0);
    p.rotateY(a);
    parts.push(paint(p, petal));
  }
  const center = new THREE.CylinderGeometry(0.15, 0.17, 0.08, 20);
  center.translate(0, 0.08, 0);
  parts.push(paint(center, (x, y, z) => ((Math.floor((x + 1) * 30) + Math.floor((z + 1) * 30)) % 2 ? '#a8641b' : '#e2a82a')));
  const mesh = new THREE.Mesh(merge(parts), creatureMaterial());
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);
  // leaf pointing in the spawn direction
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.08, 0.1, 0, 0.22);
  leafShape.quadraticCurveTo(-0.08, 0.1, 0, 0);
  const leaf = new THREE.Mesh(
    new THREE.ShapeGeometry(leafShape),
    new THREE.MeshStandardMaterial({ color: '#4caf3f', side: THREE.DoubleSide }),
  );
  leaf.rotation.x = -Math.PI / 2;
  leaf.position.set(0, 0.02, -0.3);
  const leafPivot = new THREE.Group();
  leafPivot.add(leaf);
  leafPivot.rotation.y = dirYaw;
  group.add(leafPivot);
  group.userData.flower = mesh;
  group.userData.pivot = leafPivot;
  return group;
}

/** Flat arrow pointing north (-Z) for yaw 0. */
export function arrowGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.4);
  s.lineTo(0.3, 0.06);
  s.lineTo(0.12, 0.06);
  s.lineTo(0.12, -0.36);
  s.lineTo(-0.12, -0.36);
  s.lineTo(-0.12, 0.06);
  s.lineTo(-0.3, 0.06);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  g.rotateX(-Math.PI / 2);
  return g;
}
