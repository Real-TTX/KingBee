// Hand-made SVG icon set (24x24, stroke = currentColor). No emojis anywhere.

const P = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  play: '<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9a4 4 0 010 6M19 6.5a7.5 7.5 0 010 11"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  clear: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
  crown: '<path d="M3 8.5l4.5 3.5L12 5l4.5 7L21 8.5 19 19H5z" fill="currentColor"/><path d="M5 21h14"/>',
  battle: '<path d="M4 4l11 11M4 4h4.5M4 4v4.5M20 4L9 15M20 4h-4.5M20 4v4.5"/><path d="M6.5 13.5l4 4M17.5 13.5l-4 4M8 16l-3.5 3.5M16 16l3.5 3.5"/>',
  online: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.5 3.2 14.5 0 18M12 3c-3.2 3.5-3.2 14.5 0 18"/>',
  puzzle: '<path d="M4 8h3.5a2.5 2.5 0 115 0H16v3.5a2.5 2.5 0 110 5V20h-3.5a2.5 2.5 0 10-5 0H4v-3.5a2.5 2.5 0 100-5z"/>',
  book: '<path d="M4 19.5V5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 21.5a2.5 2.5 0 012.5-2.5H20"/><path d="M8.5 7.5h7M8.5 11h5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 13.6A5 5 0 0122 18.5"/>',
  robot: '<rect x="4.5" y="8" width="15" height="11" rx="3"/><path d="M12 4v4M9 12.5v1.5M15 12.5v1.5M9.5 16.5h5M2.5 12v3M21.5 12v3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  flower: '<circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M12 9.4a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4zM12 14.6a3.2 3.2 0 110 6.4 3.2 3.2 0 010-6.4zM9.4 12a3.2 3.2 0 11-6.4 0 3.2 3.2 0 016.4 0zM14.6 12a3.2 3.2 0 116.4 0 3.2 3.2 0 01-6.4 0z"/>',
  wind: '<path d="M3 8h11a3 3 0 10-3-3M3 12h15a3 3 0 11-3 3M3 16h7"/>',
  fast: '<path d="M4 6l7 6-7 6M12 6l7 6-7 6"/>',
  drop: '<path d="M12 3c4 5 6.5 8 6.5 11.5a6.5 6.5 0 01-13 0C5.5 11 8 8 12 3z"/><path d="M9 15a3 3 0 002.5 2.8"/>',
  sparkle: '<path d="M11 3l2 6.5 6.5 2-6.5 2L11 20l-2-6.5-6.5-2 6.5-2z" fill="currentColor"/><path d="M19.5 3v4M17.5 5h4"/>',
  smoke: '<path d="M6 19h10.5a4.5 4.5 0 00.5-9 6 6 0 00-11.4-1.5A5 5 0 006 19z"/>',
  swirl: '<path d="M12.5 12.5a1.8 1.8 0 10-1.8-1.8c0 2.7 2.2 4.6 4.6 4.6a5.5 5.5 0 005.5-5.5c0-4.4-3.6-7.3-8-7.3A8.8 8.8 0 004 11.3c0 5.1 4 9.2 9 9.2"/>',
  hornet: '<ellipse cx="12" cy="14.5" rx="4" ry="5.5"/><circle cx="12" cy="6.5" r="2.5"/><path d="M8.3 12C4 9 2.5 11 3.5 13M15.7 12c4.3-3 5.8-1 4.8 1M8.5 13.5h7M8.5 16.5h7M12 20v2.5M10.5 4.3L9 2.5M13.5 4.3L15 2.5"/>',
  bee: '<ellipse cx="12" cy="14" rx="5" ry="6"/><path d="M7.5 12h9M7.2 15h9.6M8.5 18h7"/><path d="M8 9.5C4.5 6 2.5 8 3.5 10.5S8 11 8 11M16 9.5c3.5-3.5 5.5-1.5 4.5 1S16 11 16 11"/><path d="M10 5.5L8.5 3M14 5.5L15.5 3"/>',
  mask: '<path d="M2.5 10c0-2 4.3-3.5 9.5-3.5s9.5 1.5 9.5 3.5c0 4.5-3 6.5-5.5 6.5S13 14.5 12 14.5 10.5 16.5 8 16.5 2.5 14.5 2.5 10z"/><path d="M7 10.5h2.5M14.5 10.5H17"/>',
  magnet: '<path d="M6 3v9a6 6 0 0012 0V3h-4v9a2 2 0 01-4 0V3z"/><path d="M6 7h4M14 7h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2.5"/>',
  hive: '<path d="M7 6h10M5 9.5h14M4.2 13h15.6M4.5 16.5h15"/><path d="M12 2.5c-4.4 0-8 3.6-8 8.2V20h16v-9.3c0-4.6-3.6-8.2-8-8.2z"/><path d="M10 20v-2.5a2 2 0 014 0V20"/>',
  arrow: '<path d="M12 3.5l7.5 8.5h-4.5v8.5H9V12H4.5z" fill="currentColor"/>',
  leave: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  map: '<path d="M3 6l6-2.5 6 2.5 6-2.5v14.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 3.5v14.5M15 6v14.5"/>',
  hex: '<path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  enter: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H8"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M12 14v3M8 21h8M9 17h6v4H9z"/>',
};

export function icon(name, cls = '') {
  const body = P[name] || P.hex;
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Fill every element with a data-icon attribute. */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    if (el.dataset.iconDone) continue;
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon, el.dataset.iconClass || ''));
    el.dataset.iconDone = '1';
  }
}
