// Tiny synthesized sound engine (WebAudio, no assets).

class Audio {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('kingbee.muted') === '1';
    this.last = {};
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.setupBuzz();
    this.setupMusic();
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('kingbee.muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  throttle(key, ms) {
    const now = performance.now();
    if (this.last[key] && now - this.last[key] < ms) return false;
    this.last[key] = now;
    return true;
  }

  tone({ f = 440, f2 = null, dur = 0.12, type = 'sine', vol = 0.3, delay = 0, attack = 0.005 }) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.15, vol = 0.3, freq = 1200, q = 1, delay = 0, type = 'bandpass' }) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  setupBuzz() {
    const ctx = this.ctx;
    this.buzzGain = ctx.createGain();
    this.buzzGain.gain.value = 0;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 180;
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = 187;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 9;
    lfo.connect(lfoGain).connect(o.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    o.connect(filter);
    o2.connect(filter);
    filter.connect(this.buzzGain).connect(this.master);
    o.start(); o2.start(); lfo.start();
  }

  /** Ambient buzz volume follows how many bees are on the board. */
  setSwarm(n) {
    if (!this.ctx) return;
    const v = Math.min(0.06, n * 0.0009);
    this.buzzGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3);
  }

  // A gentle pentatonic loop. Not a melody from anywhere – just random walks.
  setupMusic() {
    this.musicOn = false;
    this.musicStep = 0;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    let note = 3;
    const tick = () => {
      if (this.musicOn && this.ctx && !this.muted) {
        const step = this.musicStep++;
        const base = 392; // G4
        if (step % 2 === 0) {
          note = Math.max(0, Math.min(scale.length - 1, note + [-2, -1, 1, 1, 2, 0][Math.floor(Math.random() * 6)]));
          const f = base * 2 ** (scale[note] / 12);
          this.tone({ f, dur: 0.28, type: 'triangle', vol: 0.045 });
        }
        if (step % 8 === 0) {
          const roots = [0, -5, -3, -7];
          const r = roots[Math.floor(step / 8) % 4];
          this.tone({ f: (base / 4) * 2 ** (r / 12), dur: 0.9, type: 'sine', vol: 0.07 });
        }
        if (step % 4 === 2) this.noise({ dur: 0.04, vol: 0.03, freq: 6000, type: 'highpass' });
      }
      setTimeout(tick, 170);
    };
    tick();
  }

  music(on) {
    this.musicOn = on;
  }

  // ---- effects
  place() { this.tone({ f: 620, f2: 940, dur: 0.08, type: 'triangle', vol: 0.25 }); }
  deny() { this.tone({ f: 220, f2: 160, dur: 0.12, type: 'square', vol: 0.12 }); }
  remove() { this.tone({ f: 700, f2: 380, dur: 0.08, type: 'triangle', vol: 0.18 }); }
  beeIn(variant) {
    if (variant === 'gold') {
      [0, 4, 7, 12].forEach((s, i) => this.tone({ f: 880 * 2 ** (s / 12), dur: 0.15, type: 'triangle', vol: 0.2, delay: i * 0.05 }));
      return;
    }
    if (!this.throttle('beeIn', 45)) return;
    this.tone({ f: 900 + Math.random() * 500, dur: 0.06, type: 'sine', vol: 0.12 });
  }
  hornetIn() {
    this.tone({ f: 300, f2: 70, dur: 0.6, type: 'sawtooth', vol: 0.28 });
    this.noise({ dur: 0.4, vol: 0.4, freq: 400 });
  }
  eaten() {
    if (!this.throttle('eat', 60)) return;
    this.noise({ dur: 0.08, vol: 0.35, freq: 900, q: 2 });
    this.tone({ f: 180, f2: 90, dur: 0.1, type: 'square', vol: 0.08 });
  }
  fall() {
    if (!this.throttle('fall', 80)) return;
    this.tone({ f: 800, f2: 120, dur: 0.35, type: 'sine', vol: 0.12 });
  }
  hornetSpawn() { this.tone({ f: 110, f2: 140, dur: 0.5, type: 'sawtooth', vol: 0.12 }); }
  tick() { this.tone({ f: 1500, dur: 0.03, type: 'square', vol: 0.05 }); }
  wave() {
    [0, 4, 7].forEach((s, i) => this.tone({ f: 523 * 2 ** (s / 12), dur: 0.18, type: 'square', vol: 0.09, delay: i * 0.08 }));
  }
  bonus() {
    [0, 7, 12, 16].forEach((s, i) => this.tone({ f: 660 * 2 ** (s / 12), dur: 0.14, type: 'triangle', vol: 0.18, delay: i * 0.06 }));
  }
  fail() {
    [0, -3, -7].forEach((s, i) => this.tone({ f: 330 * 2 ** (s / 12), dur: 0.3, type: 'triangle', vol: 0.2, delay: i * 0.18 }));
  }
  hatchRumble() {
    this.noise({ dur: 1.6, vol: 0.25, freq: 120, type: 'lowpass' });
  }
  fanfare() {
    const seq = [0, 4, 7, 12, 7, 12, 16, 19];
    seq.forEach((s, i) => this.tone({ f: 392 * 2 ** (s / 12), dur: i === seq.length - 1 ? 0.9 : 0.16, type: 'triangle', vol: 0.22, delay: i * 0.13 }));
    seq.forEach((s, i) => this.tone({ f: 196 * 2 ** (s / 12), dur: 0.16, type: 'square', vol: 0.05, delay: i * 0.13 }));
  }
  /** Big alarm when a hornet raids the own hive. */
  hurt() {
    this.tone({ f: 220, f2: 55, dur: 0.9, type: 'sawtooth', vol: 0.3 });
    this.tone({ f: 233, f2: 58, dur: 0.9, type: 'square', vol: 0.12 });
    [0, 0.22].forEach((d) => this.tone({ f: 880, f2: 660, dur: 0.16, type: 'square', vol: 0.12, delay: d }));
    this.noise({ dur: 0.6, vol: 0.45, freq: 300 });
  }
  /** Event pause starts: drum roll. */
  eventStart() {
    this.noise({ dur: 0.25, vol: 0.3, freq: 180, type: 'lowpass' });
    [0, 5, 9].forEach((s, i) => this.tone({ f: 392 * 2 ** (s / 12), dur: 0.1, type: 'square', vol: 0.08, delay: i * 0.06 }));
  }
  /** Event revealed: fanfare-like stinger. */
  reveal() {
    [0, 4, 7, 12].forEach((s, i) => this.tone({ f: 523 * 2 ** (s / 12), dur: i === 3 ? 0.35 : 0.12, type: 'square', vol: 0.1, delay: i * 0.07 }));
    this.noise({ dur: 0.3, vol: 0.2, freq: 3000, q: 0.7, delay: 0.2 });
  }
  whoosh() {
    this.noise({ dur: 0.7, vol: 0.35, freq: 900, q: 0.6 });
    this.tone({ f: 200, f2: 600, dur: 0.6, type: 'sine', vol: 0.08 });
  }
  countdown(final) { this.tone({ f: final ? 1046 : 523, dur: final ? 0.35 : 0.15, type: 'square', vol: 0.12 }); }
}

export const audio = new Audio();
