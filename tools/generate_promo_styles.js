/**
 * Keep C + E. Generate 5 NEW varied layouts (not just bg swaps).
 * Output: store/phone/styles/style_F..J.png
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'store', 'phone', 'styles');
const FONT_B64 = fs.readFileSync(path.join(ROOT, 'assets', 'fonts', 'Nunito.ttf')).toString('base64');
const SRC = path.join(ROOT, 'store', 'IMG_0011.png');

const W = 1284;
const H = 2778;
const CROP_H = 1248;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fontFace() {
  return `@font-face{font-family:'NunitoEmbed';src:url('data:font/ttf;base64,${FONT_B64}');}`;
}

async function croppedScreen(width) {
  const height = Math.round((width / 750) * CROP_H);
  const buf = await sharp(SRC)
    .extract({ left: 0, top: 0, width: 750, height: CROP_H })
    .resize(width, height, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  return { buf, w: width, h: height };
}

async function roundScreen(screenBuf, w, h, r) {
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  );
  return sharp(screenBuf)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function buildPhone(screenBuf, screenW, screenH) {
  const bezel = 16;
  const topChrome = 48;
  const bottomChrome = 36;
  const corner = 86;
  const screenR = 52;
  const phoneW = screenW + bezel * 2;
  const phoneH = screenH + topChrome + bottomChrome;
  const screenX = bezel;
  const screenY = topChrome;

  const frameSvg = Buffer.from(`
<svg width="${phoneW}" height="${phoneH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="body" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3A3D45"/><stop offset="35%" stop-color="#1C1E24"/><stop offset="100%" stop-color="#0A0B0E"/>
    </linearGradient>
    <linearGradient id="edge" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#8A8E98"/><stop offset="50%" stop-color="#3A3E46"/><stop offset="100%" stop-color="#5A5E66"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="${phoneW - 2}" height="${phoneH - 2}" rx="${corner}" fill="url(#edge)"/>
  <rect x="5" y="5" width="${phoneW - 10}" height="${phoneH - 10}" rx="${corner - 5}" fill="url(#body)"/>
  <rect x="${screenX - 1}" y="${screenY - 1}" width="${screenW + 2}" height="${screenH + 2}" rx="${screenR}" fill="#000"/>
  <rect x="${phoneW / 2 - 98}" y="18" width="196" height="36" rx="18" fill="#000"/>
  <circle cx="${phoneW / 2 + 62}" cy="36" r="5.5" fill="#0C1E28"/>
  <rect x="${phoneW / 2 - 70}" y="${phoneH - 22}" width="140" height="5" rx="2.5" fill="#fff" opacity="0.35"/>
</svg>`);

  const rounded = await roundScreen(screenBuf, screenW, screenH, screenR);
  const phone = await sharp(frameSvg)
    .composite([{ input: rounded, left: screenX, top: screenY }])
    .png()
    .toBuffer();
  const meta = await sharp(phone).metadata();
  return { buf: phone, w: meta.width, h: meta.height };
}

async function scalePhone(phone, maxW) {
  const scale = Math.min(1, maxW / phone.w);
  const pw = Math.round(phone.w * scale);
  const ph = Math.round(phone.h * scale);
  return {
    buf: await sharp(phone.buf).resize(pw, ph).png().toBuffer(),
    w: pw,
    h: ph,
  };
}

function orbs(items) {
  return items
    .map(
      (o, i) => `
  <defs><radialGradient id="orb${i}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${o.c}" stop-opacity="${o.a0 ?? 0.65}"/>
    <stop offset="55%" stop-color="${o.c}" stop-opacity="${o.a1 ?? 0.18}"/>
    <stop offset="100%" stop-color="${o.c}" stop-opacity="0"/>
  </radialGradient></defs>
  <circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="url(#orb${i})"/>`
    )
    .join('');
}

function sparkles(points) {
  return points
    .map(([x, y, s, c = '#fff']) => {
      const half = s / 2;
      return `<g transform="translate(${x},${y})" opacity="0.95">
        <path d="M0,-${half} L${half * 0.22},-${half * 0.22} L${half},0 L${half * 0.22},${half * 0.22} L0,${half} L-${half * 0.22},${half * 0.22} L-${half},0 L-${half * 0.22},-${half * 0.22} Z" fill="${c}"/>
      </g>`;
    })
    .join('');
}

function outlinedText(text, x, y, size, opts = {}) {
  const {
    fill = 'url(#titleGrad)',
    outline = '#000',
    outlineW = 8,
    anchor = 'start',
    shadow = true,
  } = opts;
  let out = '';
  if (shadow) {
    out += `<text x="${x + 3}" y="${y + 8}" text-anchor="${anchor}" font-family="NunitoEmbed,Arial" font-size="${size}" font-weight="800" fill="#000" opacity="0.4">${esc(text)}</text>`;
  }
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    out += `<text x="${x + Math.cos(rad) * outlineW}" y="${y + Math.sin(rad) * outlineW}" text-anchor="${anchor}" font-family="NunitoEmbed,Arial" font-size="${size}" font-weight="800" fill="${outline}">${esc(text)}</text>`;
  }
  out += `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="NunitoEmbed,Arial" font-size="${size}" font-weight="800" fill="${fill}">${esc(text)}</text>`;
  return out;
}

function chip(x, y, label, color) {
  const w = Math.max(160, label.length * 16 + 48);
  return `
  <g transform="translate(${x},${y})">
    <rect x="0" y="0" width="${w}" height="56" rx="28" fill="${color}" opacity="0.95"/>
    <text x="${w / 2}" y="37" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="24" font-weight="800" fill="#0B1220">${esc(label)}</text>
  </g>`;
}

async function phoneReady(maxW = 900) {
  const screen = await croppedScreen(Math.round(maxW * 0.92));
  return scalePhone(await buildPhone(screen.buf, screen.w, screen.h), maxW);
}

const darkBase = `
  <linearGradient id="base" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#060A12"/>
    <stop offset="55%" stop-color="#0A1220"/>
    <stop offset="100%" stop-color="#100A18"/>
  </linearGradient>`;

// ─────────────────────────────────────────────
// F — Giant 70+ Hero
// Huge number dominates top; phone smaller below; different hierarchy
// ─────────────────────────────────────────────
async function styleF() {
  const phone = await phoneReady(880);
  const left = Math.round((W - phone.w) / 2);
  const top = 980;

  const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>${fontFace()}
      .eye{font-family:NunitoEmbed,Arial;font-size:26px;font-weight:800;letter-spacing:8px;fill:#5ECF80}
      .sub{font-family:NunitoEmbed,Arial;font-size:34px;font-weight:700;fill:#A8B8CC}
      .unit{font-family:NunitoEmbed,Arial;font-size:52px;font-weight:800;fill:#fff}
    </style>
    ${darkBase}
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7CFFB2"/>
      <stop offset="50%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#FF8A6A"/>
    </linearGradient>
    <linearGradient id="numGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="40%" stop-color="#7CFFB2"/>
      <stop offset="100%" stop-color="#2EE6A8"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  ${orbs([
    { x: 640, y: 380, r: 420, c: '#2EE6A8', a0: 0.4, a1: 0.08 },
    { x: 200, y: 900, r: 260, c: '#FF5A3C', a0: 0.28, a1: 0.06 },
    { x: 1100, y: 1200, r: 280, c: '#4A90E2', a0: 0.25, a1: 0.05 },
  ])}
  ${sparkles([[180, 160, 28, '#7CFFB2'], [1100, 200, 22, '#FF8A6A'], [200, 700, 18, '#fff'], [1050, 800, 20, '#7CFFB2']])}

  <text x="50%" y="140" text-anchor="middle" class="eye">${esc('STIMPAD')}</text>

  <!-- GIANT number as the design -->
  ${outlinedText('70+', W / 2, 420, 280, { anchor: 'middle', fill: 'url(#numGrad)', outlineW: 14 })}
  <text x="50%" y="520" text-anchor="middle" class="unit">${esc('STIM SOUNDS')}</text>

  <!-- accent underline bars -->
  <rect x="${W / 2 - 180}" y="560" width="360" height="8" rx="4" fill="#5ECF80"/>
  <text x="50%" y="640" text-anchor="middle" class="sub">${esc('Tap into calm, focus & sensory joy')}</text>

  <!-- floating chips -->
  ${chip(70, 720, 'Nature', '#7CFFB2')}
  ${chip(320, 760, 'Haptics', '#FF8A6A')}
  ${chip(900, 720, 'Loops', '#7CB8FF')}
  ${chip(980, 800, 'No ads*', '#FFD36A')}
</svg>`);

  return sharp(bg).composite([{ input: phone.buf, left, top }]).png().toBuffer();
}

// ─────────────────────────────────────────────
// G — Type Behind Phone
// Massive background typography with phone sitting ON TOP of it
// ─────────────────────────────────────────────
async function styleG() {
  const phone = await phoneReady(920);
  const left = Math.round((W - phone.w) / 2);
  const top = 620;

  const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>${fontFace()}
      .eye{font-family:NunitoEmbed,Arial;font-size:24px;font-weight:800;letter-spacing:8px;fill:#5ECF80}
      .sub{font-family:NunitoEmbed,Arial;font-size:30px;font-weight:700;fill:#C8D4E0}
      .ghost{font-family:NunitoEmbed,Arial;font-size:160px;font-weight:800}
    </style>
    ${darkBase}
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#7CFFB2"/>
    </linearGradient>
    <linearGradient id="ghostGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#5ECF80" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#FF6B4A" stop-opacity="0.12"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  ${orbs([
    { x: 180, y: 300, r: 300, c: '#2EE6A8', a0: 0.35, a1: 0.07 },
    { x: 1100, y: 500, r: 320, c: '#FF5A3C', a0: 0.3, a1: 0.06 },
  ])}

  <!-- ghost type BEHIND where phone will sit -->
  <text x="50%" y="900" text-anchor="middle" class="ghost" fill="url(#ghostGrad)">${esc('STIM')}</text>
  <text x="50%" y="1080" text-anchor="middle" class="ghost" fill="url(#ghostGrad)">${esc('PAD')}</text>
  <text x="50%" y="1600" text-anchor="middle" class="ghost" fill="url(#ghostGrad)" opacity="0.7">${esc('PLAY')}</text>

  ${sparkles([[160, 140, 26, '#7CFFB2'], [1120, 180, 22, '#FF8A6A'], [200, 500, 16, '#fff']])}

  <text x="80" y="130" class="eye">${esc('STIMPAD')}</text>
  ${outlinedText('Instant', 80, 280, 96, { outlineW: 8 })}
  ${outlinedText('Calm.', 80, 400, 96, { outlineW: 8 })}
  <text x="80" y="480" class="sub">${esc('Beautiful loops · one-tap playback')}</text>

  <!-- coral pill badge bottom-left of type -->
  <g transform="translate(80,520)">
    <rect width="260" height="52" rx="26" fill="#FF5A3C"/>
    <text x="130" y="35" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="22" font-weight="800" fill="#fff">${esc('70+ SOUNDS')}</text>
  </g>
</svg>`);

  return sharp(bg).composite([{ input: phone.buf, left, top }]).png().toBuffer();
}

// ─────────────────────────────────────────────
// H — Orbit Callouts
// Centered phone with floating feature bubbles orbiting around it
// ─────────────────────────────────────────────
async function styleH() {
  const phone = await phoneReady(820);
  const left = Math.round((W - phone.w) / 2);
  const top = 580;

  const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>${fontFace()}
      .eye{font-family:NunitoEmbed,Arial;font-size:26px;font-weight:800;letter-spacing:8px;fill:#5ECF80}
      .sub{font-family:NunitoEmbed,Arial;font-size:32px;font-weight:700;fill:#A8B8CC}
      .bubble{font-family:NunitoEmbed,Arial;font-size:22px;font-weight:800;fill:#fff}
    </style>
    ${darkBase}
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#7CFFB2"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  ${orbs([
    { x: 640, y: 1200, r: 480, c: '#2EE6A8', a0: 0.3, a1: 0.06 },
    { x: 200, y: 400, r: 240, c: '#FF5A3C', a0: 0.25, a1: 0.05 },
    { x: 1100, y: 500, r: 220, c: '#4A90E2', a0: 0.25, a1: 0.05 },
  ])}

  <!-- concentric orbit rings behind phone area -->
  <circle cx="${W / 2}" cy="${top + phone.h * 0.4}" r="420" fill="none" stroke="#5ECF80" stroke-width="2" opacity="0.25"/>
  <circle cx="${W / 2}" cy="${top + phone.h * 0.4}" r="520" fill="none" stroke="#FF6B4A" stroke-width="2" opacity="0.18"/>
  <circle cx="${W / 2}" cy="${top + phone.h * 0.4}" r="620" fill="none" stroke="#7CB8FF" stroke-width="1.5" opacity="0.12" stroke-dasharray="8 10"/>

  ${sparkles([[180, 160, 24, '#7CFFB2'], [1100, 180, 20, '#FF8A6A'], [140, 900, 16, '#fff'], [1140, 1100, 18, '#7CFFB2']])}

  <text x="50%" y="130" text-anchor="middle" class="eye">${esc('STIMPAD')}</text>
  ${outlinedText('Your Sensory', W / 2, 250, 78, { anchor: 'middle', outlineW: 7 })}
  ${outlinedText('Escape', W / 2, 350, 78, { anchor: 'middle', outlineW: 7 })}
  <text x="50%" y="430" text-anchor="middle" class="sub">${esc('Focus · calm · stim joy')}</text>

  <!-- orbiting feature bubbles (around phone) -->
  <g>
    <circle cx="120" cy="900" r="78" fill="#5ECF80"/>
    <text x="120" y="895" text-anchor="middle" class="bubble" fill="#0B1220">${esc('Haptics')}</text>
    <text x="120" y="922" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="16" font-weight="700" fill="#0B1220">${esc('on tap')}</text>
  </g>
  <g>
    <circle cx="1160" cy="980" r="78" fill="#FF6B4A"/>
    <text x="1160" y="975" text-anchor="middle" class="bubble">${esc('Head')}</text>
    <text x="1160" y="1002" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="16" font-weight="700" fill="#fff">${esc('Flossing')}</text>
  </g>
  <g>
    <circle cx="150" cy="1500" r="72" fill="#7CB8FF"/>
    <text x="150" y="1495" text-anchor="middle" class="bubble" fill="#0B1220">${esc('70+')}</text>
    <text x="150" y="1520" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="16" font-weight="700" fill="#0B1220">${esc('sounds')}</text>
  </g>
  <g>
    <circle cx="1140" cy="1600" r="72" fill="#FFD36A"/>
    <text x="1140" y="1595" text-anchor="middle" class="bubble" fill="#0B1220">${esc('Loops')}</text>
    <text x="1140" y="1620" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="16" font-weight="700" fill="#0B1220">${esc('& pitch')}</text>
  </g>
</svg>`);

  return sharp(bg).composite([{ input: phone.buf, left, top }]).png().toBuffer();
}

// ─────────────────────────────────────────────
// I — Sound Wave Banner
// Horizontal sound-wave graphic as design hero + offset phone
// ─────────────────────────────────────────────
async function styleI() {
  const phone = await phoneReady(860);
  const left = Math.round((W - phone.w) / 2) + 40;
  const top = 780;

  // Build a stylized waveform
  let wave = '';
  const bars = 36;
  for (let i = 0; i < bars; i++) {
    const t = i / (bars - 1);
    const hgt = 40 + Math.sin(t * Math.PI * 3.2) * 90 + Math.sin(t * Math.PI * 7) * 35 + 20;
    const x = 60 + i * 32;
    const y = 520 - hgt / 2;
    const col = i % 3 === 0 ? '#5ECF80' : i % 3 === 1 ? '#FF8A6A' : '#7CB8FF';
    wave += `<rect x="${x}" y="${y}" width="18" height="${hgt}" rx="9" fill="${col}" opacity="0.9"/>`;
  }

  const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>${fontFace()}
      .eye{font-family:NunitoEmbed,Arial;font-size:24px;font-weight:800;letter-spacing:8px;fill:#5ECF80}
      .sub{font-family:NunitoEmbed,Arial;font-size:32px;font-weight:700;fill:#A8B8CC}
    </style>
    ${darkBase}
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="40%" stop-color="#7CFFB2"/>
      <stop offset="100%" stop-color="#FF8A6A"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  ${orbs([
    { x: 300, y: 500, r: 340, c: '#2EE6A8', a0: 0.35, a1: 0.07 },
    { x: 1000, y: 480, r: 300, c: '#FF5A3C', a0: 0.3, a1: 0.06 },
    { x: 640, y: 2000, r: 380, c: '#4A90E2', a0: 0.2, a1: 0.04 },
  ])}
  ${sparkles([[160, 120, 26, '#7CFFB2'], [1120, 150, 22, '#FF8A6A'], [200, 680, 16, '#fff']])}

  <text x="80" y="140" class="eye">${esc('STIMPAD')}</text>
  ${outlinedText('Feel the', 80, 280, 92, { outlineW: 8 })}
  ${outlinedText('Vibe', 80, 400, 110, { outlineW: 9 })}

  <!-- waveform as the design centerpiece -->
  ${wave}

  <!-- capsule tags under wave -->
  <g transform="translate(80,680)">
    <rect width="200" height="48" rx="24" fill="#5ECF80"/>
    <text x="100" y="32" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="20" font-weight="800" fill="#0B1220">${esc('70+ sounds')}</text>
  </g>
  <g transform="translate(300,680)">
    <rect width="180" height="48" rx="24" fill="#1A2438" stroke="#5ECF80" stroke-width="2"/>
    <text x="90" y="32" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="20" font-weight="800" fill="#7CFFB2">${esc('Haptics')}</text>
  </g>
  <g transform="translate(500,680)">
    <rect width="200" height="48" rx="24" fill="#1A2438" stroke="#FF8A6A" stroke-width="2"/>
    <text x="100" y="32" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="20" font-weight="800" fill="#FF8A6A">${esc('One-time $')}</text>
  </g>

  <text x="80" y="780" class="sub">${esc('Calm · focus · sensory joy')}</text>
</svg>`);

  return sharp(bg).composite([{ input: phone.buf, left, top }]).png().toBuffer();
}

// ─────────────────────────────────────────────
// J — Magazine Stack / Layered Cards
// Phone + stacked "feature cards" like a magazine spread
// ─────────────────────────────────────────────
async function styleJ() {
  const phone = await phoneReady(780);
  const left = 90;
  const top = 620;

  const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>${fontFace()}
      .eye{font-family:NunitoEmbed,Arial;font-size:24px;font-weight:800;letter-spacing:7px;fill:#5ECF80}
      .sub{font-family:NunitoEmbed,Arial;font-size:28px;font-weight:700;fill:#A8B8CC}
      .cardT{font-family:NunitoEmbed,Arial;font-size:28px;font-weight:800;fill:#fff}
      .cardS{font-family:NunitoEmbed,Arial;font-size:20px;font-weight:600;fill:#B8C5D6}
    </style>
    ${darkBase}
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#7CFFB2"/>
    </linearGradient>
    <linearGradient id="card1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1A3A30"/><stop offset="100%" stop-color="#0E221C"/>
    </linearGradient>
    <linearGradient id="card2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3A1A18"/><stop offset="100%" stop-color="#220E0C"/>
    </linearGradient>
    <linearGradient id="card3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1A2840"/><stop offset="100%" stop-color="#0E1624"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  ${orbs([
    { x: 200, y: 240, r: 280, c: '#2EE6A8', a0: 0.35, a1: 0.07 },
    { x: 1100, y: 400, r: 300, c: '#FF5A3C', a0: 0.28, a1: 0.06 },
    { x: 900, y: 2000, r: 340, c: '#4A90E2', a0: 0.22, a1: 0.05 },
  ])}
  ${sparkles([[160, 120, 26, '#7CFFB2'], [1120, 160, 22, '#FF8A6A'], [1080, 700, 18, '#fff']])}

  <text x="80" y="130" class="eye">${esc('STIMPAD')}</text>
  ${outlinedText('Stim.', 80, 280, 110, { outlineW: 9 })}
  ${outlinedText('Tap.', 80, 410, 110, { outlineW: 9 })}
  ${outlinedText('Unwind.', 80, 540, 110, { outlineW: 9 })}

  <!-- stacked feature cards on the RIGHT of phone -->
  <g transform="translate(780,700) rotate(-6)">
    <rect width="420" height="150" rx="28" fill="url(#card1)" stroke="#5ECF80" stroke-width="2"/>
    <circle cx="56" cy="75" r="28" fill="#5ECF80"/>
    <text x="56" y="83" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="28" font-weight="800" fill="#0B1220">◎</text>
    <text x="110" y="70" class="cardT">${esc('70+ Sounds')}</text>
    <text x="110" y="105" class="cardS">${esc('Nature to retro tech')}</text>
  </g>
  <g transform="translate(800,900) rotate(4)">
    <rect width="420" height="150" rx="28" fill="url(#card2)" stroke="#FF6B4A" stroke-width="2"/>
    <circle cx="56" cy="75" r="28" fill="#FF6B4A"/>
    <text x="56" y="83" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="26" font-weight="800" fill="#fff">⚡</text>
    <text x="110" y="70" class="cardT">${esc('Sensory Tools')}</text>
    <text x="110" y="105" class="cardS">${esc('Haptics & head flossing')}</text>
  </g>
  <g transform="translate(760,1120) rotate(-3)">
    <rect width="420" height="150" rx="28" fill="url(#card3)" stroke="#7CB8FF" stroke-width="2"/>
    <circle cx="56" cy="75" r="28" fill="#7CB8FF"/>
    <text x="56" y="83" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="26" font-weight="800" fill="#0B1220">★</text>
    <text x="110" y="70" class="cardT">${esc('Save Favorites')}</text>
    <text x="110" y="105" class="cardS">${esc('Your vibes, one tap away')}</text>
  </g>

  <text x="80" y="2650" class="sub">${esc('All sounds · No ads · One purchase')}</text>
</svg>`);

  return sharp(bg).composite([{ input: phone.buf, left, top }]).png().toBuffer();
}

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  // Remove old F–J if present; KEEP C and E
  for (const f of fs.readdirSync(OUT)) {
    if (/^style_[FGHIJ]\.png$/.test(f) || /^style_[1-5]\.png$/.test(f) || f === 'README.txt') {
      try { fs.unlinkSync(path.join(OUT, f)); } catch (_) {}
    }
  }

  const styles = [
    { id: 'F', name: 'Giant 70+ Hero — huge number dominates', fn: styleF },
    { id: 'G', name: 'Type Behind Phone — ghost STIM/PAD under phone', fn: styleG },
    { id: 'H', name: 'Orbit Callouts — rings + feature bubbles', fn: styleH },
    { id: 'I', name: 'Sound Wave Banner — waveform + tags', fn: styleI },
    { id: 'J', name: 'Magazine Stack — phone + tilted feature cards', fn: styleJ },
  ];

  for (const s of styles) {
    console.log(`Rendering style ${s.id}: ${s.name}…`);
    const buf = await s.fn();
    const out = path.join(OUT, `style_${s.id}.png`);
    await sharp(buf).png().toFile(out);
    console.log(`  → ${out}`);
  }

  // Keep C/E visible in readme
  const keep = [
    'style_C.png — Neon Stripe Club (KEPT)',
    'style_E.png — Comic Dark Pop (KEPT)',
    ...styles.map((s) => `style_${s.id}.png — ${s.name}`),
  ];
  fs.writeFileSync(path.join(OUT, 'README.txt'), keep.join('\n') + '\n');
  console.log('Done. C + E kept. New: F–J.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
