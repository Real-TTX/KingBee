import './style.css';
import { View } from './render/view.js';
import { audio } from './audio.js';
import { Battle, WAVES, BONUSES, EVENT_SPIN } from './game/battle.js';
import { AIPlayer } from './game/ai.js';
import { PuzzleRun } from './game/puzzle.js';
import { PUZZLES } from './game/levels.js';
import { BATTLE_MAPS, mapById } from './game/maps.js';
import { PLAYER_COLORS, PLAYER_NAMES, WILD_COLOR, TICK_RATE } from './game/constants.js';
import {
  applyInput, stateHash, TICKS_PER_FRAME, HASH_EVERY_FRAMES, INPUT_PLACE, INPUT_REMOVE,
} from './game/lockstep.js';
import { drawPreview } from './ui/preview.js';
import { icon, hydrateIcons } from './ui/icons.js';
import { logoSVG, beeMarkSVG } from './ui/logo.js';
import { Net, netError } from './net.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const DT = 1 / TICK_RATE;

const view = new View($('#stage'));

// ============================================================ persistence

const settings = {
  map: 'wiese', aiCount: 3, difficulty: 'normal', timeLimit: 180, target: 150, events: 'normal',
  ...JSON.parse(localStorage.getItem('kingbee.settings') || '{}'),
};
const saveSettings = () => localStorage.setItem('kingbee.settings', JSON.stringify(settings));
const solved = new Set(JSON.parse(localStorage.getItem('kingbee.solved') || '[]'));
const saveSolved = () => localStorage.setItem('kingbee.solved', JSON.stringify([...solved]));
let playerName = localStorage.getItem('kingbee.name') || '';
const touchDevice = window.matchMedia('(pointer: coarse)').matches;

// ============================================================ decoration

$('#favicon').href = `data:image/svg+xml,${encodeURIComponent(beeMarkSVG())}`;
$('.menu-logo').innerHTML = logoSVG();
$('#menu .drip').innerHTML = dripSVG();
$('#menu .pollen').innerHTML = Array.from({ length: 28 }, () => {
  const s = 4 + Math.random() * 9;
  return `<i style="left:${Math.random() * 100}%;--s:${s}px;--d:${9 + Math.random() * 12}s;--delay:${-Math.random() * 20}s;--dx:${(Math.random() - 0.5) * 160}px"></i>`;
}).join('');
hydrateIcons();

/** Honey dripping from the top edge of the main menu. */
function dripSVG() {
  const W = 1600;
  let d = `M0 0 H${W} V30`;
  let x = W;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  while (x > 0) {
    const gap = 40 + rnd() * 110;
    const w = 12 + rnd() * 16;
    const len = 18 + rnd() * 62;
    const cx = x - gap;
    if (cx - w < 0) break;
    d += ` L${cx + w} 30 C${cx + w * 0.35} 32 ${cx + w * 0.95} ${30 + len} ${cx} ${30 + len}`;
    d += ` C${cx - w * 0.95} ${30 + len} ${cx - w * 0.35} 32 ${cx - w} 30`;
    x = cx - w;
  }
  d += ' L0 30 Z';
  return `<svg viewBox="0 0 ${W} 110" preserveAspectRatio="xMidYMin slice">
    <defs><linearGradient id="dripg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f29200"/><stop offset=".5" stop-color="#ffb800"/><stop offset="1" stop-color="#ffd54a"/>
    </linearGradient></defs>
    <path d="${d}" fill="url(#dripg)" stroke="#8a4a00" stroke-width="3"/>
    <path d="M0 12 H${W}" stroke="#fff3b0" stroke-width="4" stroke-opacity=".55"/>
  </svg>`;
}

// ================================================================ helpers

function show(id) {
  for (const s of $$('.screen')) s.classList.toggle('hidden', s.id !== id);
}

const visible = (id) => !$(`#${id}`).classList.contains('hidden');

