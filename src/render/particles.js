import * as THREE from 'three';

const MAX = 900;
const dummy = new THREE.Object3D();
const col = new THREE.Color();

/** Cheap pooled particle system (one instanced mesh). */
export class Particles {
  constructor(scene) {
    const geo = new THREE.OctahedronGeometry(0.05, 0);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, col.set('#fff'));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.items = [];
  }

  emit(pos, opts = {}) {
    const n = opts.count ?? 12;
    for (let i = 0; i < n && this.items.length < MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 1.5) * (0.4 + Math.random() * 0.8);
      const up = opts.up ?? 1.5;
      this.items.push({
        x: pos.x + (Math.random() - 0.5) * (opts.spread ?? 0.1),
        y: pos.y + (Math.random() - 0.5) * (opts.spread ?? 0.1),
        z: pos.z + (Math.random() - 0.5) * (opts.spread ?? 0.1),
        vx: Math.cos(a) * sp,
        vy: up * (0.5 + Math.random()),
        vz: Math.sin(a) * sp,
        life: 0,
        max: (opts.life ?? 0.8) * (0.6 + Math.random() * 0.8),
        size: (opts.size ?? 1) * (0.6 + Math.random() * 0.8),
        gravity: opts.gravity ?? 4,
        color: Array.isArray(opts.color) ? opts.color[i % opts.color.length] : opts.color ?? '#ffd84a',
        spin: Math.random() * 10,
      });
    }
  }

  update(dt) {
    const items = this.items;
    let j = 0;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
      items[j++] = p;
    }
    items.length = j;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      const k = 1 - p.life / p.max;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.spin * p.life, p.spin * 0.7 * p.life, 0);
      dummy.scale.setScalar(p.size * (0.3 + 0.7 * k));
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.mesh.setColorAt(i, col.set(p.color));
    }
    this.mesh.count = items.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.items.length = 0;
  }
}
