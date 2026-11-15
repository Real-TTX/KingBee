import {
  UNIT, DX, DY, CELL, SPEEDS, BEE_VALUE,
  turnRight, turnLeft, turnBack,
} from './constants.js';
import { makeRng } from './rng.js';

const EAT_DIST2 = (UNIT * 0.5) ** 2;

/**
 * Deterministic grid simulation: creatures walk from tile centre to tile centre,
 * follow arrows, turn at walls (right, else left, else back), fall into holes,
 * enter hives, and hornets eat bees on contact.
 *
 * The sim emits events into `this.events` (cleared by the caller) so rendering,
 * audio and game-mode rules can react.
 */
export class Sim {
  constructor(board, opts = {}) {
    this.board = board;
    this.numPlayers = opts.numPlayers ?? 4;
    this.maxArrows = opts.maxArrows ?? 3;
    this.arrowOverflow = opts.arrowOverflow ?? 'replace'; // 'replace' oldest | 'deny'
    this.arrowHp = opts.arrowHp ?? 2;
    this.eatCooldown = opts.eatCooldown ?? 0; // ticks a hornet chews after eating
    this.rng = makeRng(opts.seed ?? 12345);
    this.entities = [];
    this.arrows = new Array(board.w * board.h).fill(null);
    this.players = Array.from({ length: this.numPlayers }, () => ({
      score: 0,
      arrowCells: [],
      shieldUntil: 0,
    }));
    this.tickCount = 0;
    this.speedMode = 'normal';
    this.nextId = 1;
    this.events = [];
    this.recordEvents = opts.recordEvents ?? true;
    this.beeCount = 0;
    this.hornetCount = 0;
  }

  emit(ev) {
    if (this.recordEvents) this.events.push(ev);
  }

  // ---------------------------------------------------------------- creatures

  spawn(kind, x, y, dir, variant = 'normal') {
    const e = {
      id: this.nextId++,
      kind,
      variant,
      x, y, dir,
      p: 0,
      speed: SPEEDS[kind][this.speedMode],
      alive: true,
      wx: (x + 0.5) * UNIT,
      wy: (y + 0.5) * UNIT,
      pwx: 0, pwy: 0,
      born: this.tickCount,
      fullUntil: 0,
    };
    e.pwx = e.wx; e.pwy = e.wy;
    const a = this.arrows[this.board.idx(x, y)];
    if (a) e.dir = a.dir;
    this.steer(e);
    this.entities.push(e);
    if (kind === 'bee') this.beeCount++; else this.hornetCount++;
    this.emit({ type: 'spawn', kind, variant, x, y, id: e.id });
    return e;
  }

  kill(e) {
    if (!e.alive) return;
    e.alive = false;
    if (e.kind === 'bee') this.beeCount--; else this.hornetCount--;
  }

  /** Choose a walkable direction at the current tile centre (wall rule). */
  steer(e) {
    const b = this.board;
    const w = b.walls[b.idx(e.x, e.y)];
    if (!((w >> e.dir) & 1)) return;
    const r = turnRight(e.dir);
    if (!((w >> r) & 1)) { e.dir = r; return; }
    const l = turnLeft(e.dir);
    if (!((w >> l) & 1)) { e.dir = l; return; }
    const bk = turnBack(e.dir);
    if (!((w >> bk) & 1)) { e.dir = bk; return; }
    e.speed = 0; // completely boxed in
  }

  /** Called when a creature reaches the centre of a tile. */
  arrive(e) {
    const b = this.board;
    const c = b.idx(e.x, e.y);
    const t = b.type[c];
    e.speed = SPEEDS[e.kind][this.speedMode];

    if (t === CELL.HOLE) {
      this.kill(e);
      this.emit({ type: 'fall', kind: e.kind, variant: e.variant, x: e.x, y: e.y, id: e.id, dir: e.dir });
      return;
    }
    if (t === CELL.HIVE) {
      const owner = b.owner[c];
      this.kill(e);
      if (e.kind === 'bee') {
        const value = BEE_VALUE[e.variant] ?? 1;
        if (owner >= 0 && owner < this.numPlayers) this.players[owner].score += value;
        this.emit({ type: 'hiveIn', owner, variant: e.variant, value, x: e.x, y: e.y, id: e.id });
      } else {
        const pl = this.players[owner];
        if (pl && pl.shieldUntil > this.tickCount) {
          this.emit({ type: 'hornetBlocked', owner, x: e.x, y: e.y, id: e.id });
        } else {
          const lost = pl ? Math.ceil(pl.score / 3) : 0;
          if (pl) pl.score -= lost;
          this.emit({ type: 'hornetIn', owner, lost, x: e.x, y: e.y, id: e.id });
        }
      }
      return;
    }
    const a = this.arrows[c];
    if (a) {
      e.dir = a.dir;
      if (e.kind === 'hornet') {
        a.hp--;
        if (a.hp <= 0) this.removeArrowAt(c, 'broken');
        else this.emit({ type: 'arrowDamaged', cell: c });
      }
    }
    this.steer(e);
  }

