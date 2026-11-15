// Brute-force puzzle solver used by the level tools.
// Only tiles that a creature actually reaches can matter, so after each
// placed arrow we branch only over the tiles visited in that simulation.
import { simulatePuzzle } from '../src/game/puzzle.js';
import { parseAscii } from '../src/game/board.js';
import { CELL } from '../src/game/constants.js';

const DIRS = ['N', 'E', 'S', 'W'];

export function withBoard(level) {
  return level.board ? level : { ...level, board: parseAscii(level.map) };
}

/** Find up to `limit` solutions using exactly `depth` arrows. */
export function solve(level, depth, limit = 20, budget = Infinity) {
  const lv = withBoard(level);
  const board = lv.board;
  const found = new Map();
  const tried = new Set();
  let sims = 0;
  const rec = (arrows, visited) => {
    for (const c of visited) {
      if (found.size >= limit || sims > budget) return;
      if (board.type[c] !== CELL.EMPTY) continue;
      if (arrows.some((a) => a[3] === c)) continue;
      const x = c % board.w, y = (c / board.w) | 0;
      for (let d = 0; d < 4; d++) {
        const next = [...arrows, [x, y, DIRS[d], c]];
        const key = next.map((a) => `${a[0]},${a[1]},${a[2]}`).sort().join(' ');
        if (tried.has(key)) continue;
        tried.add(key);
        sims++;
        const r = simulatePuzzle({ ...lv, arrows: next.length }, next);
        if (next.length === depth) {
          if (r.ok) found.set(key, next.map((a) => a.slice(0, 3)));
        } else if (!r.ok) {
          rec(next, r.visited);
        }
      }
    }
  };
  const base = simulatePuzzle(lv, []);
  if (depth === 0) return { solutions: base.ok ? [[]] : [], sims: 1, exhausted: true };
  rec([], base.visited);
  return { solutions: [...found.values()], sims, exhausted: sims <= budget };
}

/** Minimal arrow count (<= maxDepth) and the solutions at that depth. */
export function minSolve(level, maxDepth, limit = 20, budget = Infinity) {
  const lv = withBoard(level);
  if (simulatePuzzle(lv, []).ok) return { min: 0, solutions: [[]] };
  for (let d = 1; d <= maxDepth; d++) {
    const r = solve(lv, d, limit, budget);
    if (r.solutions.length) return { min: d, solutions: r.solutions };
    if (!r.exhausted) return { min: null, solutions: [], aborted: true };
  }
  return { min: null, solutions: [] };
}
