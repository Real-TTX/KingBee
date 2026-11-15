// Verifies all puzzle levels (solvable with the given arrow budget, not
// solvable with fewer arrows, documented solution works) and sanity-checks
// the battle maps.
//   node tools/verify-levels.mjs            all levels + maps
//   node tools/verify-levels.mjs 4 --show   one level, print board + solutions
import { PUZZLES } from '../src/game/levels.js';
import { BATTLE_MAPS } from '../src/game/maps.js';
import { simulatePuzzle } from '../src/game/puzzle.js';
import { minSolve, withBoard } from './solver.mjs';

let problems = 0;
const args = process.argv.slice(2);
const show = args.includes('--show');
const onlyArg = args.find((a) => /^\d+$/.test(a));
const only = onlyArg !== undefined ? Number(onlyArg) - 1 : null;

PUZZLES.forEach((level, i) => {
  if (only !== null && only !== i) return;
  const lv = withBoard(level);
  const t0 = Date.now();
  let line = `#${String(i + 1).padStart(2)} ${level.name.padEnd(18)} arrows=${level.arrows}`;
  if (simulatePuzzle(lv, []).ok) { line += '  !! solvable with 0 arrows'; problems++; }
  if (level.solution) {
    const r = simulatePuzzle(lv, level.solution);
    if (!r.ok) { line += `  !! documented solution FAILS (${r.fail?.reason})`; problems++; }
    if (level.solution.length > level.arrows) { line += '  !! solution uses too many arrows'; problems++; }
  }
  const { min, solutions } = minSolve(lv, level.arrows);
  if (min === null) { line += '  !! NOT SOLVABLE with budget'; problems++; }
  else {
    line += `  min=${min} solutions=${solutions.length >= 20 ? '20+' : solutions.length}`;
    if (min < level.arrows) line += '  (easier than budget)';
  }
  line += `  ${Date.now() - t0}ms`;
  console.log(line);
  if (show) {
    console.log(lv.board.toAscii());
    for (const s of solutions.slice(0, 10)) console.log('  ', JSON.stringify(s));
  }
});

if (only === null) {
  for (const m of BATTLE_MAPS) {
    const b = m.build();
    const issues = [];
    if (b.hives.length !== 4) issues.push(`hives=${b.hives.length}`);
    if (b.spawners.length < 2) issues.push('need >=2 spawners');
    const s = b.spawners[0];
    const dist = b.distanceField(s.x, s.y);
    let unreachable = [];
    for (let c = 0; c < b.w * b.h; c++) if (dist[c] < 0) unreachable.push(`${c % b.w},${(c / b.w) | 0}`);
    if (unreachable.length) issues.push(`unreachable: ${unreachable.join(' ')}`);
    console.log(`map ${m.name.padEnd(18)} ${b.w}x${b.h} ${issues.length ? '!! ' + issues.join(', ') : 'ok'}`);
    if (show || issues.length) console.log(b.toAscii());
    if (issues.length) problems++;
  }
}

console.log(problems ? `\n${problems} problem(s)` : '\nall good');
process.exit(problems ? 1 : 0);
