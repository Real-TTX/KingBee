import { Sim } from './sim.js';
import { TICK_RATE } from './constants.js';
import { makeRng } from './rng.js';

const sec = (s) => Math.round(s * TICK_RATE);

/**
 * Global events ("waves") that hit the whole board. When one is due the game
 * pauses (state 'event'), a roulette spins in the middle of the screen, the
 * effect is applied and animated, then the game resumes.
 * `dur` = how long the effect lasts after resuming (0 = instant),
 * `anim` = seconds the pause continues after the effect is applied.
 */
export const WAVES = {
  swarm:   { name: 'Schwarmzeit!', desc: 'Die Blüten sprudeln über vor Bienen.', icon: 'bee', dur: 6, anim: 0.8 },
  hornets: { name: 'Hornissen-Alarm!', desc: 'Ein ganzes Hornissennest fliegt aus.', icon: 'hornet', dur: 5, anim: 0.8 },
  fast:    { name: 'Rückenwind', desc: 'Alles fliegt doppelt so schnell.', icon: 'fast', dur: 10, anim: 0.8 },
  slow:    { name: 'Zeitlupe', desc: 'Honigregen: alles fliegt ganz langsam.', icon: 'drop', dur: 10, anim: 0.9 },
  gold:    { name: 'Goldfieber', desc: 'Goldbienen bringen 10 Punkte!', icon: 'sparkle', dur: 6, anim: 0.8 },
  wind:    { name: 'Windstoß', desc: 'Alle Pfeile werden weggeweht.', icon: 'wind', dur: 0, anim: 1.1 },
  smoke:   { name: 'Imker-Rauch', desc: 'Der Rauch vertreibt alle Hornissen.', icon: 'smoke', dur: 0, anim: 1.1 },
  swirl:   { name: 'Wirbelwind', desc: 'Alle Tiere drehen um!', icon: 'swirl', dur: 0, anim: 1.0 },
  move:    { name: 'Alle umziehen!', desc: 'Die Bienenstöcke tauschen ihre Plätze.', icon: 'shuffle', dur: 0, anim: 2.3 },
  bloom:   { name: 'Blütenwechsel', desc: 'Die Blüten schicken ihre Bienen in neue Richtungen.', icon: 'flower', dur: 12, anim: 1.3 },
  flip:    { name: 'Verkehrte Welt', desc: 'Alle Pfeile zeigen in die Gegenrichtung.', icon: 'flip', dur: 0, anim: 1.1 },
  arrows:  { name: 'Pfeilregen', desc: '15 Sekunden lang 5 Pfeile für alle.', icon: 'arrows', dur: 15, anim: 0.8 },
};
const WAVE_POOL = ['swarm', 'swarm', 'hornets', 'fast', 'slow', 'gold', 'wind', 'smoke', 'swirl', 'move', 'move', 'bloom', 'flip', 'arrows'];

/** Seconds between two events for each frequency setting (null = no events). */
export const EVENT_FREQ = {
  off: null,
  rare: [45, 60],
  normal: [24, 34],
  often: [14, 20],
  chaos: [7, 11],
};

/** Timing of the event pause in seconds: roulette spin, then reveal. */
export const EVENT_SPIN = 2.4;
export const EVENT_REVEAL = 0.9;

/** Personal bonuses when a pollen bee (pink) enters a hive. */
export const BONUSES = {
  nectar: { name: 'Nektar-Bonus', desc: '+15 Bienen', icon: 'flower' },
  steal:  { name: 'Raubzug', desc: 'Stiehlt dem Führenden 20 %', icon: 'mask' },
  shield: { name: 'Wachsschild', desc: '15 s Schutz vor Hornissen', icon: 'shield' },
  magnet: { name: 'Duftspur', desc: 'Alle Blüten zielen auf deinen Stock', icon: 'magnet' },
};
const BONUS_POOL = Object.keys(BONUSES);

