// Two independent "clients" fed the same frames must stay bit-identical.
import { mapById } from '../src/game/maps.js';
import { Battle } from '../src/game/battle.js';
import { AIPlayer } from '../src/game/ai.js';
import { applyInput, stateHash, TICKS_PER_FRAME } from '../src/game/lockstep.js';
import { makeRng } from '../src/game/rng.js';

const slots = ['human', 'ai', 'human', 'wild'];
const mk = () => {
  const b = new Battle(mapById('honigtopf').build(), { slots, difficulty: 'hard', timeLimit: 120, target: 9999, seed: 4242 });
  const ais = slots.map((s, p) => (s === 'ai' ? new AIPlayer(b, p, 'hard') : null)).filter(Boolean);
  return { b, ais };
};
const clients = [mk(), mk()];
const inputRng = makeRng(99);
let frame = 0;
while (clients[0].b.state !== 'over') {
  // random human inputs, identical for both clients
  const inputs = [];
  if (inputRng() < 0.3) inputs.push([inputRng() < 0.5 ? 0 : 2, inputRng() < 0.9 ? 0 : 1, inputRng.int(12), inputRng.int(9), inputRng.int(4)]);
  for (const c of clients) {
    for (const inp of inputs) applyInput(c.b, inp);
    for (let t = 0; t < TICKS_PER_FRAME; t++) {
      if (c.b.state === 'running') for (const ai of c.ais) ai.update();
      c.b.tick();
      c.b.feed.length = 0;
    }
  }
  frame++;
  if (frame % 20 === 0 && stateHash(clients[0].b) !== stateHash(clients[1].b)) {
    console.log('DESYNC at frame', frame);
    process.exit(1);
  }
}
console.log(`ok: ${frame} frames in sync, scores ${clients[0].b.sim.players.map((p) => p.score).join('/')}, hash ${stateHash(clients[0].b)}`);
