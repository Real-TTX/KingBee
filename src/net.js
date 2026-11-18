import * as signalR from '@microsoft/signalr';
import { connect, OnlineTransport, isUpdateError } from './matgame/index.js';

/**
 * Online play through MatGame: the master (the page's own origin in the browser, the chosen server in the app shell) keeps the lobbies and relays
 * the inputs at /kingbee/hub. A session of the master (account or guest) is needed for the hub.
 * Events of Net: room, gameStart, frame, desync, playerLeft, closed.
 */

let context = null;

/**
 * Where online play stands: { info, server, session, discovery, entry, problem } (MatGame SDK connect()).
 * server null = offline (app without a chosen server); problem = the master did not answer or the app is too old.
 */
export async function onlineContext({ refresh = false } = {}) {
  if (!context || refresh) context = await connect({ game: 'kingbee' });
  return context;
}

/** The context of the last onlineContext() call (null before the first). */
export const currentContext = () => context;

/** A new connection to the hub of the current master (needs a signed-in session). */
export function createNet(ctx = context) {
  if (!ctx?.server || !ctx.entry) throw new Error('Offline: kein Server gewählt.');
  return new Net(new OnlineTransport({ signalR, session: ctx.session, base: ctx.entry.path, hubPath: '/hub' }));
}

export class Net {
  constructor(transport) {
    this.handlers = {};
    this.transport = transport;
    transport.on('Room', (v) => this.emit('room', v));
    transport.on('GameStart', (g) => this.emit('gameStart', g));
    transport.on('Frame', (f, inputs) => this.emit('frame', f, inputs));
    transport.on('Desync', (f) => this.emit('desync', f));
    transport.on('PlayerLeft', (seat, name) => this.emit('playerLeft', seat, name));
    transport.onClose(() => this.emit('closed'));
  }

  on(ev, fn) {
    (this.handlers[ev] ||= []).push(fn);
    return () => { this.handlers[ev] = this.handlers[ev].filter((h) => h !== fn); };
  }

  emit(ev, ...args) {
    for (const fn of this.handlers[ev] || []) fn(...args);
  }

  get id() {
    return this.transport.connectionId;
  }

  get connected() {
    return this.transport.connected;
  }

  async connect() {
    if (!this.connected) await this.transport.start();
  }

  stop() {
    return this.transport.stop();
  }

  call(method, ...args) {
    return this.transport.invoke(method, ...args);
  }

  listRooms() { return this.call('ListRooms'); }
  createRoom(name) { return this.call('CreateRoom', name); }
  joinRoom(code, name) { return this.call('JoinRoom', code, name); }
  leaveRoom() { return this.connected ? this.call('LeaveRoom') : Promise.resolve(); }
  updateRoom(settings) { return this.call('UpdateRoom', settings); }
  setSeat(seat, type) { return this.call('SetSeat', seat, type); }
  setName(name) { return this.call('SetName', name); }
  moveToSeat(seat) { return this.call('MoveToSeat', seat); }
  startGame() { return this.call('StartGame'); }
  reportGameOver() { return this.call('ReportGameOver').catch(() => {}); }

  // fire-and-forget hot path
  sendInput(input) { this.transport.send('Input', input); }
  reportHash(frame, hash) { this.transport.send('ReportHash', frame, hash); }
}

/** Human readable error text from a hub exception or an answer of the master. */
export function netError(e) {
  if (isUpdateError(e)) return e.message || 'Bitte die App aktualisieren.';
  const m = String(e?.message || e || '');
  const i = m.indexOf('HubException: ');
  if (i >= 0) return m.slice(i + 14);
  if (/Status code '401'/i.test(m)) return 'Bitte zuerst anmelden oder als Gast spielen.';
  if (/Failed to fetch|Failed to complete negotiation|WebSocket/i.test(m)) return 'Server nicht erreichbar.';
  return m || 'Unbekannter Fehler';
}