/**
 * Battle mode: spawners emit bees (and sometimes hornets), waves hit the
 * board in intervals, and the first hive to reach `target` hatches a queen.
 * When the timer runs out, the fullest hive wins.
 *
 * Players: 0 = human, 1..aiCount = AI, rest = wild hives (nobody steers).
 */
export class Battle {
  constructor(board, cfg) {
    this.cfg = {
      aiCount: 3,
      difficulty: 'normal',
      timeLimit: 180,
      target: 150,
      seed: (Math.random() * 1e9) | 0,
      events: 'normal',
      ...cfg,
    };
    this.board = board;
    this.rng = makeRng(this.cfg.seed);
    this.sim = new Sim(board, { numPlayers: 4, maxArrows: 3, seed: this.cfg.seed, eatCooldown: sec(1) });
    // Seat types per hive: 'human' | 'ai' | 'wild' (nobody steers, still collects bees).
    this.slots = this.cfg.slots
      || [0, 1, 2, 3].map((p) => (p === 0 ? 'human' : p <= this.cfg.aiCount ? 'ai' : 'wild'));
    this.active = this.slots.map((s) => s !== 'wild');
    this.solo = this.active.filter(Boolean).length === 1;
    this.ticksLeft = sec(this.cfg.timeLimit);
    this.state = 'countdown';
    this.countdown = sec(3);
    this.winner = -1;
    this.spawnTimers = board.spawners.map((_, i) => sec(0.4 + i * 0.25));
    this.hornetTimer = sec(this.solo ? 5 : 8);
    this.freq = EVENT_FREQ[this.cfg.events] === undefined ? EVENT_FREQ.normal : EVENT_FREQ[this.cfg.events];
    this.waveTimer = this.freq ? sec(Math.min(22, this.freq[0] + 2)) : Infinity;
    this.event = null;       // running event pause {id, t, applyAt, endAt}
    this.wave = null;        // effect with a duration {id, until}
    this.hiveVersion = 0;    // bumped whenever hives change places
    this.hornetQueue = 0;
    this.magnet = null;      // {owner, until, dirs}
    this.feed = [];          // UI notifications {kind, ...}
    this.maxBees = 140;
  }

  get hornetCap() {
    return this.solo ? 3 : this.cfg.difficulty === 'hard' ? 3 : 2;
  }

  waveActive(id) {
    return this.wave && this.wave.id === id;
  }

  /** One fixed tick; returns sim events from this tick. */
  tick() {
    if (this.state === 'countdown') {
      if (--this.countdown <= 0) this.state = 'running';
      return [];
    }
    if (this.state === 'event') return this.tickEvent();
    if (this.state !== 'running') return [];
    const sim = this.sim;
    const t = sim.tickCount;

    this.updateWaves(t);
    if (this.state === 'event') return [];
    this.updateSpawns(t);
    // hornets get bored and fly off after a while
    for (const e of sim.entities) {
      if (e.kind === 'hornet' && e.alive && t >= e.leaveAt) {
        sim.kill(e);
        sim.emit({ type: 'hornetLeave', wx: e.wx, wy: e.wy, id: e.id });
      }
    }
    sim.tick();

    const evs = sim.events.splice(0);
    for (const ev of evs) {
      if (ev.type === 'hiveIn' && ev.variant === 'pollen' && this.active[ev.owner]) {
        this.applyBonus(ev.owner);
      }
    }

    // win conditions
    const scores = sim.players.map((p) => p.score);
    for (let p = 0; p < 4; p++) {
      if (this.active[p] && scores[p] >= this.cfg.target) return this.finish(p, evs);
    }
    if (--this.ticksLeft <= 0) {
      if (this.solo) return this.finish(-1, evs);
      let best = -1;
      for (let p = 0; p < 4; p++) if (this.active[p] && (best < 0 || scores[p] > scores[best])) best = p;
      return this.finish(best, evs);
    }
    return evs;
  }

  finish(winner, evs) {
    this.state = 'over';
    this.winner = winner;
    return evs;
  }

