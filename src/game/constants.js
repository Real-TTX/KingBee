// Core constants shared by simulation, AI and rendering.

/** Sub-units per tile. All movement speeds must divide this exactly. */
export const UNIT = 120;
/** Fixed simulation rate (ticks per second). */
export const TICK_RATE = 60;

// Directions: 0 = North (-y), 1 = East (+x), 2 = South (+y), 3 = West (-x)
export const N = 0, E = 1, S = 2, W = 3;
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const turnRight = (d) => (d + 1) & 3;
export const turnLeft = (d) => (d + 3) & 3;
export const turnBack = (d) => (d + 2) & 3;

export const CELL = { EMPTY: 0, HOLE: 1, HIVE: 2, SPAWN: 3 };

/** Units per tick for each creature and speed mode (must divide UNIT). */
export const SPEEDS = {
  bee: { slow: 3, normal: 6, fast: 10 },
  hornet: { slow: 2, normal: 4, fast: 6 },
};

export const BEE_VALUE = { normal: 1, gold: 10, pollen: 1 };

export const PLAYER_COLORS = ['#2f8cff', '#ff4d5e', '#38c95a', '#b25cff'];
export const WILD_COLOR = '#9a9a9a';
// Names of the computer players per hive (humans use their own name).
export const PLAYER_NAMES = ['Summsi', 'Hummelinde', 'Brummbert', 'Nektarina'];
