import { Board } from './board.js';
import { N, E, S, W } from './constants.js';

/**
 * Battle maps are 12x9 and built point-symmetric (180° rotation) so that
 * players 0/2 and 1/3 get mirrored situations.
 *   hives:    [[x,y] for player 0, [x,y] for player 1]  -> 2 and 3 mirrored
 *   spawners: [[x,y,dir], ...]                          -> each mirrored
 *   holes:    [[x,y], ...]                              -> each mirrored
 *   h: [x,y,len]  wall on the north side of cells x..x+len-1 in row y
 *   v: [x,y,len]  wall on the west side of cells in column x, rows y..y+len-1
 */
function sym({ hives, spawners = [], holes = [], h = [], v = [] }, w = 12, ht = 9) {
  const b = new Board(w, ht);
  const mx = (x) => w - 1 - x;
  const my = (y) => ht - 1 - y;
  const wall = (x, y, d) => {
    b.addWall(x, y, d);
    b.addWall(mx(x), my(y), (d + 2) & 3);
  };
  for (const [x, y, len] of h) for (let i = 0; i < len; i++) wall(x + i, y, N);
  for (const [x, y, len] of v) for (let i = 0; i < len; i++) wall(x, y + i, W);
  const seen = new Set();
  const once = (x, y) => {
    const k = `${x},${y}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  };
  b.setHive(hives[0][0], hives[0][1], 0);
  b.setHive(hives[1][0], hives[1][1], 1);
  b.setHive(mx(hives[0][0]), my(hives[0][1]), 2);
  b.setHive(mx(hives[1][0]), my(hives[1][1]), 3);
  b.hives.sort((a, c) => a.owner - c.owner);
  for (const [x, y, d] of spawners) {
    if (once(x, y)) b.setSpawner(x, y, d);
    if (once(mx(x), my(y))) b.setSpawner(mx(x), my(y), (d + 2) & 3);
  }
  for (const [x, y] of holes) {
    if (once(x, y)) b.setHole(x, y);
    if (once(mx(x), my(y))) b.setHole(mx(x), my(y));
  }
  return b;
}

export const BATTLE_MAPS = [
  {
    id: 'wiese',
    name: 'Blumenwiese',
    desc: 'Offenes Feld mit wenigen Hecken – perfekt zum Einstieg.',
    build: () => sym({
      hives: [[2, 2], [9, 2]],
      spawners: [[0, 0, E], [5, 4, N]],
      h: [[1, 4, 2], [6, 2, 2]],
      v: [[4, 1, 2]],
    }),
  },
  {
    id: 'honigtopf',
    name: 'Honigtopf',
    desc: 'Erdlöcher lauern neben den Stöcken. Präzision zählt!',
    build: () => sym({
      hives: [[3, 1], [8, 1]],
      spawners: [[0, 4, E], [5, 3, W]],
      holes: [[5, 1], [1, 2], [9, 3]],
      h: [[2, 1, 3], [7, 1, 3], [4, 4, 1]],
      v: [[2, 1, 1], [6, 2, 2]],
    }),
  },
  {
    id: 'kleeblatt',
    name: 'Kleeblatt',
    desc: 'Vier Gärten mit schmalen Durchgängen. Die Mitte gehört allen.',
    build: () => sym({
      hives: [[1, 1], [10, 1]],
      spawners: [[5, 4, N], [0, 4, E]],
      h: [[0, 3, 2], [3, 3, 2], [7, 3, 2], [10, 3, 2]],
      v: [[4, 0, 1], [4, 2, 1], [8, 0, 1], [8, 2, 1]],
      holes: [[5, 0]],
    }),
  },
  {
    id: 'labyrinth',
    name: 'Wabenlabyrinth',
    desc: 'Verwinkelte Gänge – wer die Wege kennt, gewinnt.',
    build: () => sym({
      hives: [[0, 0], [11, 0]],
      spawners: [[5, 4, S], [3, 4, N]],
      h: [[1, 1, 3], [7, 1, 3], [2, 3, 2], [8, 3, 2], [5, 2, 2]],
      v: [[1, 1, 2], [4, 1, 2], [8, 1, 2], [11, 1, 2], [6, 3, 1]],
    }),
  },
  {
    id: 'sonnenblume',
    name: 'Sonnenblume',
    desc: 'Die Blüten sitzen in der Mitte, die Stöcke in den Ecken.',
    build: () => sym({
      hives: [[0, 0], [11, 0]],
      spawners: [[5, 3, W], [6, 3, E]],
      holes: [[3, 2], [8, 2], [0, 4]],
      h: [[4, 3, 4], [2, 1, 1], [9, 1, 1]],
      v: [[2, 0, 1], [10, 0, 1], [5, 1, 2]],
    }),
  },
  {
    id: 'kraterfeld',
    name: 'Kraterfeld',
    desc: 'Überall Löcher. Hier entscheidet jeder einzelne Pfeil.',
    build: () => sym({
      hives: [[2, 1], [9, 1]],
      spawners: [[0, 0, S], [11, 0, S]],
      holes: [[4, 1], [7, 1], [1, 3], [10, 3], [5, 3], [3, 4]],
      h: [[2, 1, 1], [9, 1, 1], [5, 2, 2]],
      v: [[6, 0, 2]],
    }),
  },
];

export function mapById(id) {
  return BATTLE_MAPS.find((m) => m.id === id) || BATTLE_MAPS[0];
}
