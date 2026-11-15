import { CELL, DX, DY, N, E, S, W } from './constants.js';

/**
 * Static playfield: size, walls, holes, hives and flower spawners.
 * Walls are stored per cell as a 4-bit mask (bit d = wall on side d).
 */
export class Board {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.walls = new Uint8Array(n);
    this.type = new Uint8Array(n);
    this.owner = new Int8Array(n).fill(-1);
    this.spawnDir = new Int8Array(n).fill(-1);
    this.hives = [];
    this.spawners = [];
    this.holes = [];
    for (let x = 0; x < w; x++) {
      this.walls[this.idx(x, 0)] |= 1 << N;
      this.walls[this.idx(x, h - 1)] |= 1 << S;
    }
    for (let y = 0; y < h; y++) {
      this.walls[this.idx(0, y)] |= 1 << W;
      this.walls[this.idx(w - 1, y)] |= 1 << E;
    }
  }

  idx(x, y) {
    return y * this.w + x;
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  addWall(x, y, d) {
    if (!this.inside(x, y)) return;
    this.walls[this.idx(x, y)] |= 1 << d;
    const nx = x + DX[d], ny = y + DY[d];
    if (this.inside(nx, ny)) this.walls[this.idx(nx, ny)] |= 1 << ((d + 2) & 3);
  }

  hasWall(x, y, d) {
    return (this.walls[this.idx(x, y)] >> d) & 1;
  }

  setHive(x, y, owner) {
    const c = this.idx(x, y);
    this.type[c] = CELL.HIVE;
    this.owner[c] = owner;
    this.hives.push({ x, y, owner });
  }

  setHole(x, y) {
    this.type[this.idx(x, y)] = CELL.HOLE;
    this.holes.push({ x, y });
  }

  setSpawner(x, y, dir) {
    const c = this.idx(x, y);
    this.type[c] = CELL.SPAWN;
    this.spawnDir[c] = dir;
    this.spawners.push({ x, y, dir });
  }

  /** List of all interior wall segments (each once) for rendering. */
  wallSegments() {
    const segs = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        // North side of every cell (includes top border), West side of every cell (includes left border)
        if (this.hasWall(x, y, N)) segs.push({ x, y, side: N });
        if (this.hasWall(x, y, W)) segs.push({ x, y, side: W });
        if (y === this.h - 1 && this.hasWall(x, y, S)) segs.push({ x, y, side: S });
        if (x === this.w - 1 && this.hasWall(x, y, E)) segs.push({ x, y, side: E });
      }
    }
    return segs;
  }

  /** Render back to the ASCII format understood by parseAscii (debug aid). */
  toAscii() {
    const dirCh = ['^', '>', 'v', '<'];
    const rows = [];
    for (let y = 0; y <= this.h; y++) {
      let wl = '+';
      for (let x = 0; x < this.w; x++) {
        const wall = y === 0 ? this.hasWall(x, 0, N) : this.hasWall(x, y - 1, S);
        wl += (wall ? '-' : ' ') + '+';
      }
      rows.push(wl);
      if (y === this.h) break;
      let cl = this.hasWall(0, y, W) ? '|' : ' ';
      for (let x = 0; x < this.w; x++) {
        const c = this.idx(x, y);
        let ch = '.';
        if (this.type[c] === CELL.HOLE) ch = 'O';
        else if (this.type[c] === CELL.HIVE) ch = String(this.owner[c] + 1);
        else if (this.type[c] === CELL.SPAWN) ch = dirCh[this.spawnDir[c]];
        cl += ch + (this.hasWall(x, y, E) ? '|' : ' ');
      }
      rows.push(cl);
    }
    return rows.join('\n');
  }

  /** BFS distance (in tiles, ignoring arrows) from every cell to (tx, ty). */
  distanceField(tx, ty) {
    const n = this.w * this.h;
    const dist = new Int16Array(n).fill(-1);
    const q = new Int32Array(n);
    let head = 0, tail = 0;
    const start = this.idx(tx, ty);
    dist[start] = 0;
    q[tail++] = start;
    while (head < tail) {
      const c = q[head++];
      const x = c % this.w, y = (c / this.w) | 0;
      for (let d = 0; d < 4; d++) {
        if ((this.walls[c] >> d) & 1) continue;
        const nx = x + DX[d], ny = y + DY[d];
        const nc = this.idx(nx, ny);
        if (dist[nc] !== -1) continue;
        // creatures cannot pass through holes or hives; they end there
        dist[nc] = dist[c] + 1;
        if (this.type[nc] === CELL.HOLE || this.type[nc] === CELL.HIVE) continue;
        q[tail++] = nc;
      }
    }
    return dist;
  }
}

const SPAWN_CHARS = { '^': N, '>': E, v: S, '<': W };

/**
 * Parse an ASCII board. Rows alternate between wall rows and cell rows:
 *
 *   +-+-+-+
 *   |> . 1|      cell chars at odd columns; '|' between cells = wall
 *   + +-+ +      '-' under a cell = wall on its south side
 *   |. O .|
 *   +-+-+-+
 *
 * Cell chars: '.' empty, 'O' hole, '1'..'4' hive of player 0..3,
 *             '^' '>' 'v' '<' flower spawner facing that way.
 */
export function parseAscii(src) {
  const lines = src.replace(/\r/g, '').split('\n').filter((l) => l.trim().length > 0);
  const h = (lines.length - 1) / 2;
  const w = (Math.max(...lines.map((l) => l.trimEnd().length)) - 1) / 2;
  if (!Number.isInteger(h) || !Number.isInteger(w)) {
    throw new Error(`Bad board dimensions: ${lines.length} lines`);
  }
  const b = new Board(w, h);
  const at = (r, c) => (lines[r] && lines[r][c]) || ' ';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = at(2 * y + 1, 2 * x + 1);
      if (ch === 'O') b.setHole(x, y);
      else if (ch >= '1' && ch <= '4') b.setHive(x, y, ch.charCodeAt(0) - 49);
      else if (ch in SPAWN_CHARS) b.setSpawner(x, y, SPAWN_CHARS[ch]);
      // walls: south of cell and east of cell
      if (y < h - 1 && at(2 * y + 2, 2 * x + 1) === '-') b.addWall(x, y, S);
      if (x < w - 1 && at(2 * y + 1, 2 * x + 2) === '|') b.addWall(x, y, E);
    }
  }
  return b;
}
