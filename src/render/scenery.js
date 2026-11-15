import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// The meadow around the board: sky, rolling hills, swaying grass, flowers,
// trees, rocks, a pond, clouds and butterflies.

const GROUND_Y = -0.42;
const col = new THREE.Color();

function rng(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a0, b0) => a0 + r() * (b0 - a0);
  return r;
}

function paint(geo, color) {
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    col.set(typeof color === 'function' ? color(pos.getX(i), pos.getY(i), pos.getZ(i)) : color);
    arr.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function merge(parts) {
  const geos = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute('uv');
    return n;
  });
  return mergeGeometries(geos);
}

/** Rolling hills height (0 near the board, rising further out). */
function hill(x, z) {
  const d = Math.hypot(x * 0.8, z);
  const k = THREE.MathUtils.smoothstep(d, 14, 34);
  const n = Math.sin(x * 0.11) * Math.cos(z * 0.13) * 2.2 + Math.sin(x * 0.05 + z * 0.07) * 3 + Math.cos(x * 0.21 - z * 0.05) * 0.8;
  return k * (2.5 + n);
}

/** Inject wind sway into a material used on an InstancedMesh. */
function windify(material, uniforms, strength = 0.18) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float hgt = max(position.y, 0.0);
          vec4 wp = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          float sway = sin(uTime * 1.7 + wp.x * 0.55 + wp.z * 0.35) + 0.5 * sin(uTime * 3.1 + wp.z * 0.9);
          transformed.x += sway * hgt * ${strength.toFixed(3)};
          transformed.z += cos(uTime * 1.2 + wp.x * 0.4) * hgt * ${(strength * 0.45).toFixed(3)};
        }`);
  };
  return material;
}

function grassTuftGeometry() {
  const pos = [];
  const colors = [];
  const base = new THREE.Color('#2f6b1f');
  const mid = new THREE.Color('#5fae36');
  const tip = new THREE.Color('#c8e86a');
  const blades = 7;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + Math.random() * 0.6;
    const lean = 0.08 + Math.random() * 0.16;
    const h = 0.28 + Math.random() * 0.26;
    const w = 0.035 + Math.random() * 0.02;
    const ox = Math.cos(a) * 0.05, oz = Math.sin(a) * 0.05;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    const tx = ox + Math.cos(a) * lean, tz = oz + Math.sin(a) * lean;
    // two triangles: base quad narrowing to tip (with a mid joint for a curve)
    const mx = ox + Math.cos(a) * lean * 0.35, mz = oz + Math.sin(a) * lean * 0.35, mh = h * 0.55;
    const v = [
      [ox - px, 0, oz - pz], [ox + px, 0, oz + pz], [mx + px * 0.6, mh, mz + pz * 0.6],
      [ox - px, 0, oz - pz], [mx + px * 0.6, mh, mz + pz * 0.6], [mx - px * 0.6, mh, mz - pz * 0.6],
      [mx - px * 0.6, mh, mz - pz * 0.6], [mx + px * 0.6, mh, mz + pz * 0.6], [tx, h, tz],
    ];
    const c = [base, base, mid, base, mid, mid, mid, mid, tip];
    v.forEach((p, k) => { pos.push(...p); colors.push(c[k].r, c[k].g, c[k].b); });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  // normals pointing up look softer for grass
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3);
  n.needsUpdate = true;
  return g;
}

function flowerGeometry(petal, center = '#ffd23a') {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.42, 5);
  stem.translate(0, 0.21, 0);
  parts.push(paint(stem, '#3f8a2a'));
  const leaf = new THREE.SphereGeometry(0.06, 6, 4);
  leaf.scale(1, 0.2, 0.45);
  leaf.translate(0.06, 0.12, 0);
  leaf.rotateY(0.6);
  parts.push(paint(leaf, '#4f9c34'));
  for (let i = 0; i < 6; i++) {
    const p = new THREE.SphereGeometry(0.055, 8, 5);
    p.scale(1, 0.28, 0.6);
    p.translate(0.06, 0, 0);
    p.rotateY((i / 6) * Math.PI * 2);
    p.rotateX(-0.25);
    p.translate(0, 0.43, 0);
    parts.push(paint(p, petal));
  }
  const c = new THREE.SphereGeometry(0.04, 8, 6);
  c.translate(0, 0.44, 0);
  parts.push(paint(c, center));
  return merge(parts);
}

function treeGeometry(r, kind) {
  const parts = [];
  const trunkH = kind === 'pine' ? 1.2 : 1.6;
  const trunk = new THREE.CylinderGeometry(0.12, 0.2, trunkH, 7);
  trunk.translate(0, trunkH / 2, 0);
  parts.push(paint(trunk, '#7a4f2a'));
  if (kind === 'pine') {
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.ConeGeometry(1.0 - i * 0.24, 1.3, 7);
      cone.translate(0, 1.4 + i * 0.75, 0);
      parts.push(paint(cone, ['#2f6e3a', '#3a8045', '#4a9450'][i]));
    }
  } else {
    const greens = ['#4f9a33', '#5fae3c', '#3f8a2c', '#6dbb45'];
    const blobs = 4 + Math.floor(r() * 3);
    for (let i = 0; i < blobs; i++) {
      const s = new THREE.IcosahedronGeometry(0.55 + r() * 0.45, 1);
      s.translate((r() - 0.5) * 1.1, 1.9 + r() * 0.9, (r() - 0.5) * 1.1);
      parts.push(paint(s, greens[i % greens.length]));
    }
  }
  return merge(parts);
}

export class Scenery {
  constructor(scene) {
    this.scene = scene;
    this.uniforms = { uTime: { value: 0 } };
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildSky();
    this.buildGround();
    this.decor = new THREE.Group();
    this.group.add(this.decor);
    this.clouds = [];
    this.butterflies = [];
    this.buildClouds();
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(150, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#3f9be6') },
        horizon: { value: new THREE.Color('#cfefff') },
        bottom: { value: new THREE.Color('#e9f7d6') },
      },
      vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = h > 0.0 ? mix(horizon, top, pow(min(1.0, h * 1.6), 0.7)) : mix(horizon, bottom, min(1.0, -h * 4.0));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.group.add(this.sky);
  }

  buildGround() {
    // grass texture
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#86c45a';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, r = 30 + Math.random() * 90;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      const light = Math.random() < 0.5;
      grad.addColorStop(0, light ? 'rgba(190, 230, 110, 0.35)' : 'rgba(60, 120, 40, 0.3)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.lineCap = 'round';
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      const len = 3 + Math.random() * 7;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      g.strokeStyle = `hsla(${88 + Math.random() * 30}, ${45 + Math.random() * 25}%, ${30 + Math.random() * 30}%, 0.55)`;
      g.lineWidth = 1 + Math.random() * 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(22, 22);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;

    const geo = new THREE.PlaneGeometry(220, 220, 110, 110);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const near = new THREE.Color('#ffffff');
    const far = new THREE.Color('#cfe3a0');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = hill(x, z);
      pos.setY(i, y);
      const k = THREE.MathUtils.smoothstep(Math.hypot(x, z), 10, 60);
      col.copy(near).lerp(far, k);
      const shade = 0.9 + Math.sin(x * 0.3) * Math.cos(z * 0.27) * 0.08 + y * 0.02;
      colors.set([col.r * shade, col.g * shade, col.b * shade], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 1 }));
    ground.position.y = GROUND_Y;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  buildClouds() {
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35, fog: false });
    const r = rng(77);
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Group();
      const n = 4 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + r() * 1.6, 2), mat);
        s.position.set(k * 1.9 - n, r() * 0.8, (r() - 0.5) * 1.6);
        s.scale.y = 0.65;
        cloud.add(s);
      }
      cloud.position.set((r() - 0.5) * 140, 26 + r() * 14, -40 - r() * 60);
      cloud.userData.speed = 0.4 + r() * 0.6;
      this.clouds.push(cloud);
      this.group.add(cloud);
    }
  }

  /** Place all decoration around a board of w x h tiles. */
  build(w, h) {
    this.decor.clear();
    this.butterflies = [];
    const r = rng(w * 131 + h * 7);
    const bx = w / 2 + 0.9, bz = h / 2 + 0.9;
    const pond = { x: -bx - 4.2, z: -1.5, r: 2.1 };
    const occupied = [pond];
    const outside = (x, z, pad = 0) => Math.abs(x) > bx + pad || Math.abs(z) > bz + pad;
    const free = (x, z, rad) => occupied.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + rad);
    const ground = (x, z) => GROUND_Y + hill(x, z);

    // soft contact shadow under the board
    const sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    const sg = sc.getContext('2d');
    const grad = sg.createRadialGradient(64, 64, 20, 64, 64, 64);
    grad.addColorStop(0, 'rgba(30, 50, 10, 0.55)');
    grad.addColorStop(1, 'rgba(30, 50, 10, 0)');
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 4, h + 4),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = GROUND_Y + 0.01;
    this.decor.add(shadow);

    // pond
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(pond.r, 40),
      new THREE.MeshStandardMaterial({ color: '#4fb8e8', roughness: 0.08, metalness: 0.2, emissive: '#1a6f9a', emissiveIntensity: 0.15 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.scale.set(1.25, 1, 1);
    water.position.set(pond.x, ground(pond.x, pond.z) + 0.03, pond.z);
    this.decor.add(water);
    this.water = water;
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#9a9488', roughness: 0.9, flatShading: true });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + r() * 0.15, 0), stoneMat);
      s.position.set(pond.x + Math.cos(a) * pond.r * 1.27, ground(pond.x, pond.z) + 0.05, pond.z + Math.sin(a) * pond.r * 1.02);
      s.rotation.set(r() * 3, r() * 3, r() * 3);
      s.scale.y = 0.6;
      s.castShadow = true;
      this.decor.add(s);
    }
    const padMat = new THREE.MeshStandardMaterial({ color: '#4c9e3a', roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.26 + r() * 0.12, 16, 0.4, Math.PI * 2 - 0.4), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = r() * 6;
      pad.position.set(pond.x + (r() - 0.5) * 2.4, water.position.y + 0.01, pond.z + (r() - 0.5) * 1.8);
      this.decor.add(pad);
      if (i === 0) {
        const bloom = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.14, 6, 1, true), new THREE.MeshStandardMaterial({ color: '#ffc4dd', side: THREE.DoubleSide }));
        bloom.rotation.x = Math.PI;
        bloom.position.set(pad.position.x, pad.position.y + 0.07, pad.position.z);
        this.decor.add(bloom);
      }
    }

    // trees in the back and on the sides (never between camera and board)
    const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < 22; tries++) {
      const x = r.range(-bx - 14, bx + 14);
      const z = r.range(-bz - 14, bz + 3);
      if (!outside(x, z, 2.2) || !free(x, z, 1.6)) continue;
      if (z > -bz && Math.abs(x) < bx + 4.5) continue; // keep the sides near the board open
      const kind = r() < 0.3 ? 'pine' : 'round';
      const t = new THREE.Mesh(treeGeometry(r, kind), treeMat);
      const s = 0.85 + r() * 0.6;
      t.scale.setScalar(s);
      t.position.set(x, ground(x, z), z);
      t.rotation.y = r() * 6;
      t.castShadow = true;
      this.decor.add(t);
      occupied.push({ x, z, r: 1.4 * s });
      placed++;
    }

    // bushes
    const bushMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    for (let tries = 0, n = 0; tries < 300 && n < 16; tries++) {
      const x = r.range(-bx - 9, bx + 9);
      const z = r.range(-bz - 9, bz + 6);
      if (!outside(x, z, 1.2) || !free(x, z, 0.9)) continue;
      const parts = [];
      const k = 3 + Math.floor(r() * 3);
      for (let i = 0; i < k; i++) {
        const s = new THREE.IcosahedronGeometry(0.35 + r() * 0.3, 1);
        s.translate((r() - 0.5) * 0.9, 0.25 + r() * 0.25, (r() - 0.5) * 0.9);
        parts.push(paint(s, ['#4a9a30', '#5aab3a', '#3e8a28'][i % 3]));
      }
      if (r() < 0.5) {
        for (let i = 0; i < 6; i++) {
          const berry = new THREE.SphereGeometry(0.05, 6, 4);
          berry.translate((r() - 0.5) * 1, 0.4 + r() * 0.35, (r() - 0.5) * 1);
          parts.push(paint(berry, r() < 0.5 ? '#ff5a6e' : '#ffffff'));
        }
      }
      const bush = new THREE.Mesh(merge(parts), bushMat);
      bush.position.set(x, ground(x, z), z);
      bush.castShadow = true;
      this.decor.add(bush);
      occupied.push({ x, z, r: 0.8 });
      n++;
    }

    // rocks and mushrooms
    for (let tries = 0, n = 0; tries < 200 && n < 14; tries++) {
      const x = r.range(-bx - 8, bx + 8);
      const z = r.range(-bz - 8, bz + 5);
      if (!outside(x, z, 0.7) || !free(x, z, 0.4)) continue;
      if (r() < 0.6) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + r() * 0.35, 0), stoneMat);
        rock.position.set(x, ground(x, z) + 0.05, z);
        rock.scale.set(1, 0.55 + r() * 0.3, 0.8 + r() * 0.4);
        rock.rotation.y = r() * 6;
        rock.castShadow = true;
        this.decor.add(rock);
      } else {
        const parts = [];
        const count = 1 + Math.floor(r() * 3);
        for (let i = 0; i < count; i++) {
          const ox = (r() - 0.5) * 0.4, oz = (r() - 0.5) * 0.4, s = 0.6 + r() * 0.6;
          const stem = new THREE.CylinderGeometry(0.035 * s, 0.045 * s, 0.16 * s, 6);
          stem.translate(ox, 0.08 * s, oz);
          parts.push(paint(stem, '#fff6e6'));
          const cap = new THREE.SphereGeometry(0.11 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
          cap.translate(ox, 0.15 * s, oz);
          parts.push(paint(cap, '#e5322f'));
          for (let d = 0; d < 4; d++) {
            const dot = new THREE.SphereGeometry(0.018 * s, 5, 4);
            const a = r() * Math.PI * 2;
            dot.translate(ox + Math.cos(a) * 0.06 * s, 0.15 * s + 0.07 * s, oz + Math.sin(a) * 0.06 * s);
            parts.push(paint(dot, '#ffffff'));
          }
        }
        const m = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
        m.position.set(x, ground(x, z), z);
        m.castShadow = true;
        this.decor.add(m);
      }
      occupied.push({ x, z, r: 0.4 });
      n++;
    }

    // swaying grass
    const grassMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), this.uniforms);
    const tuftGeo = grassTuftGeometry();
    const GRASS = 2600;
    const grass = new THREE.InstancedMesh(tuftGeo, grassMat, GRASS);
    const d = new THREE.Object3D();
    let n = 0;
    for (let tries = 0; tries < GRASS * 6 && n < GRASS; tries++) {
      // denser close to the board edge
      const ring = Math.pow(r(), 1.8) * 16;
      const side = Math.floor(r() * 4);
      let x, z;
      if (side < 2) { x = r.range(-bx - ring, bx + ring); z = (side ? 1 : -1) * (bz + 0.1 + ring); }
      else { z = r.range(-bz - ring, bz + ring); x = (side === 2 ? 1 : -1) * (bx + 0.1 + ring); }
      x += (r() - 0.5) * 0.8;
      z += (r() - 0.5) * 0.8;
      if (!outside(x, z, -0.25) || !free(x, z, 0.1)) continue;
      d.position.set(x, ground(x, z), z);
      d.rotation.set(0, r() * 6, 0);
      d.scale.setScalar(0.7 + r() * 0.9);
      d.updateMatrix();
      grass.setMatrixAt(n++, d.matrix);
    }
    grass.count = n;
    grass.receiveShadow = true;
    this.decor.add(grass);

    // flowers in a few colours
    const petals = ['#ffffff', '#ffd1e8', '#ffe066', '#c9a2ff', '#ff8f8f', '#9fd8ff'];
    for (const p of petals) {
      const fmat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), this.uniforms, 0.12);
      const fm = new THREE.InstancedMesh(flowerGeometry(p, p === '#ffe066' ? '#e07a00' : '#ffd23a'), fmat, 40);
      let k = 0;
      for (let tries = 0; tries < 600 && k < 40; tries++) {
        // flowers grow in little patches
        const cx = r.range(-bx - 10, bx + 10);
        const cz = r.range(-bz - 9, bz + 7);
        for (let j = 0; j < 4 && k < 40; j++) {
          const x = cx + (r() - 0.5) * 1.2, z = cz + (r() - 0.5) * 1.2;
          if (!outside(x, z, 0.3) || !free(x, z, 0.2)) continue;
          d.position.set(x, ground(x, z), z);
          d.rotation.set(0, r() * 6, 0);
          d.scale.setScalar(0.8 + r() * 0.7);
          d.updateMatrix();
          fm.setMatrixAt(k++, d.matrix);
        }
      }
      fm.count = k;
      fm.castShadow = true;
      this.decor.add(fm);
    }

    // butterflies
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.bezierCurveTo(0.12, 0.16, 0.26, 0.12, 0.2, 0);
    wingShape.bezierCurveTo(0.24, -0.1, 0.1, -0.16, 0, 0);
    const wingGeo = new THREE.ShapeGeometry(wingShape);
    wingGeo.rotateX(-Math.PI / 2);
    const bcols = ['#ff7ab6', '#ffd23a', '#7fd3ff', '#ffffff', '#ff9a3c', '#c99bff'];
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: bcols[i % bcols.length], side: THREE.DoubleSide, roughness: 0.6 });
      const wr = new THREE.Mesh(wingGeo, m);
      const wl = new THREE.Mesh(wingGeo, m);
      wl.scale.x = -1;
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.1, 3, 6), new THREE.MeshStandardMaterial({ color: '#2a1a0c' }));
      body.rotation.x = Math.PI / 2;
      b.add(wr, wl, body);
      const side = i % 2 ? 1 : -1;
      b.userData = {
        wr, wl,
        cx: side * (bx + 1.5 + r() * 4), cz: r.range(-bz - 3, bz + 2),
        rx: 1 + r() * 2.5, rz: 0.8 + r() * 2, sp: 0.25 + r() * 0.35, ph: r() * 10, y: 0.6 + r() * 1.2,
      };
      this.decor.add(b);
      this.butterflies.push(b);
    }
  }

  update(dt, t) {
    this.uniforms.uTime.value = t;
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 80) c.position.x = -80;
    }
    for (const b of this.butterflies) {
      const u = b.userData;
      const a = t * u.sp + u.ph;
      const x = u.cx + Math.sin(a) * u.rx;
      const z = u.cz + Math.sin(a * 1.7) * u.rz;
      const nx = u.cx + Math.sin(a + 0.05) * u.rx;
      const nz = u.cz + Math.sin((a + 0.05) * 1.7) * u.rz;
      b.position.set(x, GROUND_Y + hill(x, z) + u.y + Math.sin(t * 3 + u.ph) * 0.15, z);
      b.rotation.y = Math.atan2(nx - x, nz - z);
      const flap = Math.sin(t * 18 + u.ph) * 0.9;
      u.wr.rotation.z = flap;
      u.wl.rotation.z = -flap;
    }
    if (this.water) this.water.material.emissiveIntensity = 0.15 + Math.sin(t * 1.5) * 0.04;
  }
}