function toast(html, color, iconName = 'bee') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = icon(iconName) + `<span>${html}</span>`;
  if (color) el.style.setProperty('--c', color);
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3400);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function eventAudio(evs) {
  for (const ev of evs) {
    switch (ev.type) {
      case 'hiveIn': audio.beeIn(ev.variant); break;
      case 'hornetIn': audio.hornetIn(); break;
      case 'eaten': audio.eaten(); break;
      case 'fall': if (ev.kind === 'bee') audio.fall(); break;
      case 'spawn': if (ev.kind === 'hornet') audio.hornetSpawn(); break;
      default: break;
    }
  }
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function scoreCardHTML(name, score, color, frac, extra = '') {
  return `<div class="score-card ${extra}" style="--c:${color}">
    <div class="top"><span class="name">${esc(name)}</span><span class="val">${score}</span></div>
    <div class="bar"><i style="width:${Math.min(100, frac * 100)}%"></i></div></div>`;
}

// ---- option widgets shared by local setup and online room

const OPTION_DEFS = {
  aiCount: { label: 'Gegner', items: [[0, 'Solo'], [1, '1'], [2, '2'], [3, '3']] },
  difficulty: { label: 'KI-Stärke', items: [['easy', 'Leicht'], ['normal', 'Normal'], ['hard', 'Schwer']] },
  timeLimit: { label: 'Zeit', items: [[120, '2 min'], [180, '3 min'], [300, '5 min']] },
  target: { label: 'Stock voll bei', items: [[100, '100'], [150, '150'], [250, '250']] },
  events: { label: 'Ereignisse', items: [['off', 'Aus'], ['rare', 'Selten'], ['normal', 'Normal'], ['often', 'Oft'], ['chaos', 'Chaos']] },
};

function renderOptions(el, keys, values, onPick, locked = false) {
  el.innerHTML = keys.map((k) => {
    const def = OPTION_DEFS[k];
    const btns = def.items.map(([v, t]) => `<button data-k="${k}" data-v="${v}" class="${String(values[k]) === String(v) ? 'on' : ''}" ${locked ? 'disabled' : ''}>${t}</button>`).join('');
    return `<div class="opt"><label>${def.label}</label><div class="seg ${locked ? 'locked' : ''}">${btns}</div></div>`;
  }).join('');
  el.onclick = (e) => {
    const b = e.target.closest('button[data-k]');
    if (!b || locked) return;
    const raw = b.dataset.v;
    onPick(b.dataset.k, Number.isNaN(Number(raw)) ? raw : Number(raw));
  };
}

const previewCache = new Map();
function mapPreview(m) {
  if (!previewCache.has(m.id)) {
    const cv = document.createElement('canvas');
    drawPreview(cv, m.build());
    previewCache.set(m.id, cv);
  }
  const src = previewCache.get(m.id);
  const cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  cv.getContext('2d').drawImage(src, 0, 0);
  return cv;
}

function renderMapGrid(el, selected, onPick, locked = false) {
  el.innerHTML = '';
  for (const m of BATTLE_MAPS) {
    const card = document.createElement('button');
    card.className = `map-card ${m.id === selected ? 'sel' : ''}`;
    card.disabled = locked;
    card.appendChild(mapPreview(m));
    const name = document.createElement('div');
    name.className = 'mname';
    name.textContent = m.name;
    card.appendChild(name);
    card.title = m.desc;
    card.addEventListener('click', () => { if (!locked) onPick(m.id); });
    el.appendChild(card);
  }
}

// ============================================================ controllers

/**
 * Battle mode. Works for local games, the AI demo behind the menu and online
 * lockstep games (o.net set): then inputs go to the server and ticks are
 * driven by the frames the server broadcasts.
 */
class BattleController {
  constructor(o) {
    this.o = o;
    this.demo = !!o.demo;
    this.net = o.net || null;
    this.me = o.me ?? 0;
    this.interactive = !this.demo && this.me >= 0;
    this.board = mapById(o.map).build();
    this.battle = new Battle(this.board, {
      slots: o.slots, difficulty: o.difficulty, timeLimit: o.timeLimit, target: o.target, seed: o.seed,
      events: o.events || 'normal',
    });
    this.sim = this.battle.sim;
    if (this.demo) this.battle.state = 'running';
    this.slots = this.battle.slots;
    this.ais = this.slots.map((s, p) => (s === 'ai' ? new AIPlayer(this.battle, p, o.difficulty) : null)).filter(Boolean);
    this.colors = this.slots.map((s, p) => (s === 'wild' ? WILD_COLOR : PLAYER_COLORS[p]));
    this.names = this.slots.map((s, p) => {
      if (s === 'wild') return 'Wildbienen';
      if (s === 'ai') return PLAYER_NAMES[p];
      return o.names?.[p] || (p === this.me ? 'Du' : `Spieler ${p + 1}`);
    });
    this.color = this.colors[Math.max(0, this.me)];
    view.setBoard(this.board, { colors: this.colors, labels: !this.demo });
    view.resetCamera();
    this.ended = false;
    this.lastCountdown = -1;
    this.spin = null;
    this.revealed = false;
    this.hurtTimer = 0;
    this.shields = [false, false, false, false];
    // lockstep state
    this.frames = [];
    this.ticksInFrame = 0;
    this.acc = 0;
    this.alpha = 0;
    this.expectFrame = 0;
    this.lastFrameAt = performance.now();
    this.offs = [];
    if (this.net) {
      this.offs.push(this.net.on('frame', (f, inputs) => {
        this.frames.push({ f, inputs });
        this.lastFrameAt = performance.now();
      }));
      this.offs.push(this.net.on('playerLeft', (seat, name) => {
        toast(`<b>${esc(name)}</b> hat das Spiel verlassen.`, this.colors[seat], 'leave');
      }));
      this.offs.push(this.net.on('desync', () => {
        toast('Synchronisationsfehler erkannt.', '#c62828', 'x');
      }));
    }
    if (!this.demo) this.setupHud();
  }

  setupHud() {
    $('#hud').classList.remove('hidden');
    $('#scores').classList.remove('hidden');
    $('#timer').classList.remove('hidden');
    $('#puzzle-top').classList.add('hidden');
    $('#puzzle-bar').classList.add('hidden');
    $('#puzzle-fail').classList.add('hidden');
    $('#wave').classList.add('hidden');
    $('#event').classList.add('hidden');
    $('#hurt').classList.add('hidden');
    const hint = $('#controls-hint');
    hint.classList.toggle('hidden', !this.interactive);
    hint.classList.toggle('touch', touchDevice);
    hint.innerHTML = touchDevice
      ? 'Über ein Feld <b>wischen</b> legt einen Pfeil &middot; <b>Tippen</b> dreht ihn'
      : 'Feld anvisieren + <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> oder Pfeiltasten &middot; Ziehen &middot; Rechtsklick entfernt';
    const card = (p) => {
      const wild = this.slots[p] === 'wild';
      const kind = this.slots[p] === 'ai' ? icon('robot') : this.slots[p] === 'human' ? icon('bee') : '';
      return `<div class="score-card ${wild ? 'wild' : ''} ${p === this.me ? 'me' : ''}" style="--c:${this.colors[p]}">
        <div class="top"><span class="name">${kind}${esc(this.names[p])}<span class="flag">${icon('shield')}</span></span><span class="val">0</span></div>
        <div class="bar"><i></i></div></div>`;
    };
    const timer = $('#timer');
    $('#scores').innerHTML = card(0) + card(1) + card(2) + card(3);
    $('#scores').insertBefore(timer, $('#scores').children[2]);
    this.cards = $$('#scores .score-card');
    const badge = $('#net-badge');
    badge.classList.toggle('hidden', !this.net);
    if (this.net) badge.querySelector('.txt').textContent = `Online · Raum ${this.o.roomCode || ''}`;
    audio.music(true);
  }

  canPlace(x, y) {
    return this.interactive && this.battle.state === 'running' && this.sim.canPlaceArrow(this.me, x, y);
  }

  /** True while an event pauses the game (no input, no hover). */
  get frozen() {
    return this.battle.state === 'event';
  }

  place(x, y, dir) {
    if (!this.canPlace(x, y)) { audio.deny(); return; }
    if (this.net) {
      this.net.sendInput([INPUT_PLACE, x, y, dir]);
      audio.place();
    } else if (this.sim.placeArrow(this.me, x, y, dir)) {
      audio.place();
    }
  }

  remove(x, y) {
    if (!this.interactive) return;
    const a = this.sim.arrows[this.board.idx(x, y)];
    if (!a || a.owner !== this.me) return;
    if (this.net) this.net.sendInput([INPUT_REMOVE, x, y, 0]);
    else this.sim.removeArrow(this.me, x, y);
    audio.remove();
  }

  tap(x, y) {
    const a = this.sim.arrows[this.board.idx(x, y)];
    if (a && a.owner === this.me) this.place(x, y, (a.dir + 1) & 3);
  }

  /** Local games: one fixed tick. */
  tick() {
    return this.step();
  }

  /** Online games: run as many ticks as the received frames allow. */
  pump(dt) {
    const evs = [];
    if (this.battle.state === 'over') { this.alpha = 0; return evs; }
    this.acc += dt;
    let want = Math.floor(this.acc / DT);
    this.acc -= want * DT;
    const avail = this.ticksInFrame + this.frames.length * TICKS_PER_FRAME;
    // fell behind (e.g. tab was in the background) -> catch up quickly
    if (avail > TICKS_PER_FRAME * 4) want = Math.max(want, avail - TICKS_PER_FRAME * 2);
    if (want > avail) { want = avail; this.acc = 0; }
    want = Math.min(want, 900);
    for (let i = 0; i < want; i++) {
      if (this.ticksInFrame === 0) {
        const fr = this.frames.shift();
        if (fr.f !== this.expectFrame) toast('Netzwerk-Frame übersprungen.', '#c62828', 'x');
        this.expectFrame = fr.f + 1;
        if (fr.f % HASH_EVERY_FRAMES === 0) this.net.reportHash(fr.f, stateHash(this.battle));
        for (const inp of fr.inputs) applyInput(this.battle, inp);
        this.ticksInFrame = TICKS_PER_FRAME;
      }
      for (const e of this.step()) evs.push(e);
      this.ticksInFrame--;
      if (this.battle.state === 'over') break;
    }
    this.alpha = Math.min(1, this.acc / DT);
    $('#net-badge').classList.toggle('lag', performance.now() - this.lastFrameAt > 400);
    return evs;
  }

  step() {
    const b = this.battle;
    if (b.state === 'running') for (const ai of this.ais) ai.update();
    const evs = b.tick();
    if (this.demo) {
      this.handleFeed();
    } else {
      if (b.state === 'countdown') {
        const n = Math.ceil(b.countdown / TICK_RATE);
        if (n !== this.lastCountdown) {
          this.lastCountdown = n;
          this.showCountdown(String(n));
          audio.countdown(false);
        }
      } else if (this.lastCountdown > 0) {
        this.lastCountdown = 0;
        this.showCountdown('Los!');
        audio.countdown(true);
        setTimeout(() => $('#countdown').classList.add('hidden'), 700);
      }
      this.handleFeed();
      this.checkDamage(evs);
      eventAudio(evs);
    }
    b.feed.length = 0;
    if (b.state === 'over' && !this.ended) {
      this.ended = true;
      this.interactive = false;
      if (this.net) this.net.reportGameOver();
      this.onOver();
    }
    return evs;
  }

  showCountdown(text) {
    const el = $('#countdown');
    el.classList.remove('hidden');
    el.textContent = text;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  // ------------------------------------------------------------ events

  handleFeed() {
    for (const f of this.battle.feed) {
      switch (f.kind) {
        case 'eventStart': if (!this.demo) this.eventStart(f); break;
        case 'wave': this.eventApply(f); break;
        case 'eventEnd': if (!this.demo) this.eventEnd(f); break;
        case 'waveEnd':
          if (f.turns) view.turnFlowers(f.turns, 0.8);
          if (!this.demo) $('#wave').classList.add('hidden');
          break;
        case 'bonus': if (!this.demo) this.bonus(f); break;
        default: break;
      }
    }
  }

  /** The game freezes and the event reel spins in the middle of the screen. */
  eventStart(f) {
    const el = $('#event');
    el.className = '';
    const opts = f.options;
    const n = 16;
    const items = [];
    for (let i = 0; i < n - 1; i++) {
      let id;
      do id = opts[Math.floor(Math.random() * opts.length)]; while (id === items[i - 1] || (i === n - 2 && id === f.id));
      items.push(id);
    }
    items.push(f.id);
    const strip = $('#event .ev-strip');
    strip.innerHTML = items.map((id) => `<div class="ev-item">${icon(WAVES[id].icon)}<b>${WAVES[id].name}</b></div>`).join('');
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    void strip.offsetWidth;
    strip.style.transition = `transform ${EVENT_SPIN * 0.97}s cubic-bezier(.12, .62, .18, 1)`;
    strip.style.transform = `translateY(calc(var(--ih) * -${n - 1}))`;
    $('#event .ev-desc').textContent = 'Das Spiel ruht kurz …';
    this.spin = { t: 0, next: 0 };
    this.revealed = false;
    $('#wave').classList.add('hidden');
    view.setHover(null);
    view.eventFocus(true);
    audio.eventStart();
  }

  reveal() {
    const ev = this.battle.event;
    this.revealed = true;
    this.spin = null;
    const el = $('#event');
    el.classList.add('revealed');
    $('#event .ev-desc').textContent = WAVES[ev.id].desc;
    audio.reveal();
  }

  /** The event's effect lands (still paused): play its animation. */
  eventApply(f) {
    const w = WAVES[f.id];
    view.eventFx(f.id);
    if (f.id === 'move') {
      view.moveHives(f.moves, w.anim - 0.4);
      audio.whoosh();
    } else if (f.id === 'bloom') {
      view.turnFlowers(f.turns, 1.0);
    } else if (f.id === 'flip') {
      view.spinArrows(w.anim + 0.3);
    } else if (f.id === 'wind' || f.id === 'swirl') {
      audio.whoosh();
    }
    if (this.demo) return;
    $('#event').classList.add(`fx-${f.id}`, 'applied');
    if (f.id === 'move' && this.me >= 0) {
      const mv = f.moves.find((m) => m.owner === this.me);
      if (mv) setTimeout(() => toast('Dein Stock ist umgezogen!', this.color, 'shuffle'), (w.anim - 0.2) * 1000);
    }
  }

  eventEnd(f) {
    const el = $('#event');
    el.classList.add('leaving');
    setTimeout(() => { if (el.classList.contains('leaving')) el.classList.add('hidden'); }, 380);
    view.eventFocus(false);
    const w = WAVES[f.id];
    if (w.dur > 0 && this.battle.wave) {
      const box = $('#wave');
      box.classList.remove('hidden', 'pop');
      void box.offsetWidth;
      box.classList.add('pop');
      $('#wave .wave-icon').innerHTML = icon(w.icon);
      $('#wave .wave-name').textContent = w.name;
      $('#wave .wave-desc').textContent = w.desc;
    }
  }

  bonus(f) {
    const bo = BONUSES[f.id];
    const who = `<b>${esc(this.names[f.owner])}</b>`;
    let text = `${who}: ${bo.name} – ${bo.desc}`;
    if (f.id === 'steal' && f.victim >= 0) {
      text = `${who}: ${bo.name} – stiehlt ${f.amount} von ${esc(this.names[f.victim])}!`;
      this.cardHit(f.victim, f.amount);
      if (f.victim === this.me) this.hurt('Raubzug!', `${this.names[f.owner]} stiehlt dir ${f.amount} Bienen`);
    }
    if (f.id === 'nectar') text = `${who}: ${bo.name} – +${f.amount} Bienen`;
    toast(text, this.colors[f.owner], bo.icon);
    if (f.owner === this.me) audio.bonus();
  }

  // ------------------------------------------------------------ damage

  checkDamage(evs) {
    for (const ev of evs) {
      if (ev.type !== 'hornetIn' || !this.battle.active[ev.owner]) continue;
      this.cardHit(ev.owner, ev.lost);
      if (ev.owner === this.me) {
        this.hurt('Autsch!', ev.lost > 0 ? `Hornisse im Stock: −${ev.lost} Bienen` : 'Eine Hornisse ist in deinen Stock geflogen!');
      } else {
        toast(`Hornisse im Stock von <b>${esc(this.names[ev.owner])}</b>: −${ev.lost}`, this.colors[ev.owner], 'hornet');
      }
    }
  }

  /** Big, unmissable feedback when the local player loses bees. */
  hurt(title, text) {
    const el = $('#hurt');
    el.classList.remove('hidden', 'on');
    void el.offsetWidth;
    el.classList.add('on');
    el.querySelector('b').textContent = title;
    el.querySelector('span').textContent = text;
    clearTimeout(this.hurtTimer);
    this.hurtTimer = setTimeout(() => el.classList.add('hidden'), 1900);
    audio.hurt();
    view.hurtHive(this.me);
    navigator.vibrate?.([140, 70, 220]);
  }

  cardHit(p, lost) {
    const card = this.cards?.[p];
    if (!card) return;
    card.classList.remove('hit');
    void card.offsetWidth;
    card.classList.add('hit');
    if (lost > 0) {
      const d = document.createElement('span');
      d.className = 'dmg';
      d.textContent = `−${lost}`;
      card.appendChild(d);
      setTimeout(() => d.remove(), 1300);
    }
  }

  frame(dt) {
    if (this.demo) return;
    const b = this.battle;
    const target = b.cfg.target;
    const scores = this.sim.players.map((p) => p.score);
    let lead = -1;
    for (let p = 0; p < 4; p++) if (b.active[p] && (lead < 0 || scores[p] > scores[lead])) lead = p;
    for (let p = 0; p < 4; p++) {
      const card = this.cards[p];
      card.querySelector('.val').textContent = scores[p];
      card.querySelector('.bar i').style.width = `${Math.min(100, (scores[p] / target) * 100)}%`;
      card.classList.toggle('leader', p === lead && scores[p] > 0);
      const shield = this.sim.players[p].shieldUntil > this.sim.tickCount;
      card.classList.toggle('shield', shield);
      if (shield !== this.shields[p]) {
        this.shields[p] = shield;
        view.setShield(p, shield);
      }
      view.updateHiveLabel(p, scores[p], scores[p] / target);
    }
    const secs = b.secondsLeft();
    const timer = $('#timer');
    timer.textContent = fmtTime(secs);
    timer.classList.toggle('hurry', secs <= 10 && b.state === 'running');

    if (this.spin) {
      this.spin.t += dt;
      if (this.spin.t >= this.spin.next) {
        this.spin.next = this.spin.t + 0.05 + this.spin.t * this.spin.t * 0.06;
        audio.tick();
      }
    }
    if (b.event && !this.revealed && b.event.t >= EVENT_SPIN * TICK_RATE) this.reveal();
    if (b.wave) {
      const total = WAVES[b.wave.id].dur * TICK_RATE;
      const left = (b.wave.until - this.sim.tickCount) / total;
      $('#wave .wave-bar i').style.width = `${Math.max(0, left * 100)}%`;
    }
    audio.setSwarm(b.state === 'event' ? 0 : this.sim.beeCount);
  }

  async onOver() {
    const b = this.battle;
    const w = b.winner;
    audio.music(false);
    audio.setSwarm(0);
    $('#wave').classList.add('hidden');
    $('#event').classList.add('hidden');
    $('#timer').classList.add('hidden');
    view.setHover(null);
    if (w >= 0) {
      view.setLabelsVisible(false);
      audio.hatchRumble();
      setTimeout(() => audio.fanfare(), 1850);
      await view.hatchQueen(w, { color: this.colors[w] });
    } else {
      audio.fail();
      await new Promise((r) => setTimeout(r, 900));
    }
    if (ctrl !== this) return;
    const scores = this.sim.players.map((p) => p.score);
    const me = this.me;
    let title;
    let sub;
    if (b.solo) {
      title = w === me ? 'Geschafft!' : 'Zeit abgelaufen!';
      sub = w === me
        ? 'Dein Stock ist voll, eine neue Königin ist geschlüpft. Lang lebe King Bee!'
        : `Nur ${scores[me]} von ${b.cfg.target} Bienen. Versuch es nochmal!`;
    } else if (w === me) {
      title = 'Gewonnen!';
      sub = 'In deinem Stock ist eine neue Königin geschlüpft. Lang lebe King Bee!';
    } else {
      title = `${this.names[w]} gewinnt!`;
      sub = `Die neue Königin schlüpft im Stock von ${this.names[w]}. Nächstes Mal bist du dran!`;
    }
    const order = [0, 1, 2, 3].filter((p) => b.active[p]).sort((a, c) => scores[c] - scores[a]);
    const table = order.map((p) => scoreCardHTML(this.names[p], scores[p], this.colors[p], scores[p] / b.cfg.target, p === me ? 'me' : '')).join('');
    if (this.net) {
      showResult({
        title, sub, table, lost: w !== me,
        againLabel: 'Zurück zur Lobby', againIcon: 'users', onAgain: () => openRoom(),
        menuLabel: 'Raum verlassen', onMenu: leaveRoomToMenu,
      });
    } else {
      showResult({ title, sub, table, lost: w !== me, againLabel: 'Nochmal', againIcon: 'refresh', onAgain: () => this.restart() });
    }
  }

  restart() {
    startBattle();
  }

  destroy() {
    for (const off of this.offs) off();
    clearTimeout(this.hurtTimer);
    $('#event').classList.add('hidden');
    $('#hurt').classList.add('hidden');
    audio.music(false);
    audio.setSwarm(0);
    if (this.net) $('#net-badge').classList.add('hidden');
  }
}

/** Puzzle mode controller. */
class PuzzleController {
  constructor(index) {
    this.index = index;
    this.level = PUZZLES[index];
    this.run = new PuzzleRun(this.level);
    this.sim = this.run.sim;
    this.colors = [PLAYER_COLORS[0]];
    this.color = this.colors[0];
    this.me = 0;
    this.interactive = true;
    view.setBoard(this.run.board, { colors: this.colors, labels: true });
    view.resetCamera();
    $('#hud').classList.remove('hidden');
    $('#scores').classList.add('hidden');
    $('#timer').classList.add('hidden');
    $('#wave').classList.add('hidden');
    $('#event').classList.add('hidden');
    $('#hurt').classList.add('hidden');
    $('#countdown').classList.add('hidden');
    $('#net-badge').classList.add('hidden');
    $('#controls-hint').classList.remove('hidden');
    $('#controls-hint').classList.toggle('touch', touchDevice);
    $('#controls-hint').innerHTML = touchDevice
      ? 'Über ein Feld <b>wischen</b> legt einen Pfeil &middot; <b>Tippen</b> dreht ihn'
      : 'Feld anvisieren + <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> oder Pfeiltasten &middot; Ziehen &middot; Rechtsklick entfernt';
    $('#puzzle-top').classList.remove('hidden');
    $('#puzzle-bar').classList.remove('hidden');
    $('#puzzle-fail').classList.add('hidden');
    $('#puzzle-top .pz-title').textContent = `Puzzle ${index + 1}: ${this.level.name}`;
    $('#puzzle-top .pz-hint').textContent = this.level.hint;
    this.lastPhase = 'plan';
    this.updateBar();
  }

  updateBar() {
    const used = this.sim.players[0].arrowCells.map((c) => this.sim.arrows[c].dir);
    const slots = [];
    for (let i = 0; i < this.level.arrows; i++) {
      slots.push(i < used.length
        ? `<span class="pz-slot used">${icon('arrow').replace('<svg', `<svg style="transform:rotate(${used[i] * 90}deg)"`)}</span>`
        : `<span class="pz-slot">${icon('arrow')}</span>`);
    }
    $('#puzzle-bar .pz-arrows').innerHTML = slots.join('');
    const running = this.run.phase === 'run';
    $('#pz-start').innerHTML = running
      ? `${icon('stop')} Stopp <kbd>Leertaste</kbd>`
      : `${icon('play')} Start <kbd>Leertaste</kbd>`;
    $('#pz-clear').disabled = running;
  }

  canPlace(x, y) {
    return this.run.phase === 'plan' && this.sim.canPlaceArrow(0, x, y);
  }

  place(x, y, dir) {
    if (!this.canPlace(x, y)) { audio.deny(); return; }
    if (this.sim.placeArrow(0, x, y, dir)) audio.place();
    this.updateBar();
  }

  remove(x, y) {
    if (this.run.phase !== 'plan') return;
    if (this.sim.removeArrow(0, x, y)) audio.remove();
    this.updateBar();
  }

  tap(x, y) {
    const a = this.sim.arrows[this.sim.board.idx(x, y)];
    if (a) this.place(x, y, (a.dir + 1) & 3);
  }

  primary() {
    if (this.run.phase === 'plan') this.start();
    else if (this.run.phase === 'run' || this.run.phase === 'fail') this.stop();
  }

  secondary() {
    if (this.run.phase === 'plan') {
      this.run.clearArrows();
      this.updateBar();
    } else if (this.run.phase !== 'success') {
      this.stop();
    }
  }

  start() {
    audio.ensure();
    view.clearCreatures();
    view.clearMarkers();
    this.run.start();
    this.lastPhase = 'run';
    audio.place();
    this.updateBar();
  }

  stop() {
    this.run.stop();
    view.clearCreatures();
    view.clearMarkers();
    $('#puzzle-fail').classList.add('hidden');
    $('#puzzle-bar').classList.remove('hidden');
    this.lastPhase = 'plan';
    this.updateBar();
  }

  tick() {
    const evs = this.run.tick();
    eventAudio(evs);
    const ph = this.run.phase;
    if (ph !== this.lastPhase) {
      this.lastPhase = ph;
      if (ph === 'fail') this.onFail();
      if (ph === 'success') this.onSuccess();
    }
    return evs;
  }

  onFail() {
    audio.fail();
    const f = this.run.fail;
    $('#puzzle-fail .fail-text').textContent = f.reason;
    $('#puzzle-fail').classList.remove('hidden');
    $('#puzzle-bar').classList.add('hidden');
    if (f.x !== undefined) {
      const p = view.tileToWorld(f.x, f.y);
      view.markerAt(p.x, p.z);
    } else if (f.wx !== undefined) {
      const p = view.simToWorld(f.wx, f.wy);
      view.markerAt(p.x, p.z);
    }
  }

  async onSuccess() {
    this.interactive = false;
    view.setHover(null);
    solved.add(this.index);
    saveSolved();
    $('#puzzle-bar').classList.add('hidden');
    $('#controls-hint').classList.add('hidden');
    view.setLabelsVisible(false);
    audio.hatchRumble();
    setTimeout(() => audio.fanfare(), 1850);
    await view.hatchQueen(0, { color: this.color });
    if (ctrl !== this) return;
    const last = this.index === PUZZLES.length - 1;
    showResult({
      title: last ? 'Alle Puzzles gelöst!' : 'Gelöst!',
      sub: last
        ? 'Du hast die Königsprüfung bestanden. Lang lebe King Bee!'
        : `Alle ${this.run.totalBees} Bienen sind daheim, eine neue Königin ist geschlüpft!`,
      table: '',
      lost: false,
      againLabel: last ? 'Nochmal' : 'Nächstes Puzzle',
      againIcon: last ? 'refresh' : 'play',
      onAgain: () => startPuzzle(last ? this.index : this.index + 1),
    });
  }

  frame() {
    const total = this.run.totalBees;
    view.updateHiveLabel(0, `${this.run.saved}/${total}`, this.run.saved / total);
  }

  restart() {
    startPuzzle(this.index);
  }

  destroy() {}
}

// ================================================================ app flow

let ctrl = null;
let paused = false;
let acc = 0;
let resultActions = null;

function setController(c) {
  if (ctrl) ctrl.destroy();
  ctrl = c;
  paused = false;
  acc = 0;
}

function startDemo() {
  $('#hud').classList.add('hidden');
  const m = BATTLE_MAPS[Math.floor(Math.random() * BATTLE_MAPS.length)];
  setController(new BattleController({
    map: m.id, demo: true, slots: ['ai', 'ai', 'ai', 'ai'], difficulty: 'normal', timeLimit: 1e6, target: 1e9, events: 'often',
  }));
}

function startBattle() {
  audio.ensure();
  show(null);
  const slots = [0, 1, 2, 3].map((p) => (p === 0 ? 'human' : p <= settings.aiCount ? 'ai' : 'wild'));
  setController(new BattleController({
    map: settings.map, slots, difficulty: settings.difficulty, timeLimit: settings.timeLimit, target: settings.target, events: settings.events, me: 0,
  }));
}

function startPuzzle(i) {
  audio.ensure();
  show(null);
  setController(new PuzzleController(i));
}

function toMenu() {
  show('menu');
  if (!ctrl || !ctrl.demo) startDemo();
}

function showResult({ title, sub, table, lost, againLabel, againIcon, onAgain, menuLabel = 'Hauptmenü', onMenu = toMenu }) {
  resultActions = { onAgain, onMenu };
  $('#result-title').textContent = title;
  $('#result-sub').textContent = sub;
  $('#result-table').innerHTML = table;
  $('#result-again').innerHTML = `${icon(againIcon)} ${againLabel}`;
  $('#result-menu').innerHTML = `${icon('leave')} ${menuLabel}`;
  $('#result').classList.toggle('lost', lost);
  $('#hud').classList.add('hidden');
  show('result');
}

function togglePause(force) {
  if (!ctrl || ctrl.demo || !ctrl.interactive) return;
  const next = force ?? visible('pause') === false;
  if (ctrl.net) {
    // online the game keeps running; the menu only offers to leave
    $('#restart').classList.add('hidden');
    $('#pause-note').textContent = 'Online läuft das Spiel weiter.';
    $('#quit').innerHTML = `${icon('leave')} Spiel verlassen`;
    show(next ? 'pause' : null);
    return;
  }
  $('#restart').classList.remove('hidden');
  $('#pause-note').textContent = '';
  $('#quit').innerHTML = `${icon('leave')} Hauptmenü`;
  paused = next;
  show(paused ? 'pause' : null);
}

// ================================================================== menus

for (const b of $$('[data-go]')) {
  b.addEventListener('click', () => {
    audio.ensure();
    const id = b.dataset.go;
    if (id === 'online') { openOnline(); return; }
    if (id === 'puzzles') buildPuzzleGrid();
    if (id === 'battle-setup') refreshSetup();
    show(id);
  });
}

function buildPuzzleGrid() {
  const rows = [];
  for (let i = 0; i < PUZZLES.length; i += 4) rows.push(PUZZLES.slice(i, i + 4).map((lv, k) => [lv, i + k]));
  $('#puzzle-grid').innerHTML = rows.map((row, ri) => `<div class="comb-row ${ri % 2 ? 'off' : ''}">${row.map(([lv, i]) => {
    const unlocked = i === 0 || solved.has(i - 1) || solved.has(i);
    const done = solved.has(i);
    const badge = done ? icon('crown') : unlocked ? '' : icon('lock');
    return `<button class="lvl ${done ? 'solved' : ''} ${unlocked ? '' : 'locked'}" data-i="${i}" ${unlocked ? '' : 'disabled'}>
      <span class="in"><span class="badge">${badge}</span>
      <span class="num">${i + 1}</span><span class="nm">${esc(lv.name)}</span>
      <span class="arr">${icon('arrow').repeat(lv.arrows)}</span></span></button>`;
  }).join('')}</div>`).join('');
}
$('#puzzle-grid').addEventListener('click', (e) => {
  const b = e.target.closest('.lvl');
  if (b && !b.disabled) startPuzzle(Number(b.dataset.i));
});

function refreshSetup() {
  renderMapGrid($('#map-grid'), settings.map, (id) => { settings.map = id; saveSettings(); refreshSetup(); });
  renderOptions($('#setup-options'), ['aiCount', 'difficulty', 'timeLimit', 'target', 'events'], settings, (k, v) => {
    settings[k] = v;
    saveSettings();
    refreshSetup();
  });
  const m = mapById(settings.map);
  const mode = settings.aiCount === 0
    ? `Solo: Fülle deinen Stock mit ${settings.target} Bienen, bevor die Zeit abläuft. Die anderen Stöcke gehören Wildbienen.`
    : `Gegen ${settings.aiCount} KI-Gegner: Wer zuerst ${settings.target} Bienen hat oder bei Zeitende vorne liegt, gewinnt.`;
  $('#setup-desc').innerHTML = `<b>${m.name}:</b> ${m.desc}<br>${mode}`;
}

$('#start-battle').addEventListener('click', startBattle);
$('#resume').addEventListener('click', () => togglePause(false));
$('#restart').addEventListener('click', () => { show(null); ctrl.restart(); });
$('#quit').addEventListener('click', () => (ctrl?.net ? leaveRoomToMenu() : toMenu()));
$('#result-menu').addEventListener('click', () => resultActions?.onMenu());
$('#result-again').addEventListener('click', () => resultActions?.onAgain());
$('#pause-btn').addEventListener('click', () => togglePause());
$('#mute-btn').addEventListener('click', () => updateMute(audio.toggleMute()));
$('#menu-mute').addEventListener('click', () => { audio.ensure(); updateMute(audio.toggleMute()); });
$('#pz-start').addEventListener('click', () => ctrl?.primary?.());
$('#pz-clear').addEventListener('click', () => ctrl?.secondary?.());
$('#pz-retry').addEventListener('click', () => ctrl?.primary?.());

function updateMute(m) {
  $('#mute-btn').innerHTML = icon(m ? 'mute' : 'sound');
  $('#menu-mute').innerHTML = `${icon(m ? 'mute' : 'sound')} Ton ${m ? 'aus' : 'an'}`;
}
updateMute(audio.muted);

// ================================================================= online

let net = null;
let room = null;
let roomListTimer = 0;

function getNet() {
  if (!net) {
    net = new Net();
    net.on('room', (v) => {
      room = v;
      if (visible('room')) renderRoom();
    });
    net.on('gameStart', (g) => startNetBattle(g));
    net.on('closed', () => {
      net = null;
      room = null;
      if (ctrl?.net) {
        toast('Verbindung zum Server verloren.', '#c62828', 'x');
        toMenu();
      } else if (visible('room') || visible('online')) {
        show('online');
        $('#net-status').textContent = 'Verbindung getrennt';
      }
    });
  }
  return net;
}

async function openOnline(autoJoin = null) {
  show('online');
  $('#net-name').value = playerName;
  $('#net-error').textContent = '';
  $('#net-status').textContent = 'Verbinde …';
  try {
    await getNet().connect();
    $('#net-status').textContent = 'Verbunden';
    refreshRooms();
    clearInterval(roomListTimer);
    roomListTimer = setInterval(() => { if (visible('online')) refreshRooms(); }, 3000);
    if (autoJoin) await joinRoom(autoJoin);
  } catch (e) {
    $('#net-status').textContent = 'Offline';
    $('#net-error').textContent = netError(e);
  }
}

async function refreshRooms() {
  if (!net?.connected) return;
  try {
    const list = await net.listRooms();
    const el = $('#room-list');
    if (!list.length) {
      el.innerHTML = '<div class="room-empty">Gerade keine offenen Räume. Erstelle einfach einen!</div>';
      return;
    }
    el.innerHTML = list.map((r) => `<button class="room-item" data-code="${esc(r.code)}">
      <span class="rc">${esc(r.code)}</span>
      <span class="ri"><b>${esc(r.host)}</b><span>${r.players} Spieler &middot; ${r.freeSeats} frei &middot; ${esc(mapById(r.map).name)}</span></span>
    </button>`).join('');
  } catch { /* ignore, next refresh retries */ }
}

function saveName(n) {
  playerName = n;
  localStorage.setItem('kingbee.name', n);
  const field = $('#net-name');
  if (field) field.value = n;
}

/** Name from the online screen; empty if the player has not entered one. */
function rememberName() {
  const n = $('#net-name').value.trim().slice(0, 16);
  if (n) saveName(n);
  return n || playerName;
}

let nameResolve = null;

/**
 * Ask for the player's name in a dialog. Resolves with the name, or null if
 * the dialog was cancelled. Without force it resolves right away when a name
 * is already known.
 */
function askName({ force = false } = {}) {
  const known = rememberName();
  if (known && !force) return Promise.resolve(known);
  const modal = $('#name-modal');
  modal.classList.remove('hidden');
  const input = $('#name-input');
  input.value = force ? playerName : '';
  input.classList.remove('shake');
  setTimeout(() => input.focus(), 50);
  return new Promise((resolve) => { nameResolve = resolve; });
}

function closeName(result) {
  $('#name-modal').classList.add('hidden');
  const r = nameResolve;
  nameResolve = null;
  r?.(result);
}

$('#name-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#name-input');
  const n = input.value.trim().slice(0, 16);
  if (!n) {
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake');
    input.focus();
    return;
  }
  saveName(n);
  closeName(n);
});
$('#name-cancel').addEventListener('click', () => closeName(null));

