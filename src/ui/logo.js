// The KING BEE logo as inline SVG: honeycomb badge with a crowned bee,
// chunky gold lettering, a ribbon and little bees buzzing around it.

const BROWN = '#3d2208';

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const miniBee = `
  <symbol id="kb-mini" viewBox="-40 -34 76 60" overflow="visible">
    <g class="kb-wing"><ellipse cx="-4" cy="-17" rx="13" ry="9" transform="rotate(-25 -4 -17)" fill="#fff" fill-opacity=".9" stroke="${BROWN}" stroke-width="3.5"/></g>
    <path d="M-26 0 L-36 -2 L-26 5 Z" fill="${BROWN}"/>
    <clipPath id="kb-mini-clip"><ellipse cx="0" cy="0" rx="23" ry="15.5"/></clipPath>
    <ellipse cx="0" cy="0" rx="23" ry="15.5" fill="#ffc928"/>
    <g clip-path="url(#kb-mini-clip)" fill="${BROWN}">
      <rect x="-14" y="-20" width="7" height="40"/><rect x="0" y="-20" width="7" height="40"/>
    </g>
    <ellipse cx="0" cy="0" rx="23" ry="15.5" fill="none" stroke="${BROWN}" stroke-width="4"/>
    <circle cx="24" cy="-3" r="11.5" fill="#3a2410" stroke="${BROWN}" stroke-width="3"/>
    <circle cx="28" cy="-6" r="4.6" fill="#fff"/><circle cx="29.5" cy="-5.5" r="2.4" fill="#120a03"/>
    <path d="M22 -13 Q20 -24 14 -27" fill="none" stroke="${BROWN}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="14" cy="-27" r="2.8" fill="${BROWN}"/>
  </symbol>`;

