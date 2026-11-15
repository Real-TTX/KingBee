import { TICK_RATE, CELL } from './constants.js';

const PROFILES = {
  easy:   { think: [1.3, 2.2], sample: 10, cells: 6,  defend: 0.45, threshold: 40, mistake: 0.25 },
  normal: { think: [0.7, 1.2], sample: 22, cells: 10, defend: 0.8,  threshold: 25, mistake: 0.08 },
  hard:   { think: [0.35, 0.6], sample: 40, cells: 16, defend: 1.0, threshold: 15, mistake: 0 },
};

const VALUE = { normal: 1, gold: 10, pollen: 3 };

/**
 * Computer opponent. Every think-tick it looks at where creatures are heading
 * (using Sim.predict) and places the single arrow that improves its outlook
 * the most: first defend against hornets, then steer bees into its own hive.
 */
export class AIPlayer {
  constructor(battle, owner, difficulty = 'normal') {
    this.battle = battle;
    this.owner = owner;
    this.p = PROFILES[difficulty] || PROFILES.normal;
    this.rng = battle.rng;
    const hive = battle.board.hives.find((h) => h.owner === owner);
    this.dist = battle.board.distanceField(hive.x, hive.y);
    this.timer = this.nextDelay() + TICK_RATE;
    this.tmp = { cells: [], end: 'open', steps: 0, hiveOwner: -1 };
  }

  nextDelay() {
    const [a, b] = this.p.think;
    return Math.round(this.rng.range(a, b) * TICK_RATE);
  }

  update() {
    if (--this.timer > 0) return;
    this.timer = this.nextDelay();
    if (this.defend()) return;
    this.attack();
  }

  /** Score of one predicted path for this player. */
  pathScore(pred) {
    if (pred.end === 'hive') {
      if (pred.hiveOwner === this.owner) return 100 - pred.steps;
      return this.battle.active[pred.hiveOwner] ? -40 : -10;
    }
    if (pred.end === 'hole') return -60;
    const last = pred.cells[pred.cells.length - 1];
    const d = last !== undefined ? this.dist[last] : -1;
    return d >= 0 ? -Math.min(30, d * 1.5) : -30;
  }

  hornetScore(pred) {
    if (pred.end === 'hive') {
      if (pred.hiveOwner === this.owner) return -400;
      return this.battle.active[pred.hiveOwner] ? 60 : 10;
    }
    if (pred.end === 'hole') return 40;
    return 0;
  }

  /** The arrow that would disappear if we placed a new one now. */
  replacedCell(cell) {
    const sim = this.battle.sim;
    const mine = sim.players[this.owner].arrowCells;
    if (mine.includes(cell)) return -1;
    return mine.length >= sim.maxArrows ? mine[0] : -1;
  }

  defend() {
    const sim = this.battle.sim;
    const pred = this.tmp;
    for (const h of sim.entities) {
      if (h.kind !== 'hornet' || !h.alive) continue;
      sim.predict(h, 14, null, pred);
      if (pred.end !== 'hive' || pred.hiveOwner !== this.owner) continue;
      if (this.rng() > this.p.defend) continue;
      const path = pred.cells.slice(0, Math.max(1, pred.cells.length - 1));
      let best = null;
      for (let i = 0; i < Math.min(6, path.length); i++) {
        const cell = path[i];
        const x = cell % sim.board.w, y = (cell / sim.board.w) | 0;
        if (!sim.canPlaceArrow(this.owner, x, y)) continue;
        const removeCell = this.replacedCell(cell);
        for (let d = 0; d < 4; d++) {
          const extra = { cell, dir: d, removeCell };
          const r = sim.predict(h, 18, extra, { cells: [], end: 'open', steps: 0, hiveOwner: -1 });
          const s = this.hornetScore(r) - i * 2;
          if (s > -100 && (!best || s > best.s)) best = { s, x, y, d };
        }
      }
      if (best) {
        sim.placeArrow(this.owner, best.x, best.y, best.d);
        return true;
      }
    }
    return false;
  }

  attack() {
    const sim = this.battle.sim;
    const board = sim.board;
    const bees = [];
    for (const e of sim.entities) if (e.kind === 'bee' && e.alive) bees.push(e);
    if (!bees.length) return;
    // random sample of bees, gold/pollen always included
    const sample = [];
    for (const b of bees) if (b.variant !== 'normal') sample.push(b);
    for (let i = 0; i < bees.length && sample.length < this.p.sample; i++) {
      const b = bees[this.rng.int(bees.length)];
      if (!sample.includes(b)) sample.push(b);
    }
    const hornets = sim.entities.filter((e) => e.kind === 'hornet' && e.alive);

    // baseline predictions and traffic per cell
    const base = [];
    const traffic = new Map();
    for (const b of sample) {
      const r = sim.predict(b, 24, null, { cells: [], end: 'open', steps: 0, hiveOwner: -1 });
      const w = VALUE[b.variant] || 1;
      base.push({ b, r, s: this.pathScore(r) * w, w });
      for (let i = 0; i < Math.min(8, r.cells.length); i++) {
        const c = r.cells[i];
        if (board.type[c] !== CELL.EMPTY) continue;
        traffic.set(c, (traffic.get(c) || 0) + w * (8 - i));
      }
    }
    const hornetBase = hornets.map((h) => {
      const r = sim.predict(h, 16, null, { cells: [], end: 'open', steps: 0, hiveOwner: -1 });
      return { h, s: this.hornetScore(r) };
    });

    const cells = [...traffic.entries()].sort((a, b) => b[1] - a[1]).slice(0, this.p.cells);
    let best = null;
    const tmp = { cells: [], end: 'open', steps: 0, hiveOwner: -1 };
    for (const [cell] of cells) {
      const x = cell % board.w, y = (cell / board.w) | 0;
      if (!sim.canPlaceArrow(this.owner, x, y)) continue;
      const existing = sim.arrows[cell];
      const removeCell = this.replacedCell(cell);
      for (let d = 0; d < 4; d++) {
        if (existing && existing.dir === d) continue;
        const extra = { cell, dir: d, removeCell };
        let delta = 0;
        for (const it of base) {
          const r = sim.predict(it.b, 24, extra, tmp);
          delta += this.pathScore(r) * it.w - it.s;
        }
        for (const hb of hornetBase) {
          const r = sim.predict(hb.h, 16, extra, tmp);
          delta += this.hornetScore(r) - hb.s;
        }
        if (!best || delta > best.delta) best = { delta, x, y, d };
      }
    }
    if (!best || best.delta < this.p.threshold) return;
    let { x, y, d } = best;
    if (this.rng() < this.p.mistake) d = this.rng.int(4);
    sim.placeArrow(this.owner, x, y, d);
  }
}
