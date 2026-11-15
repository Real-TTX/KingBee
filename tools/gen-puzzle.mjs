// Randomly places creatures on a level's map and keeps the hardest variants.
//   node tools/gen-puzzle.mjs <level#> <tries> <bees> <hornets> <targetMin>
import { PUZZLES } from '../src/game/levels.js';
import { CELL } from '../src/game/constants.js';
import { makeRng } from '../src/game/rng.js';
import { simulatePuzzle } from '../src/game/puzzle.js';
import { solve, withBoard } from './solver.mjs';

const [lvNum, tries = 200, nBees = 3, nHornets = 0, target = 3, seed = Date.now()] = process.argv.slice(2).map(Number);
const base = withBoard(PUZZLES[lvNum - 1]);
const b = base.board;
const rng = makeRng(seed);
const empty = [];
for (let c = 0; c < b.w * b.h; c++) if (b.type[c] === CELL.EMPTY) empty.push(c);
const D = ['N', 'E', 'S', 'W'];
const results = [];

for (let t = 0; t < tries; t++) {
  const cells = [...empty].sort(() => rng() - 0.5).slice(0, nBees + nHornets);
  const ent = cells.map((c) => [c % b.w, (c / b.w) | 0, rng.pick(D)]);
  const lv = { ...base, bees: ent.slice(0, nBees), hornets: ent.slice(nBees), solution: undefined };
  if (simulatePuzzle(lv, []).ok) continue;
  let ok = true;
  for (let d = 1; d < target; d++) {
    if (solve(lv, d, 1, 40000).solutions.length) { ok = false; break; }
  }
  if (!ok) continue;
  const r = solve(lv, target, 8, 400000);
  if (!r.solutions.length) continue;
  results.push({ n: r.solutions.length, bees: lv.bees, hornets: lv.hornets, sol: r.solutions[0] });
  console.log(`[${t}] solutions=${r.solutions.length}  bees=${JSON.stringify(lv.bees)} hornets=${JSON.stringify(lv.hornets)} sol=${JSON.stringify(r.solutions[0])}`);
}
results.sort((a, c) => a.n - c.n);
console.log('\nBEST:', JSON.stringify(results.slice(0, 3), null, 0));
