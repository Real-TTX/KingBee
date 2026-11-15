// Deterministic lockstep helpers for online play.
//
// The server is only the clock: every 50 ms it broadcasts a frame containing
// the arrow inputs it received. Every client applies those inputs at the
// start of the frame and then runs TICKS_PER_FRAME simulation ticks. Because
// the simulation (including the AI) is fully deterministic for a given seed,
// all clients compute the identical game.

export const TICKS_PER_FRAME = 3;
export const FRAME_MS = 50;
export const HASH_EVERY_FRAMES = 20;

export const INPUT_PLACE = 0;
export const INPUT_REMOVE = 1;

/** Apply one network input [slot, kind, x, y, dir] to a battle. */
export function applyInput(battle, input) {
  const [slot, kind, x, y, dir] = input;
  if (battle.slots[slot] !== 'human' || battle.state !== 'running') return false;
  if (kind === INPUT_PLACE) return battle.sim.placeArrow(slot, x, y, dir & 3);
  if (kind === INPUT_REMOVE) return battle.sim.removeArrow(slot, x, y);
  return false;
}

/** 32-bit FNV-1a style checksum over the relevant game state. */
export function stateHash(battle) {
  const sim = battle.sim;
  let h = 0x811c9dc5;
  const mix = (v) => {
    h ^= v | 0;
    h = Math.imul(h, 0x01000193);
  };
  mix(sim.tickCount);
  mix(sim.nextId);
  for (const p of sim.players) mix(p.score);
  for (const e of sim.entities) {
    if (!e.alive) continue;
    mix(e.id); mix(e.x); mix(e.y); mix(e.dir); mix(e.p);
  }
  for (let c = 0; c < sim.arrows.length; c++) {
    const a = sim.arrows[c];
    if (a) { mix(c); mix(a.owner); mix(a.dir); mix(a.hp); }
  }
  return h | 0;
}
