import { Sim } from './sim.js';
import { TICK_RATE } from './constants.js';
import { makeRng } from './rng.js';

const sec = (s) => Math.round(s * TICK_RATE);

/**
 * Global "waves" that hit the whole board. Announced with a roulette, then
 * applied. `dur` is how long the effect lasts (0 = instant).
 */
export const WAVES = {
  swarm:   { name: 'Schwarmzeit!', desc: 'Die Blüten sprudeln über vor Bienen.', icon: 'bee', dur: 6 },
  hornets: { name: 'Hornissen-Alarm!', desc: 'Ein ganzes Hornissennest fliegt aus.', icon: 'hornet', dur: 5 },
  fast:    { name: 'Rückenwind', desc: 'Alles fliegt schneller.', icon: 'fast', dur: 10 },
  slow:    { name: 'Honigregen', desc: 'Klebrige Flügel – alles wird langsam.', icon: 'drop', dur: 10 },
  gold:    { name: 'Goldfieber', desc: 'Goldbienen bringen 10 Punkte!', icon: 'sparkle', dur: 5 },
  wind:    { name: 'Windstoß', desc: 'Alle Pfeile werden weggeweht.', icon: 'wind', dur: 0 },
  smoke:   { name: 'Imker-Rauch', desc: 'Der Rauch vertreibt alle Hornissen.', icon: 'smoke', dur: 0 },
  swirl:   { name: 'Wirbelwind', desc: 'Alle drehen um!', icon: 'swirl', dur: 0 },
};
const WAVE_POOL = ['swarm', 'swarm', 'hornets', 'fast', 'slow', 'gold', 'wind', 'smoke', 'swirl'];

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
    this.waveTimer = sec(22);
    this.pendingWave = null; // {id, at}
    this.wave = null;        // {id, until}
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
    if (this.state !== 'running') return [];
    const sim = this.sim;
    const t = sim.tickCount;

    this.updateWaves(t);
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
    const sim = this.sim;
    if (this.wave && t >= this.wave.until) {
      if (this.wave.id === 'fast' || this.wave.id === 'slow') sim.setSpeedMode('normal');
      this.wave = null;
      this.feed.push({ kind: 'waveEnd' });
    }
    if (this.pendingWave && t >= this.pendingWave.at) {
      const id = this.pendingWave.id;
      this.pendingWave = null;
      this.startWave(id);
    }
    if (!this.pendingWave && !this.wave && --this.waveTimer <= 0) {
      this.waveTimer = sec(this.rng.range(22, 32));
      const id = this.rng.pick(WAVE_POOL);
      this.pendingWave = { id, at: t + sec(2.2) };
      this.feed.push({ kind: 'roulette', id, options: Object.keys(WAVES) });
    }
  }

  startWave(id) {
    const sim = this.sim;
    const w = WAVES[id];
    this.feed.push({ kind: 'wave', id });
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
      default: break;
    }
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
        const hive = this.board.hives.find((h) => h.owner === owner);
        const dirs = this.board.spawners.map((s) => {
          const dx = hive.x - s.x, dy = hive.y - s.y;
          if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
          return dy > 0 ? 2 : 0;
        });
        this.magnet = { owner, until: sim.tickCount + sec(8), dirs };
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
