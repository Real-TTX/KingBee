import { CELL, PLAYER_COLORS, N, E, S, W } from '../game/constants.js';

/** Draw a small top-down preview of a board onto a 2D canvas. */
export function drawPreview(canvas, board, colors = PLAYER_COLORS) {
  const T = 16;
  canvas.width = board.w * T + 8;
  canvas.height = board.h * T + 8;
  const g = canvas.getContext('2d');
  g.fillStyle = '#9b6a35';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.translate(4, 4);
  for (let y = 0; y < board.h; y++) {
    for (let x = 0; x < board.w; x++) {
      const c = board.idx(x, y);
      g.fillStyle = (x + y) % 2 ? '#f3d98e' : '#fbe9b4';
      g.fillRect(x * T, y * T, T, T);
      const cx = x * T + T / 2, cy = y * T + T / 2;
      if (board.type[c] === CELL.HOLE) {
        g.fillStyle = '#1b0f05';
        g.beginPath(); g.arc(cx, cy, T * 0.36, 0, Math.PI * 2); g.fill();
      } else if (board.type[c] === CELL.HIVE) {
        g.fillStyle = colors[board.owner[c]] || '#999';
        g.beginPath(); g.arc(cx, cy, T * 0.42, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#e8b551';
        g.beginPath(); g.arc(cx, cy + 1, T * 0.26, Math.PI, 0); g.fill();
      } else if (board.type[c] === CELL.SPAWN) {
        g.fillStyle = '#ff8fc7';
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          g.beginPath(); g.arc(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, 3, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = '#e2a82a';
        g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
      }
    }
  }
  g.strokeStyle = '#7a4a12';
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  for (const s of board.wallSegments()) {
    let x0 = s.x * T, y0 = s.y * T, x1 = x0, y1 = y0;
    if (s.side === N) x1 += T;
    else if (s.side === S) { y0 += T; y1 = y0; x1 += T; }
    else if (s.side === W) y1 += T;
    else { x0 += T; x1 = x0; y1 += T; }
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
}
