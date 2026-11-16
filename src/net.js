import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';

/**
 * Thin wrapper around the SignalR connection to /hubs/game.
 * Events: room, gameStart, frame, desync, playerLeft, closed.
 */
export class Net {
  constructor() {
    this.handlers = {};
    this.conn = new HubConnectionBuilder()
      .withUrl('/hubs/game')
      .configureLogging(LogLevel.Warning)
      .build();
    this.conn.on('Room', (v) => this.emit('room', v));
    this.conn.on('GameStart', (g) => this.emit('gameStart', g));
    this.conn.on('Frame', (f, inputs) => this.emit('frame', f, inputs));
    this.conn.on('Desync', (f) => this.emit('desync', f));
    this.conn.on('PlayerLeft', (seat, name) => this.emit('playerLeft', seat, name));
    this.conn.onclose(() => this.emit('closed'));
  }

  on(ev, fn) {
    (this.handlers[ev] ||= []).push(fn);
    return () => { this.handlers[ev] = this.handlers[ev].filter((h) => h !== fn); };
  }

  emit(ev, ...args) {
    for (const fn of this.handlers[ev] || []) fn(...args);
  }

  get id() {
    return this.conn.connectionId;
  }

  get connected() {
    return this.conn.state === HubConnectionState.Connected;
  }

  async connect() {
    if (this.connected) return;
    if (this.conn.state === HubConnectionState.Disconnected) await this.conn.start();
  }

  call(method, ...args) {
    return this.conn.invoke(method, ...args);
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
  sendInput(input) { this.conn.send('Input', input).catch(() => {}); }
  reportHash(frame, hash) { this.conn.send('ReportHash', frame, hash).catch(() => {}); }
}

/** Human readable error text from a hub exception. */
export function netError(e) {
  const m = String(e?.message || e || '');
  const i = m.indexOf('HubException: ');
  if (i >= 0) return m.slice(i + 14);
  if (/Failed to fetch|Failed to complete negotiation|WebSocket/i.test(m)) return 'Server nicht erreichbar.';
  return m || 'Unbekannter Fehler';
}