async function createRoom() {
  $('#net-error').textContent = '';
  const name = await askName();
  if (!name) return;
  try {
    await getNet().connect();
    room = await net.createRoom(name);
    openRoom();
  } catch (e) {
    $('#net-error').textContent = netError(e);
  }
}

async function joinRoom(code) {
  code = String(code || '').trim().toUpperCase();
  if (code.length !== 4) { $('#net-error').textContent = 'Der Raum-Code hat 4 Buchstaben.'; return; }
  $('#net-error').textContent = '';
  const name = await askName();
  if (!name) return;
  try {
    await getNet().connect();
    room = await net.joinRoom(code, name);
    openRoom();
  } catch (e) {
    $('#net-error').textContent = netError(e);
  }
}

$('#net-create').addEventListener('click', createRoom);
$('#net-join').addEventListener('click', () => joinRoom($('#net-code').value));
$('#net-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom($('#net-code').value); });
$('#net-refresh').addEventListener('click', refreshRooms);
$('#room-list').addEventListener('click', (e) => {
  const b = e.target.closest('.room-item');
  if (b) joinRoom(b.dataset.code);
});

const mySeat = () => (room && net ? room.seats.findIndex((s) => s.type === 'human' && s.id === net.id) : -1);
const amHost = () => !!room && room.seats.some((s) => s.isHost && s.id === net?.id);

function openRoom() {
  if (!room) { openOnline(); return; }
  if (!ctrl?.demo) startDemo();
  show('room');
  renderRoom();
}

function renderRoom() {
  if (!room) return;
  const host = amHost();
  const me = mySeat();
  $('#room-code').textContent = room.code;
  $('#room-seats').innerHTML = room.seats.map((s, p) => {
    const color = s.type === 'closed' ? WILD_COLOR : PLAYER_COLORS[p];
    let ic = 'hive';
    let title;
    let small;
    if (s.type === 'human') {
      ic = 'bee';
      title = esc(s.name);
      small = [s.isHost ? 'Gastgeber' : 'Spieler', s.left ? 'getrennt' : ''].filter(Boolean).join(' · ');
    } else if (s.type === 'ai') {
      ic = 'robot';
      title = `KI: ${PLAYER_NAMES[p]}`;
      small = 'Computer-Gegner';
    } else if (s.type === 'open') {
      title = 'Freier Platz';
      small = 'Wartet auf Mitspieler (sonst Wildbienen)';
    } else {
      ic = 'lock';
      title = 'Wildbienen';
      small = 'Niemand steuert diesen Stock';
    }
    let ctrlHtml = '';
    if (s.type !== 'human' && host) {
      const opt = (t, label) => `<button data-seat="${p}" data-type="${t}" class="${s.type === t ? 'on' : ''}">${label}</button>`;
      ctrlHtml = `<div class="seg">${opt('open', 'Offen')}${opt('ai', 'KI')}${opt('closed', 'Zu')}</div>`;
    }
    if (s.type !== 'human' && me >= 0) {
      ctrlHtml += `<button class="btn small" data-move="${p}">Hierher</button>`;
    }
    const tags = p === me
      ? `<button class="mini-btn rename" data-rename title="Namen ändern">${icon('edit')}</button><span class="tag">Du</span>`
      : '';
    return `<div class="seat ${p === me ? 'me' : ''}" style="--c:${color}">
      <span class="sh">${icon(ic)}</span>
      <span class="sn"><b>${title}</b><small>${small}</small></span>${tags}${ctrlHtml}</div>`;
  }).join('');
  renderMapGrid($('#room-maps'), room.settings.map, (id) => net.updateRoom({ ...room.settings, map: id }), !host);
  renderOptions($('#room-options'), ['difficulty', 'timeLimit', 'target', 'events'], { events: 'normal', ...room.settings }, (k, v) => {
    net.updateRoom({ ...room.settings, [k]: v });
  }, !host);
  const humans = room.seats.filter((s) => s.type === 'human').length;
  $('#room-start').disabled = !host || room.state !== 'lobby';
  $('#room-start').classList.toggle('hidden', !host);
  $('#room-hint').innerHTML = host
    ? `Teile den Code <b>${room.code}</b> oder den Einladungslink. ${humans} Spieler im Raum.`
    : room.state === 'playing' ? 'Hier läuft gerade ein Spiel …' : 'Warte, bis der Gastgeber das Spiel startet …';
}

$('#room-seats').addEventListener('click', async (e) => {
  if (e.target.closest('[data-rename]')) {
    const n = await askName({ force: true });
    if (n) net?.setName(n).catch((err) => toast(esc(netError(err)), '#c62828', 'x'));
    return;
  }
  const t = e.target.closest('button[data-type]');
  if (t) { net.setSeat(Number(t.dataset.seat), t.dataset.type).catch((err) => toast(esc(netError(err)), '#c62828', 'x')); return; }
  const m = e.target.closest('button[data-move]');
  if (m) net.moveToSeat(Number(m.dataset.move)).catch(() => {});
});
$('#room-start').addEventListener('click', () => net.startGame().catch((e) => toast(esc(netError(e)), '#c62828', 'x')));
$('#room-leave').addEventListener('click', leaveRoomToOnline);
$('#room-copy').addEventListener('click', async () => {
  const link = `${location.origin}/?raum=${room.code}`;
  try {
    await navigator.clipboard.writeText(link);
    $('#room-copy').innerHTML = `${icon('check')} Kopiert!`;
  } catch {
    $('#room-copy').innerHTML = `${icon('link')} ${link}`;
  }
  setTimeout(() => { $('#room-copy').innerHTML = `${icon('link')} Einladungslink kopieren`; }, 2500);
});

async function leaveRoomToOnline() {
  try { await net?.leaveRoom(); } catch { /* ignore */ }
  room = null;
  openOnline();
}

async function leaveRoomToMenu() {
  try { await net?.leaveRoom(); } catch { /* ignore */ }
  room = null;
  toMenu();
}

function startNetBattle(g) {
  audio.ensure();
  show(null);
  setController(new BattleController({
    map: g.settings.map,
    slots: g.slots,
    names: g.names,
    difficulty: g.settings.difficulty,
    timeLimit: g.settings.timeLimit,
    target: g.settings.target,
    events: g.settings.events || 'normal',
    seed: g.seed,
    me: mySeat(),
    net,
    roomCode: room?.code,
  }));
}

// ================================================================== input

const stage = $('#stage');
let hoverTile = null;
let drag = null;

const SWIPE_MIN = 14; // px before a drag counts as a swipe

function inputBlocked() {
  return !ctrl || !ctrl.interactive || paused || ctrl.frozen;
}

function refreshHover() {
  if (inputBlocked()) {
    view.setHover(null);
    return;
  }
  if (drag && drag.tile && drag.button !== 2) {
    view.setHover(drag.tile, ctrl.color, ctrl.canPlace(drag.tile.x, drag.tile.y), drag.dir);
    return;
  }
  if (!hoverTile || drag) {
    view.setHover(null);
    return;
  }
  view.setHover(hoverTile, ctrl.color, ctrl.canPlace(hoverTile.x, hoverTile.y));
}

stage.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' || !drag) hoverTile = view.pickTile(e.clientX, e.clientY);
  if (drag && drag.tile) {
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.dir = Math.hypot(dx, dy) > SWIPE_MIN ? view.dirFromScreen(drag.tile, dx, dy) : null;
  }
});
stage.addEventListener('pointerleave', () => { hoverTile = null; });
stage.addEventListener('contextmenu', (e) => e.preventDefault());
stage.addEventListener('pointerdown', (e) => {
  audio.ensure();
  if (inputBlocked()) return;
  const tile = view.pickTile(e.clientX, e.clientY);
  hoverTile = tile;
  drag = { tile, x: e.clientX, y: e.clientY, button: e.button, dir: null };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointercancel', () => { drag = null; });
stage.addEventListener('pointerup', (e) => {
  const d = drag;
  drag = null;
  if (e.pointerType !== 'mouse') hoverTile = null;
  if (!d || !d.tile || inputBlocked()) return;
  if (d.button === 2) { ctrl.remove(d.tile.x, d.tile.y); return; }
  const dx = e.clientX - d.x;
  const dy = e.clientY - d.y;
  if (Math.hypot(dx, dy) > SWIPE_MIN) ctrl.place(d.tile.x, d.tile.y, view.dirFromScreen(d.tile, dx, dy));
  else ctrl.tap(d.tile.x, d.tile.y);
});

// keys point in screen directions (the board may be rotated on phones)
const KEY_DIR = {
  w: [0, -1], W: [0, -1], ArrowUp: [0, -1],
  d: [1, 0], D: [1, 0], ArrowRight: [1, 0],
  s: [0, 1], S: [0, 1], ArrowDown: [0, 1],
  a: [-1, 0], A: [-1, 0], ArrowLeft: [-1, 0],
};

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === 'Escape' && nameResolve) { closeName(null); return; }
  if (e.key === 'm' || e.key === 'M') { updateMute(audio.toggleMute()); return; }
  if (e.key === 'Escape') { togglePause(); return; }
  if (!ctrl || ctrl.demo || paused) return;
  if (e.key in KEY_DIR) {
    e.preventDefault();
    if (!inputBlocked() && hoverTile) {
      const [sx, sy] = KEY_DIR[e.key];
      ctrl.place(hoverTile.x, hoverTile.y, view.dirFromScreen(hoverTile, sx, sy));
    }
    return;
  }
  if (e.key === ' ') { e.preventDefault(); if (ctrl.interactive) ctrl.primary?.(); }
  if (e.key === 'r' || e.key === 'R') { if (ctrl.interactive) ctrl.secondary?.(); }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && ctrl && !ctrl.demo && !ctrl.net && ctrl.interactive && !paused) togglePause(true);
});

// =================================================================== loop

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  let alpha = 0;
  if (ctrl && ctrl.net) {
    const evs = ctrl.pump(dt);
    if (evs.length) view.onEvents(evs);
    alpha = ctrl.alpha;
    ctrl.frame(dt);
  } else if (ctrl && !paused) {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 8) {
      const evs = ctrl.tick();
      if (evs.length) view.onEvents(evs);
      acc -= DT;
      steps++;
    }
    if (steps >= 8) acc = 0;
    alpha = Math.min(1, acc / DT);
    ctrl.frame(dt);
  }
  refreshHover();
  view.update(ctrl ? ctrl.sim : null, alpha, paused && !ctrl?.net ? 0 : dt);
  requestAnimationFrame(frame);
}

toMenu();
requestAnimationFrame(frame);

// invite links: /?raum=ABCD
const inviteCode = new URLSearchParams(location.search).get('raum');
if (inviteCode) {
  history.replaceState(null, '', location.pathname);
  openOnline(inviteCode);
}

// handy for debugging in the console
window.kingbee = {
  view, get ctrl() { return ctrl; }, get net() { return net; }, get room() { return room; }, startPuzzle, startBattle,
};