  updateSpawns(t) {
    const sim = this.sim;
    const spawners = this.board.spawners;
    const swarm = this.waveActive('swarm');
    const baseInterval = sec(0.32) * spawners.length;
    const interval = swarm ? sec(0.12) : baseInterval;
    for (let i = 0; i < spawners.length; i++) {
      if (--this.spawnTimers[i] > 0) continue;
      this.spawnTimers[i] = interval + this.rng.int(sec(0.15));
      if (sim.beeCount >= this.maxBees && !swarm) continue;
      const s = spawners[i];
      const dir = this.magnet && this.magnet.until > t ? this.magnet.dirs[i] : s.dir;
      let variant = 'normal';
      const r = this.rng();
      if (this.waveActive('gold')) variant = r < 0.35 ? 'gold' : 'normal';
      else if (r < 0.008) variant = 'gold';
      else if (r < 0.018 && !this.solo) variant = 'pollen';
      sim.spawn('bee', s.x, s.y, dir, variant);
    }

    // hornets
    if (this.hornetQueue > 0) {
      if (--this.hornetTimer <= 0) {
        this.spawnHornet();
        this.hornetQueue--;
        this.hornetTimer = sec(1);
      }
    } else if (!swarm && --this.hornetTimer <= 0) {
      if (sim.hornetCount < this.hornetCap) this.spawnHornet();
      this.hornetTimer = sec(this.rng.range(7, 12));
    }
  }

  spawnHornet() {
    const s = this.rng.pick(this.board.spawners);
    const h = this.sim.spawn('hornet', s.x, s.y, s.dir);
    h.leaveAt = this.sim.tickCount + sec(this.rng.range(18, 28));
  }

  updateWaves(t) {
    if (this.wave && t >= this.wave.until) this.endWave();
    if (this.freq && !this.wave && --this.waveTimer <= 0) {
      this.waveTimer = sec(this.rng.range(this.freq[0], this.freq[1]));
      const id = this.rng.pick(WAVE_POOL);
      const applyAt = sec(EVENT_SPIN + EVENT_REVEAL * 0.6);
      this.event = { id, t: 0, applyAt, endAt: applyAt + sec(WAVES[id].anim) };
      this.state = 'event';
      this.feed.push({ kind: 'eventStart', id, options: Object.keys(WAVES) });
    }
  }

  /** One tick of the event pause: nothing moves, the effect lands mid-way. */
  tickEvent() {
    const ev = this.event;
    ev.t++;
    if (ev.t === 1) {
      // freeze render interpolation while paused
      for (const e of this.sim.entities) { e.pwx = e.wx; e.pwy = e.wy; }
    }
    if (ev.t === ev.applyAt) this.startWave(ev.id);
    if (ev.t >= ev.endAt) {
      this.event = null;
      this.state = 'running';
      this.feed.push({ kind: 'eventEnd', id: ev.id });
    }
    return this.sim.events.splice(0);
  }

  endWave() {
    const sim = this.sim;
    const id = this.wave.id;
    if (id === 'fast' || id === 'slow') sim.setSpeedMode('normal');
    if (id === 'arrows') {
      sim.maxArrows = 3;
      for (const pl of sim.players) {
        while (pl.arrowCells.length > sim.maxArrows) sim.removeArrowAt(pl.arrowCells[0], 'expired');
      }
    }
    this.wave = null;
    const info = { kind: 'waveEnd', id };
    if (id === 'bloom') info.turns = this.restoreFlowers();
    this.feed.push(info);
  }

