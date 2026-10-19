/**
 * Combo preview: E (Comic Dark Pop) + I (Sound Wave Banner)
 * Output: store/phone/styles/style_E_I.png
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
  return { buf: await sharp(phone.buf).resize(pw, ph).png().toBuffer(), w: pw, h: ph };
}

function orbs(items) {
  return items.map((o, i) => `
  <defs><radialGradient id="orb${i}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${o.c}" stop-opacity="${o.a0 ?? 0.65}"/>
    <stop offset="55%" stop-color="${o.c}" stop-opacity="${o.a1 ?? 0.18}"/>
    <stop offset="100%" stop-color="${o.c}" stop-opacity="0"/>
  </radialGradient></defs>
  <circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="url(#orb${i})"/>`).join('');
}

function sparkles(points) {
  return points.map(([x, y, s, c = '#fff']) => {
    const half = s / 2;
    return `<g transform="translate(${x},${y})" opacity="0.95">
      <path d="M0,-${half} L${half * 0.22},-${half * 0.22} L${half},0 L${half * 0.22},${half * 0.22} L0,${half} L-${half * 0.22},${half * 0.22} L-${half},0 L-${half * 0.22},-${half * 0.22} Z" fill="${c}"/>
    </g>`;
  }).join('');
}

function outlinedText(text, x, y, size, opts = {}) {
  const { fill = 'url(#titleGrad)', outline = '#000', outlineW = 10, anchor = 'start' } = opts;
  let out = `<text x="${x + 3}" y="${y + 8}" text-anchor="${anchor}" font-family="NunitoEmbed,Arial" font-size="${size}" font-weight="800" fill="#000" opacity="0.45">${esc(text)}</text>`;
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    out += `<text x="${x + Math.cos(rad) * outlineW}" y="${y + Math.sin(rad) * outlineW}" text-anchor="${anchor}" font-family="NunitoEmbed,Arial" font-size="${size}" font-weight="800" fill="${outline}">${esc(text)}</text>`;
  }
  out += `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="NunitoEmbed,Arial" font-size="${size}" font-weight="800" fill="${fill}">${esc(text)}</text>`;
  return out;
}

function stampBadge(cx, cy, top, bot, rot = 10, color = '#5ECF80') {
  return `
  <g transform="translate(${cx},${cy}) rotate(${rot})">
    <circle cx="0" cy="0" r="82" fill="${color}"/>
    <circle cx="0" cy="0" r="72" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="7 6"/>
    <text x="0" y="-4" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="32" font-weight="800" fill="${color === '#5ECF80' ? '#0B1220' : '#fff'}">${esc(top)}</text>
    <text x="0" y="28" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="18" font-weight="800" fill="${color === '#5ECF80' ? '#0B1220' : '#fff'}">${esc(bot)}</text>
  </g>`;
}

async function main() {
  const screen = await croppedScreen(860);
  const phoneRaw = await buildPhone(screen.buf, screen.w, screen.h);
  const phone = await scalePhone(phoneRaw, 920);
  const left = Math.round((W - phone.w) / 2);
  const top = 820;

  // Waveform from style I
  let wave = '';
  const bars = 36;
  for (let i = 0; i < bars; i++) {
    const t = i / (bars - 1);
    const hgt = 36 + Math.sin(t * Math.PI * 3.2) * 80 + Math.sin(t * Math.PI * 7) * 30 + 18;
    const x = 60 + i * 32;
    const y = 560 - hgt / 2;
    const col = i % 3 === 0 ? '#5ECF80' : i % 3 === 1 ? '#FF8A6A' : '#7CB8FF';
    wave += `<rect x="${x}" y="${y}" width="18" height="${hgt}" rx="9" fill="${col}" opacity="0.92"/>`;
  }

  const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>${fontFace()}
      .eye{font-family:NunitoEmbed,Arial;font-size:24px;font-weight:800;letter-spacing:7px;fill:#5ECF80}
      .sub{font-family:NunitoEmbed,Arial;font-size:30px;font-weight:700;fill:#9AABBC}
    </style>
    <linearGradient id="base" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0C0E14"/>
      <stop offset="100%" stop-color="#06070C"/>
    </linearGradient>
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#D8E8F8"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  ${orbs([
    { x: 200, y: 280, r: 260, c: '#5ECF80', a0: 0.3, a1: 0.06 },
    { x: 1100, y: 260, r: 250, c: '#FF5A3C', a0: 0.32, a1: 0.07 },
    { x: 640, y: 560, r: 360, c: '#4A90E2', a0: 0.18, a1: 0.04 },
    { x: 900, y: 1900, r: 300, c: '#4A90E2', a0: 0.16, a1: 0.04 },
  ])}

  <!-- E comic stripes -->
  <g opacity="0.14" transform="rotate(-20 642 900)">
    <rect x="-200" y="180" width="1800" height="36" fill="#5ECF80"/>
    <rect x="-200" y="280" width="1800" height="16" fill="#FF5A3C"/>
    <rect x="-200" y="360" width="1800" height="50" fill="#fff"/>
    <rect x="-200" y="480" width="1800" height="20" fill="#5ECF80"/>
    <rect x="-200" y="1350" width="1800" height="40" fill="#fff"/>
    <rect x="-200" y="1500" width="1800" height="18" fill="#FF5A3C"/>
    <rect x="-200" y="1950" width="1800" height="55" fill="#5ECF80"/>
  </g>

  ${sparkles([[150, 110, 30, '#fff'], [1120, 150, 26, '#5ECF80'], [220, 700, 18, '#FF8A6A'], [1060, 740, 20, '#fff']])}
  ${stampBadge(1040, 145, '70+', 'SOUNDS', 10, '#5ECF80')}

  <text x="80" y="140" class="eye">${esc('STIMPAD')}</text>
  ${outlinedText('Feel Every', 80, 290, 108, { outlineW: 10 })}
  ${outlinedText('Sound', 80, 420, 112, { outlineW: 10 })}

  <!-- I waveform -->
  ${wave}

  <!-- I-style tags under wave -->
  <g transform="translate(80,680)">
    <rect width="200" height="48" rx="24" fill="#5ECF80"/>
    <text x="100" y="32" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="20" font-weight="800" fill="#0B1220">${esc('70+ sounds')}</text>
  </g>
  <g transform="translate(300,680)">
    <rect width="180" height="48" rx="24" fill="#1A2438" stroke="#5ECF80" stroke-width="2"/>
    <text x="90" y="32" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="20" font-weight="800" fill="#7CFFB2">${esc('Haptics')}</text>
  </g>
  <g transform="translate(500,680)">
    <rect width="220" height="48" rx="24" fill="#1A2438" stroke="#FF8A6A" stroke-width="2"/>
    <text x="110" y="32" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="20" font-weight="800" fill="#FF8A6A">${esc('Head flossing')}</text>
  </g>

  <text x="80" y="780" class="sub">${esc('Tap into calm, focus & sensory joy')}</text>
</svg>`);

  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, 'style_E_I.png');
  await sharp(bg)
    .composite([{ input: phone.buf, left, top }])
    .png()
    .toFile(out);
  console.log('Wrote', out);
}

main().catch((e) => { console.error(e); process.exit(1); });