  tick() {
    this.tickCount++;
    const ents = this.entities;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (!e.alive) continue;
      e.pwx = e.wx; e.pwy = e.wy;
      if (e.speed === 0) continue;
      e.p += e.speed;
      if (e.p >= UNIT) {
        e.p -= UNIT;
        e.x += DX[e.dir];
        e.y += DY[e.dir];
        this.arrive(e);
      }
      e.wx = (e.x + 0.5) * UNIT + DX[e.dir] * e.p;
      e.wy = (e.y + 0.5) * UNIT + DY[e.dir] * e.p;
    }
    if (this.hornetCount > 0 && this.beeCount > 0) this.collide();
    // compact
    let j = 0;
    for (let i = 0; i < ents.length; i++) if (ents[i].alive) ents[j++] = ents[i];
    ents.length = j;
  }

  collide() {
    const ents = this.entities;
    for (let i = 0; i < ents.length; i++) {
      const h = ents[i];
      if (!h.alive || h.kind !== 'hornet' || h.fullUntil > this.tickCount) continue;
      for (let k = 0; k < ents.length; k++) {
        const bee = ents[k];
        if (!bee.alive || bee.kind !== 'bee') continue;
        const dx = bee.wx - h.wx, dy = bee.wy - h.wy;
        if (dx * dx + dy * dy < EAT_DIST2) {
          this.kill(bee);
          this.emit({ type: 'eaten', variant: bee.variant, wx: bee.wx, wy: bee.wy, id: bee.id, by: h.id });
          if (this.eatCooldown) {
            h.fullUntil = this.tickCount + this.eatCooldown;
            break;
          }
        }
      }
    }
  }

  /** Reverse every creature in place (used by the whirlwind event). */
  reverseAll() {
    for (const e of this.entities) {
      if (!e.alive) continue;
      if (e.p > 0) {
        e.x += DX[e.dir];
        e.y += DY[e.dir];
        e.p = UNIT - e.p;
        e.dir = turnBack(e.dir);
      } else {
        e.dir = turnBack(e.dir);
        this.steer(e);
      }
    }
  }

  setSpeedMode(mode) {
    this.speedMode = mode; // applied to each creature at its next tile centre
  }

  // ------------------------------------------------------------------- arrows

  canPlaceArrow(owner, x, y) {
    const b = this.board;
    if (!b.inside(x, y)) return false;
    const c = b.idx(x, y);
    if (b.type[c] !== CELL.EMPTY) return false;
    const a = this.arrows[c];
    if (a && a.owner !== owner) return false;
    if (!a && this.arrowOverflow === 'deny' && this.players[owner].arrowCells.length >= this.maxArrows) return false;
    return true;
  }

  placeArrow(owner, x, y, dir) {
    if (!this.canPlaceArrow(owner, x, y)) return false;
    const c = this.board.idx(x, y);
    const pl = this.players[owner];
    const a = this.arrows[c];
    if (a) {
      a.dir = dir;
      a.hp = this.arrowHp;
      a.placed = this.tickCount;
      pl.arrowCells.splice(pl.arrowCells.indexOf(c), 1);
      pl.arrowCells.push(c);
      this.emit({ type: 'arrowPlaced', owner, cell: c, x, y, dir });
      return true;
    }
    if (pl.arrowCells.length >= this.maxArrows) this.removeArrowAt(pl.arrowCells[0], 'replaced');
    this.arrows[c] = { owner, dir, hp: this.arrowHp, placed: this.tickCount };
    pl.arrowCells.push(c);
    this.emit({ type: 'arrowPlaced', owner, cell: c, x, y, dir });
    return true;
  }

  removeArrow(owner, x, y) {
    if (!this.board.inside(x, y)) return false;
    const c = this.board.idx(x, y);
    const a = this.arrows[c];
    if (!a || a.owner !== owner) return false;
    this.removeArrowAt(c, 'removed');
    return true;
  }

  removeArrowAt(c, reason) {
    const a = this.arrows[c];
    if (!a) return;
    const list = this.players[a.owner].arrowCells;
    const i = list.indexOf(c);
    if (i >= 0) list.splice(i, 1);
    this.arrows[c] = null;
    this.emit({ type: 'arrowRemoved', cell: c, owner: a.owner, reason });
  }

  clearArrows() {
    for (let c = 0; c < this.arrows.length; c++) if (this.arrows[c]) this.removeArrowAt(c, 'wind');
  }

  // --------------------------------------------------------------- prediction

  /**
   * Predict the tiles a creature will visit (ignoring other creatures and
   * arrow damage). Returns { cells, end, steps } where end is
   * 'hive' | 'hole' | 'open' and hiveOwner is set for hives.
   * `extra` optionally overlays one hypothetical arrow {cell, dir}.
   */
  predict(e, maxSteps, extra = null, out = null) {
    const b = this.board;
    let x = e.x, y = e.y, dir = e.dir;
    const res = out || { cells: [], end: 'open', steps: 0, hiveOwner: -1 };
    res.cells.length = 0;
    res.end = 'open';
    res.hiveOwner = -1;
    // The creature is already committed to its current heading (it was
    // steered on arrival), so the first step needs no decision.
    for (let s = 0; s < maxSteps; s++) {
      if (s > 0) {
        const c = b.idx(x, y);
        const a = !extra ? this.arrows[c] : extra.cell === c ? extra : extra.removeCell === c ? null : this.arrows[c];
        if (a) dir = a.dir;
        const w = b.walls[c];
        if ((w >> dir) & 1) {
          if (!((w >> ((dir + 1) & 3)) & 1)) dir = (dir + 1) & 3;
          else if (!((w >> ((dir + 3) & 3)) & 1)) dir = (dir + 3) & 3;
          else dir = (dir + 2) & 3;
        }
      }
      if (e.speed === 0 && s === 0) return res;
      x += DX[dir];
      y += DY[dir];
      const c = b.idx(x, y);
      res.cells.push(c);
      res.steps = s + 1;
      const t = b.type[c];
      if (t === CELL.HOLE) { res.end = 'hole'; return res; }
      if (t === CELL.HIVE) { res.end = 'hive'; res.hiveOwner = b.owner[c]; return res; }
    }
    return res;
  }
}
