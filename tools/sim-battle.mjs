// Headless battle: AI vs AI on every map, prints final scores (balancing aid).
//   node tools/sim-battle.mjs [difficulty] [seconds] [target]
import { BATTLE_MAPS } from '../src/game/maps.js';
import { Battle } from '../src/game/battle.js';
import { AIPlayer } from '../src/game/ai.js';

const [diff = 'normal', secs = 180, target = 150] = process.argv.slice(2);
for (const m of BATTLE_MAPS) {
  const t0 = Date.now();
  const battle = new Battle(m.build(), { aiCount: 3, difficulty: diff, timeLimit: Number(secs), target: Number(target), seed: 7 });
  const ais = [0, 1, 2, 3].map((p) => new AIPlayer(battle, p, diff));
  let waves = 0;
  while (battle.state !== 'over') {
    if (battle.state === 'running') for (const ai of ais) ai.update();
    battle.tick();
    waves += battle.feed.filter((f) => f.kind === 'wave').length;
    battle.feed.length = 0;
  }
  const scores = battle.sim.players.map((p) => p.score).join(' / ');
  const time = Number(secs) - battle.secondsLeft();
  console.log(`${m.name.padEnd(16)} winner=P${battle.winner} scores=${scores} after ${time}s waves=${waves} (${Date.now() - t0}ms cpu)`);
}
