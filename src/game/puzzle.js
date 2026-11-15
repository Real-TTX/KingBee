import { parseAscii } from './board.js';
import { Sim } from './sim.js';
import { TICK_RATE } from './constants.js';

export const DIR_LETTER = { N: 0, E: 1, S: 2, W: 3 };
const TIMEOUT_TICKS = TICK_RATE * 40;

/**
 * Puzzle mode: the player gets a fixed number of arrows, places them while the
 * board is frozen, then presses start. Every bee must reach a hive; no bee may
 * be eaten or fall into a hole, and no hornet may enter a hive.
 */
export class PuzzleRun {
  constructor(level) {
    this.level = level;
    this.board = level.board || parseAscii(level.map);
    this.sim = new Sim(this.board, {
      numPlayers: 1,
      maxArrows: level.arrows,
      arrowOverflow: 'deny',
      seed: 1,
    });
    this.phase = 'plan';
    this.fail = null;
    this.saved = 0;
    this.totalBees = level.bees.length;
    this.placeCreatures();
  }

  placeCreatures() {
    const sim = this.sim;
    for (const e of sim.entities) sim.kill(e);
    sim.entities.length = 0;
    sim.tickCount = 0;
    for (const [x, y, d] of this.level.bees) sim.spawn('bee', x, y, DIR_LETTER[d]);
    for (const [x, y, d] of this.level.hornets || []) sim.spawn('hornet', x, y, DIR_LETTER[d]);
  }

  arrowsLeft() {
    return this.level.arrows - this.sim.players[0].arrowCells.length;
  }

  start() {
    if (this.phase === 'run') return;
    for (const a of this.sim.arrows) if (a) a.hp = this.sim.arrowHp;
    this.fail = null;
    this.saved = 0;
    this.sim.events.length = 0;
    this.placeCreatures();
    this.phase = 'run';
  }

  /** Back to planning: creatures return to their start, arrows stay. */
  stop() {
    this.phase = 'plan';
    this.fail = null;
    this.placeCreatures();
  }

  clearArrows() {
    if (this.phase === 'run') return;
    this.sim.clearArrows();
  }

  /** Advance one tick; returns the list of events from this tick. */
  tick() {
    if (this.phase !== 'run') return [];
    const sim = this.sim;
    sim.tick();
    const evs = sim.events.splice(0);
    for (const ev of evs) {
      if (this.fail) break;
      if (ev.type === 'fall' && ev.kind === 'bee') {
        this.fail = { reason: 'Eine Biene ist in ein Loch gefallen!', x: ev.x, y: ev.y };
      } else if (ev.type === 'eaten') {
        this.fail = { reason: 'Eine Hornisse hat eine Biene erwischt!', wx: ev.wx, wy: ev.wy };
      } else if (ev.type === 'hornetIn') {
        this.fail = { reason: 'Eine Hornisse ist in den Stock eingedrungen!', x: ev.x, y: ev.y };
      } else if (ev.type === 'hiveIn') {
        this.saved++;
      }
    }
    if (!this.fail && sim.tickCount > TIMEOUT_TICKS) {
      this.fail = { reason: 'Die Bienen finden den Weg nicht nach Hause.' };
    }
    if (this.fail) this.phase = 'fail';
    else if (sim.beeCount === 0) this.phase = 'success';
    return evs;
  }
}

/**
 * Headless check used by the level tools: run a puzzle with the given arrows.
 * Returns { ok, visited:Set<cell> }.
 */
export function simulatePuzzle(level, arrows) {
  const run = new PuzzleRun({ ...level, arrows: Math.max(level.arrows, arrows.length) });
  for (const [x, y, d] of arrows) run.sim.placeArrow(0, x, y, typeof d === 'string' ? DIR_LETTER[d] : d);
  run.start();
  const visited = new Set();
  const b = run.sim.board;
  for (const e of run.sim.entities) visited.add(b.idx(e.x, e.y));
  while (run.phase === 'run') {
    run.tick();
    for (const e of run.sim.entities) visited.add(b.idx(e.x, e.y));
  }
  return { ok: run.phase === 'success', visited, fail: run.fail };
}