  startWave(id) {
    const sim = this.sim;
    const w = WAVES[id];
    const info = { kind: 'wave', id };
    if (w.dur > 0) this.wave = { id, until: sim.tickCount + sec(w.dur) };
    switch (id) {
      case 'hornets': this.hornetQueue = 4; this.hornetTimer = 1; break;
      case 'fast': sim.setSpeedMode('fast'); break;
      case 'slow': sim.setSpeedMode('slow'); break;
      case 'wind': sim.clearArrows(); break;
      case 'smoke':
        for (const e of sim.entities) {
          if (e.kind === 'hornet' && e.alive) {
            sim.kill(e);
            sim.emit({ type: 'smoked', wx: e.wx, wy: e.wy, id: e.id });
          }
        }
        break;
      case 'swirl': sim.reverseAll(); break;
      case 'move': info.moves = this.shuffleHives(); break;
      case 'bloom': info.turns = this.turnFlowers(); break;
      case 'flip':
        for (const a of sim.arrows) if (a) a.dir = (a.dir + 2) & 3;
        break;
      case 'arrows': sim.maxArrows = 5; break;
      default: break;
    }
    this.feed.push(info);
  }

  /** "Everybody move": every hive lands on another hive's spot. */
  shuffleHives() {
    const board = this.board;
    const hives = board.hives;
    const n = hives.length;
    const perm = [...Array(n).keys()];
    for (let attempt = 0; attempt < 30; attempt++) {
      for (let i = n - 1; i > 0; i--) {
        const j = this.rng.int(i + 1);
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }
      if (perm.every((p, i) => p !== i)) break;
    }
    const owners = hives.map((h) => h.owner);
    const moves = [];
    for (let i = 0; i < n; i++) {
      const to = hives[perm[i]];
      moves.push({ owner: owners[i], fx: hives[i].x, fy: hives[i].y, tx: to.x, ty: to.y });
      board.owner[board.idx(to.x, to.y)] = owners[i];
    }
    for (const h of hives) h.owner = board.owner[board.idx(h.x, h.y)];
    this.hiveVersion++;
    if (this.magnet) this.magnet.dirs = this.magnetDirs(this.magnet.owner);
    return moves;
  }

  /** Every flower turns to another open direction (until the wave ends). */
  turnFlowers() {
    const b = this.board;
    this.flowerDirs = b.spawners.map((s) => s.dir);
    return b.spawners.map((s) => {
      const from = s.dir;
      const open = [1, 2, 3].map((k) => (from + k) & 3).filter((d) => !b.hasWall(s.x, s.y, d));
      if (open.length) s.dir = open[this.rng.int(open.length)];
      return { x: s.x, y: s.y, from, to: s.dir };
    });
  }

  restoreFlowers() {
    const turns = this.board.spawners.map((s, i) => {
      const from = s.dir;
      s.dir = this.flowerDirs[i];
      return { x: s.x, y: s.y, from, to: s.dir };
    });
    this.flowerDirs = null;
    return turns;
  }

  magnetDirs(owner) {
    const hive = this.board.hives.find((h) => h.owner === owner);
    return this.board.spawners.map((s) => {
      const dx = hive.x - s.x, dy = hive.y - s.y;
      if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
      return dy > 0 ? 2 : 0;
    });
  }

  applyBonus(owner) {
    const sim = this.sim;
    const id = this.rng.pick(BONUS_POOL);
    const pl = sim.players[owner];
    let amount = 0;
    switch (id) {
      case 'nectar':
        amount = 15;
        pl.score += amount;
        break;
      case 'steal': {
        let leader = -1;
        for (let p = 0; p < 4; p++) {
          if (p !== owner && this.active[p] && (leader < 0 || sim.players[p].score > sim.players[leader].score)) leader = p;
        }
        if (leader >= 0) {
          amount = Math.ceil(sim.players[leader].score * 0.2);
          sim.players[leader].score -= amount;
          pl.score += amount;
        }
        this.feed.push({ kind: 'bonus', id, owner, amount, victim: leader });
        return;
      }
      case 'shield':
        pl.shieldUntil = sim.tickCount + sec(15);
        break;
      case 'magnet': {
        this.magnet = { owner, until: sim.tickCount + sec(8), dirs: this.magnetDirs(owner) };
        break;
      }
      default: break;
    }
    this.feed.push({ kind: 'bonus', id, owner, amount });
  }

  secondsLeft() {
    return Math.max(0, Math.ceil(this.ticksLeft / TICK_RATE));
  }
}