export function logoSVG() {
  const outer = hexPoints(500, 200, 168);
  const inner = hexPoints(500, 200, 142);
  // honeycomb texture
  let comb = '';
  for (let row = -4; row <= 4; row++) {
    for (let col = -5; col <= 5; col++) {
      const cx = 500 + col * 34 + (row & 1 ? 17 : 0);
      const cy = 200 + row * 29.5;
      comb += `<polygon points="${hexPoints(cx, cy, 17)}"/>`;
    }
  }
  const word = (text, x, anchor) => `
    <text x="${x}" y="262" text-anchor="${anchor}" class="kb-word kb-word-shadow" transform="translate(0 13)">${text}</text>
    <text x="${x}" y="262" text-anchor="${anchor}" class="kb-word" fill="url(#kb-gold)">${text}</text>
    <text x="${x}" y="262" text-anchor="${anchor}" class="kb-word-shine" fill="url(#kb-shine)">${text}</text>`;

  return `
<svg class="kb-logo" viewBox="0 0 1000 470" role="img" aria-label="King Bee">
  <defs>
    <linearGradient id="kb-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff7b8"/>
      <stop offset=".42" stop-color="#ffd23a"/>
      <stop offset="1" stop-color="#f08a00"/>
    </linearGradient>
    <linearGradient id="kb-shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".85"/>
      <stop offset=".35" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="kb-badge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe680"/>
      <stop offset="1" stop-color="#f3a50f"/>
    </linearGradient>
    <linearGradient id="kb-ribbon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a8521a"/>
      <stop offset="1" stop-color="#6e300c"/>
    </linearGradient>
    <radialGradient id="kb-glow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fff6c4" stop-opacity=".95"/>
      <stop offset="1" stop-color="#fff6c4" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="kb-inner"><polygon points="${inner}"/></clipPath>
    <clipPath id="kb-body"><ellipse cx="500" cy="268" rx="62" ry="58"/></clipPath>
    ${miniBee}
  </defs>

  <ellipse cx="500" cy="205" rx="330" ry="210" fill="url(#kb-glow)" class="kb-glow"/>

  <!-- flight trails -->
  <g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 14" opacity=".9">
    <path d="M30 150 C 70 60, 140 40, 175 70"/>
    <path d="M985 140 C 960 50, 880 40, 845 72"/>
    <path d="M700 452 C 790 470, 880 430, 905 380"/>
  </g>

  <!-- badge -->
  <polygon points="${outer}" fill="${BROWN}" transform="translate(0 12)"/>
  <polygon points="${outer}" fill="url(#kb-badge)" stroke="${BROWN}" stroke-width="14" stroke-linejoin="round"/>
  <g clip-path="url(#kb-inner)" fill="none" stroke="#c97a06" stroke-opacity=".35" stroke-width="3">${comb}</g>
  <polygon points="${inner}" fill="none" stroke="#fff3b0" stroke-width="5" stroke-opacity=".8"/>

  <!-- crowned bee -->
  <g class="kb-bee">
    <g class="kb-wing kb-wing-l"><ellipse cx="438" cy="196" rx="56" ry="32" transform="rotate(-28 438 196)" fill="#fff" fill-opacity=".92" stroke="${BROWN}" stroke-width="6"/></g>
    <g class="kb-wing kb-wing-r"><ellipse cx="562" cy="196" rx="56" ry="32" transform="rotate(28 562 196)" fill="#fff" fill-opacity=".92" stroke="${BROWN}" stroke-width="6"/></g>
    <path d="M488 318 L500 340 L512 318 Z" fill="${BROWN}"/>
    <ellipse cx="500" cy="268" rx="62" ry="58" fill="#ffc928"/>
    <g clip-path="url(#kb-body)" fill="${BROWN}">
      <rect x="420" y="246" width="160" height="17"/><rect x="420" y="281" width="160" height="17"/><rect x="420" y="314" width="160" height="17"/>
    </g>
    <ellipse cx="500" cy="268" rx="62" ry="58" fill="none" stroke="${BROWN}" stroke-width="7"/>
    <path d="M484 132 C 480 110, 466 96, 450 92" fill="none" stroke="${BROWN}" stroke-width="6" stroke-linecap="round"/>
    <path d="M516 132 C 520 110, 534 96, 550 92" fill="none" stroke="${BROWN}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="449" cy="91" r="8" fill="${BROWN}"/><circle cx="551" cy="91" r="8" fill="${BROWN}"/>
    <circle cx="500" cy="180" r="52" fill="#3a2410" stroke="${BROWN}" stroke-width="6"/>
    <ellipse cx="480" cy="178" rx="15" ry="18" fill="#fff"/><ellipse cx="520" cy="178" rx="15" ry="18" fill="#fff"/>
    <circle cx="483" cy="182" r="8.5" fill="#120a03"/><circle cx="517" cy="182" r="8.5" fill="#120a03"/>
    <circle cx="486.5" cy="177" r="3.4" fill="#fff"/><circle cx="520.5" cy="177" r="3.4" fill="#fff"/>
    <ellipse cx="463" cy="201" rx="8" ry="5" fill="#ff8c9a"/><ellipse cx="537" cy="201" rx="8" ry="5" fill="#ff8c9a"/>
    <path d="M488 203 Q500 215 512 203" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
    <!-- crown -->
    <g class="kb-crown">
      <path d="M464 140 L458 100 L481 117 L500 88 L519 117 L542 100 L536 140 Z" fill="url(#kb-gold)" stroke="${BROWN}" stroke-width="6" stroke-linejoin="round"/>
      <circle cx="458" cy="99" r="6" fill="#ffe680" stroke="${BROWN}" stroke-width="4"/>
      <circle cx="500" cy="87" r="7" fill="#ffe680" stroke="${BROWN}" stroke-width="4"/>
      <circle cx="542" cy="99" r="6" fill="#ffe680" stroke="${BROWN}" stroke-width="4"/>
      <circle cx="500" cy="124" r="6.5" fill="#ff2d6b" stroke="${BROWN}" stroke-width="3"/>
      <circle cx="479" cy="128" r="4.5" fill="#3dd6ff" stroke="${BROWN}" stroke-width="2.5"/>
      <circle cx="521" cy="128" r="4.5" fill="#3dd6ff" stroke="${BROWN}" stroke-width="2.5"/>
    </g>
  </g>

  <!-- lettering -->
  ${word('KING', 338, 'end')}
  ${word('BEE', 662, 'start')}

  <!-- ribbon -->
  <g class="kb-ribbon">
    <path d="M300 386 L232 394 L254 414 L234 438 L306 430 Z" fill="#5a260a" stroke="${BROWN}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M700 386 L768 394 L746 414 L766 438 L694 430 Z" fill="#5a260a" stroke="${BROWN}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M292 378 Q500 398 708 378 L708 428 Q500 448 292 428 Z" fill="url(#kb-ribbon)" stroke="${BROWN}" stroke-width="6" stroke-linejoin="round"/>
    <path id="kb-ribbon-path" d="M310 418 Q500 436 690 418" fill="none"/>
    <text class="kb-tag"><textPath href="#kb-ribbon-path" startOffset="50%" text-anchor="middle">LANG LEBE DIE KÖNIGIN</textPath></text>
  </g>

  <!-- buzzing bees -->
  <use href="#kb-mini" class="kb-mb kb-mb1" x="140" y="40" width="76" height="60"/>
  <use href="#kb-mini" class="kb-mb kb-mb2" x="-880" y="42" width="76" height="60" transform="scale(-1 1)"/>
  <use href="#kb-mini" class="kb-mb kb-mb3" x="878" y="330" width="62" height="49"/>
</svg>`;
}

/** Small square bee mark (favicon / badges). */
export function beeMarkSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<polygon points="${hexPoints(32, 32, 30)}" fill="#ffc928" stroke="${BROWN}" stroke-width="4"/>
<ellipse cx="22" cy="24" rx="10" ry="6" transform="rotate(-30 22 24)" fill="#fff" stroke="${BROWN}" stroke-width="2.5"/>
<ellipse cx="42" cy="24" rx="10" ry="6" transform="rotate(30 42 24)" fill="#fff" stroke="${BROWN}" stroke-width="2.5"/>
<ellipse cx="32" cy="38" rx="11" ry="12" fill="#ffc928" stroke="${BROWN}" stroke-width="3"/>
<path d="M22 35h20M22 41h20" stroke="${BROWN}" stroke-width="3.5"/>
<circle cx="32" cy="23" r="8" fill="#3a2410"/>
<path d="M25 17l-1-7 4.5 3.5L32 8l3.5 5.5L40 10l-1 7z" fill="#ffd23a" stroke="${BROWN}" stroke-width="2" stroke-linejoin="round"/>
</svg>`;
}
