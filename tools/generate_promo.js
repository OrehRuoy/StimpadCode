/**
 * Full App Store promo set in E+I combo style.
 * Output: store/phone/promo_1..6.png @ 1284×2778
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const arg = process.argv[2];
const LOCALE = arg === 'fr' ? 'fr' : arg === 'de' ? 'de' : arg === 'ja' ? 'ja' : arg === 'pt' ? 'pt' : arg === 'es' ? 'es' : 'en';
const OUT = LOCALE === 'fr'
  ? path.join(ROOT, 'store', 'French', 'iphone')
  : LOCALE === 'de'
  ? path.join(ROOT, 'store', 'German', 'iphone')
  : LOCALE === 'ja'
  ? path.join(ROOT, 'store', 'Japanese', 'iphone')
  : LOCALE === 'pt'
  ? path.join(ROOT, 'store', 'Portuguese', 'iphone')
  : LOCALE === 'es'
  ? path.join(ROOT, 'store', 'Spanish', 'iphone')
  : path.join(ROOT, 'store', 'phone');
const FONT = LOCALE === 'ja' ? 'Yu Gothic, Meiryo, MS Gothic, sans-serif' : 'NunitoEmbed,Arial';
const FONT_B64 = fs.readFileSync(path.join(ROOT, 'assets', 'fonts', 'Nunito.ttf')).toString('base64');

const W = 1284;
const H = 2778;
const CROP_H = 1248;

const PROMOS = [
  {
    file: 'IMG_0011.png',
    lines: ['Feel Every', 'Sound'],
    sub: 'Tap into calm, focus & sensory joy',
    tags: [
      { label: '70+ sounds', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Haptics', stroke: '#5ECF80', text: '#7CFFB2' },
      { label: 'Head flossing', stroke: '#FF8A6A', text: '#FF8A6A' },
    ],
    stamp: { top: '70+', bot: 'SOUNDS', color: '#5ECF80' },
  },
  {
    file: 'IMG_0012.png',
    lines: ['Instant', 'Calm'],
    sub: 'Beautiful loops with one-tap playback',
    tags: [
      { label: 'One tap play', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Repeat', stroke: '#7CB8FF', text: '#7CB8FF' },
      { label: 'Favorites', stroke: '#FF8A6A', text: '#FF8A6A' },
    ],
    stamp: { top: 'TAP', bot: 'PLAY', color: '#FF5A3C' },
  },
  {
    file: 'IMG_0013.png',
    lines: ['Find Your', 'Sound'],
    sub: 'Nature, water, retro, noise & more',
    tags: [
      { label: 'Categories', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Filters', stroke: '#7CB8FF', text: '#7CB8FF' },
      { label: 'Discover', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: '12+', bot: 'CATS', color: '#7CB8FF' },
  },
  {
    file: 'IMG_0014.png',
    lines: ['Save Your', 'Favorites'],
    sub: 'Your best vibes, always one tap away',
    tags: [
      { label: 'Favorites', solid: '#FF8A6A', text: '#0B1220' },
      { label: 'Recent', stroke: '#5ECF80', text: '#7CFFB2' },
      { label: 'Quick access', stroke: '#7CB8FF', text: '#7CB8FF' },
    ],
    stamp: { top: '♥', bot: 'SAVED', color: '#FF5A3C' },
  },
  {
    file: 'IMG_0015.png',
    lines: ['Made to', 'Feel Good'],
    sub: 'Haptics, head flossing & pitch control',
    tags: [
      { label: 'Haptics', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Head floss', stroke: '#FF8A6A', text: '#FF8A6A' },
      { label: 'Pitch', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: 'SENSORY', bot: 'TOOLS', color: '#5ECF80' },
  },
  {
    file: 'IMG_0010.png',
    lines: ['Unlock', 'Everything'],
    sub: 'All sounds · No ads · One purchase',
    tags: [
      { label: 'All sounds', solid: '#5ECF80', text: '#0B1220' },
      { label: 'No ads', stroke: '#FF8A6A', text: '#FF8A6A' },
      { label: '$4.99 once', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: 'PLUS', bot: '$4.99', color: '#FF5A3C' },
  },
];

const PROMOS_FR = [
  {
    file: 'IMG_0011.png',
    lines: ['Ressentez', 'chaque son'],
    sub: 'Calme, concentration et plaisir sensoriel',
    tags: [
      { label: '70+ sons', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Haptique', stroke: '#5ECF80', text: '#7CFFB2' },
      { label: 'Balayage stéréo', stroke: '#FF8A6A', text: '#FF8A6A' },
    ],
    stamp: { top: '70+', bot: 'SONS', color: '#5ECF80' },
  },
  {
    file: 'IMG_0012.png',
    lines: ['Calme', 'instantané'],
    sub: 'De belles boucles, en un seul toucher',
    tags: [
      { label: 'Un toucher', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Répéter', stroke: '#7CB8FF', text: '#7CB8FF' },
      { label: 'Favoris', stroke: '#FF8A6A', text: '#FF8A6A' },
    ],
    stamp: { top: 'TOUCHE', bot: 'JOUER', color: '#FF5A3C' },
  },
  {
    file: 'IMG_0013.png',
    lines: ['Trouvez', 'votre son'],
    sub: 'Nature, eau, rétro, bruits et plus',
    tags: [
      { label: 'Catégories', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Filtres', stroke: '#7CB8FF', text: '#7CB8FF' },
      { label: 'Découvrir', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: '12+', bot: 'TYPES', color: '#7CB8FF' },
  },
  {
    file: 'IMG_0014.png',
    lines: ['Gardez vos', 'favoris'],
    sub: 'Vos meilleurs sons, toujours à un toucher',
    tags: [
      { label: 'Favoris', solid: '#FF8A6A', text: '#0B1220' },
      { label: 'Récents', stroke: '#5ECF80', text: '#7CFFB2' },
      { label: 'Accès rapide', stroke: '#7CB8FF', text: '#7CB8FF' },
    ],
    stamp: { top: '♥', bot: 'GARDÉS', color: '#FF5A3C' },
  },
  {
    file: 'IMG_0015.png',
    lines: ['Fait pour', 'du bien'],
    sub: 'Haptique, balayage stéréo et hauteur',
    tags: [
      { label: 'Haptique', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Balayage', stroke: '#FF8A6A', text: '#FF8A6A' },
      { label: 'Hauteur', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: 'SENS', bot: 'OUTILS', color: '#5ECF80' },
  },
  {
    file: 'IMG_0010.png',
    lines: ['Débloquez', 'tout'],
    sub: 'Tous les sons · Sans pub · Un achat',
    tags: [
      { label: 'Tous les sons', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Sans pub', stroke: '#FF8A6A', text: '#FF8A6A' },
      { label: '4,99 $ une fois', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: 'PLUS', bot: '4,99 $', color: '#FF5A3C' },
  },
];

const PROMOS_DE = [
  {
    file: 'IMG_0011.png',
    lines: ['Spür jedes', 'Geräusch'],
    sub: 'Ruhe, Fokus und sensorische Freude',
    tags: [
      { label: '70+ Sounds', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Vibration', stroke: '#5ECF80', text: '#7CFFB2' },
      { label: 'Stereo-Schwenk', stroke: '#FF8A6A', text: '#FF8A6A' },
    ],
    stamp: { top: '70+', bot: 'KLÄNGE', color: '#5ECF80' },
  },
  {
    file: 'IMG_0012.png',
    lines: ['Sofort', 'Ruhe'],
    sub: 'Schöne Loops, mit einem Tipp',
    tags: [
      { label: 'Ein Tipp', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Wiederholen', stroke: '#7CB8FF', text: '#7CB8FF' },
      { label: 'Favoriten', stroke: '#FF8A6A', text: '#FF8A6A' },
    ],
    stamp: { top: 'TIPP', bot: 'LOS', color: '#FF5A3C' },
  },
  {
    file: 'IMG_0013.png',
    lines: ['Finde dein', 'Geräusch'],
    sub: 'Natur, Wasser, Retro, Rauschen',
    tags: [
      { label: 'Kategorien', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Filter', stroke: '#7CB8FF', text: '#7CB8FF' },
      { label: 'Entdecken', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: '12+', bot: 'ARTEN', color: '#7CB8FF' },
  },
  {
    file: 'IMG_0014.png',
    lines: ['Sichere', 'Favoriten'],
    sub: 'Deine besten Sounds, immer griffbereit',
    tags: [
      { label: 'Favoriten', solid: '#FF8A6A', text: '#0B1220' },
      { label: 'Zuletzt', stroke: '#5ECF80', text: '#7CFFB2' },
      { label: 'Schnellzugriff', stroke: '#7CB8FF', text: '#7CB8FF' },
    ],
    stamp: { top: '♥', bot: 'GEMERKT', color: '#FF5A3C' },
  },
  {
    file: 'IMG_0015.png',
    lines: ['Fühlt sich', 'gut an'],
    sub: 'Vibration, Stereo-Schwenk, Tonhöhe',
    tags: [
      { label: 'Vibration', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Schwenk', stroke: '#FF8A6A', text: '#FF8A6A' },
      { label: 'Tonhöhe', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: 'SINNE', bot: 'TOOLS', color: '#5ECF80' },
  },
  {
    file: 'IMG_0010.png',
    lines: ['Schalte', 'alles frei'],
    sub: 'Alle Sounds · Keine Werbung · Ein Kauf',
    tags: [
      { label: 'Alle Sounds', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Keine Werbung', stroke: '#FF8A6A', text: '#FF8A6A' },
      { label: '4,99 $ einmal', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: 'PLUS', bot: '4,99 $', color: '#FF5A3C' },
  },
];

const PROMOS_JA = [
  {
    file: 'IMG_0011.png',
    lines: ['すべての', '音を感じる'],
    sub: '落ち着き、集中、感覚のよろこび',
    tags: [
      { label: '70以上の音', solid: '#5ECF80', text: '#0B1220' },
      { label: '触覚', stroke: '#5ECF80', text: '#7CFFB2' },
      { label: 'ステレオパン', stroke: '#FF8A6A', text: '#FF8A6A' },
    ],
    stamp: { top: '70+', bot: '収録', color: '#5ECF80' },
  },
  {
    file: 'IMG_0012.png',
    lines: ['すぐに', '落ち着く'],
    sub: 'ワンタップで美しいループ',
    tags: [
      { label: 'ワンタップ', solid: '#5ECF80', text: '#0B1220' },
      { label: 'リピート', stroke: '#7CB8FF', text: '#7CB8FF' },
      { label: 'お気に入り', stroke: '#FF8A6A', text: '#FF8A6A' },
    ],
    stamp: { top: 'タップ', bot: '再生', color: '#FF5A3C' },
  },
  {
    file: 'IMG_0013.png',
    lines: ['自分の', '音を探す'],
    sub: '自然、水、レトロ、ノイズ',
    tags: [
      { label: 'カテゴリ', solid: '#5ECF80', text: '#0B1220' },
      { label: '絞り込み', stroke: '#7CB8FF', text: '#7CB8FF' },
      { label: '発見', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: '12+', bot: '種類', color: '#7CB8FF' },
  },
  {
    file: 'IMG_0014.png',
    lines: ['お気に入り', 'を残す'],
    sub: '好きな音が、いつも近くに',
    tags: [
      { label: 'お気に入り', solid: '#FF8A6A', text: '#0B1220' },
      { label: '最近', stroke: '#5ECF80', text: '#7CFFB2' },
      { label: 'すぐ開ける', stroke: '#7CB8FF', text: '#7CB8FF' },
    ],
    stamp: { top: '♥', bot: '保存', color: '#FF5A3C' },
  },
  {
    file: 'IMG_0015.png',
    lines: ['気持ち', 'よくなる'],
    sub: '触覚、ステレオパン、音程',
    tags: [
      { label: '触覚', solid: '#5ECF80', text: '#0B1220' },
      { label: 'パン', stroke: '#FF8A6A', text: '#FF8A6A' },
      { label: '音程', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: '感覚', bot: '機能', color: '#5ECF80' },
  },
  {
    file: 'IMG_0010.png',
    lines: ['すべてを', '解放する'],
    sub: '全音源・広告なし・買い切り',
    tags: [
      { label: '全音源', solid: '#5ECF80', text: '#0B1220' },
      { label: '広告なし', stroke: '#FF8A6A', text: '#FF8A6A' },
      { label: '$4.99', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: 'PLUS', bot: '$4.99', color: '#FF5A3C' },
  },
];

const PROMOS_PT = [
  {
    file: 'IMG_0011.png',
    lines: ['Sinta cada', 'som'],
    sub: 'Calma, foco e alegria sensorial',
    tags: [
      { label: '70+ sons', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Tato', stroke: '#5ECF80', text: '#7CFFB2' },
      { label: 'Varredura estéreo', stroke: '#FF8A6A', text: '#FF8A6A' },
    ],
    stamp: { top: '70+', bot: 'SONS', color: '#5ECF80' },
  },
  {
    file: 'IMG_0012.png',
    lines: ['Calma', 'na hora'],
    sub: 'Loops bonitos, num toque só',
    tags: [
      { label: 'Um toque', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Repetir', stroke: '#7CB8FF', text: '#7CB8FF' },
      { label: 'Favoritos', stroke: '#FF8A6A', text: '#FF8A6A' },
    ],
    stamp: { top: 'TOQUE', bot: 'JÁ', color: '#FF5A3C' },
  },
  {
    file: 'IMG_0013.png',
    lines: ['Ache o seu', 'som'],
    sub: 'Natureza, água, retrô e ruído',
    tags: [
      { label: 'Categorias', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Filtros', stroke: '#7CB8FF', text: '#7CB8FF' },
      { label: 'Descobrir', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: '12+', bot: 'TIPOS', color: '#7CB8FF' },
  },
  {
    file: 'IMG_0014.png',
    lines: ['Guarde', 'favoritos'],
    sub: 'Seus melhores sons, sempre à mão',
    tags: [
      { label: 'Favoritos', solid: '#FF8A6A', text: '#0B1220' },
      { label: 'Recentes', stroke: '#5ECF80', text: '#7CFFB2' },
      { label: 'Acesso rápido', stroke: '#7CB8FF', text: '#7CB8FF' },
    ],
    stamp: { top: '♥', bot: 'SALVO', color: '#FF5A3C' },
  },
  {
    file: 'IMG_0015.png',
    lines: ['Feito para', 'sentir bem'],
    sub: 'Tato, varredura estéreo e tom',
    tags: [
      { label: 'Tato', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Varredura', stroke: '#FF8A6A', text: '#FF8A6A' },
      { label: 'Tom', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: 'SENTIR', bot: 'BEM', color: '#5ECF80' },
  },
  {
    file: 'IMG_0010.png',
    lines: ['Libere', 'tudo'],
    sub: 'Todos os sons · Sem anúncios · 1 compra',
    tags: [
      { label: 'Todos os sons', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Sem anúncios', stroke: '#FF8A6A', text: '#FF8A6A' },
      { label: 'US$ 4,99', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: 'PLUS', bot: '$4.99', color: '#FF5A3C' },
  },
];

const PROMOS_ES = [
  {
    file: 'IMG_0011.png',
    lines: ['Siente', 'cada sonido'],
    sub: 'Calma, enfoque y gusto sensorial',
    tags: [
      { label: '70+ sonidos', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Háptica', stroke: '#5ECF80', text: '#7CFFB2' },
      { label: 'Balanceo estéreo', stroke: '#FF8A6A', text: '#FF8A6A' },
    ],
    stamp: { top: '70+', bot: 'SONIDOS', color: '#5ECF80' },
  },
  {
    file: 'IMG_0012.png',
    lines: ['Calma', 'al toque'],
    sub: 'Loops suaves, de un toque',
    tags: [
      { label: 'Un toque', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Repetir', stroke: '#7CB8FF', text: '#7CB8FF' },
      { label: 'Favoritos', stroke: '#FF8A6A', text: '#FF8A6A' },
    ],
    stamp: { top: 'TOQUE', bot: 'YA', color: '#FF5A3C' },
  },
  {
    file: 'IMG_0013.png',
    lines: ['Busca tu', 'sonido'],
    sub: 'Naturaleza, agua, retro y ruido',
    tags: [
      { label: 'Categorías', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Filtros', stroke: '#7CB8FF', text: '#7CB8FF' },
      { label: 'Descubre', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: '12+', bot: 'TIPOS', color: '#7CB8FF' },
  },
  {
    file: 'IMG_0014.png',
    lines: ['Guarda', 'favoritos'],
    sub: 'Tus mejores sonidos, a la mano',
    tags: [
      { label: 'Favoritos', solid: '#FF8A6A', text: '#0B1220' },
      { label: 'Recientes', stroke: '#5ECF80', text: '#7CFFB2' },
      { label: 'Acceso rápido', stroke: '#7CB8FF', text: '#7CB8FF' },
    ],
    stamp: { top: '♥', bot: 'GUARDÉ', color: '#FF5A3C' },
  },
  {
    file: 'IMG_0015.png',
    lines: ['Hecho para', 'estar bien'],
    sub: 'Háptica, balanceo estéreo y tono',
    tags: [
      { label: 'Háptica', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Balanceo', stroke: '#FF8A6A', text: '#FF8A6A' },
      { label: 'Tono', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: 'SENTIR', bot: 'BIEN', color: '#5ECF80' },
  },
  {
    file: 'IMG_0010.png',
    lines: ['Desbloquea', 'todo'],
    sub: '95 sonidos · Sin anuncios · Un pago',
    tags: [
      { label: 'Todo el audio', solid: '#5ECF80', text: '#0B1220' },
      { label: 'Sin anuncios', stroke: '#FF8A6A', text: '#FF8A6A' },
      { label: 'US$ 4.99', stroke: '#FFD36A', text: '#FFD36A' },
    ],
    stamp: { top: 'PLUS', bot: '$4.99', color: '#FF5A3C' },
  },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fontFace() {
  return `@font-face{font-family:'NunitoEmbed';src:url('data:font/ttf;base64,${FONT_B64}');}`;
}

async function croppedScreen(src, width) {
  const height = Math.round((width / 750) * CROP_H);
  const buf = await sharp(src)
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
  const { fill = 'url(#titleGrad)', outline = '#000', outlineW = 10, anchor = 'start' } = opts;
  let out = `<text x="${x + 3}" y="${y + 8}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="800" fill="#000" opacity="0.45">${esc(text)}</text>`;
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    out += `<text x="${x + Math.cos(rad) * outlineW}" y="${y + Math.sin(rad) * outlineW}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="800" fill="${outline}">${esc(text)}</text>`;
  }
  out += `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="800" fill="${fill}">${esc(text)}</text>`;
  return out;
}

function stampBadge(cx, cy, top, bot, rot, color) {
  const darkText = color === '#5ECF80' || color === '#7CB8FF' || color === '#FFD36A';
  const fill = darkText ? '#0B1220' : '#fff';
  const topSize = top.length > 4 ? 20 : 32;
  return `
  <g transform="translate(${cx},${cy}) rotate(${rot})">
    <circle cx="0" cy="0" r="82" fill="${color}"/>
    <circle cx="0" cy="0" r="72" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="7 6"/>
    <text x="0" y="-4" text-anchor="middle" font-family="${FONT}" font-size="${topSize}" font-weight="800" fill="${fill}">${esc(top)}</text>
    <text x="0" y="28" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="800" fill="${fill}">${esc(bot)}</text>
  </g>`;
}

function makeWave() {
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
  return wave;
}

function makeTags(tags) {
  let x = 80;
  let out = '';
  for (const t of tags) {
    const wide = [...t.label].some((ch) => ch.charCodeAt(0) > 255);
    const unit = wide ? 24 : 15;
    const w = Math.max(wide ? 180 : 160, [...t.label].length * unit + (wide ? 56 : 48));
    if (t.solid) {
      out += `<g transform="translate(${x},680)">
        <rect width="${w}" height="48" rx="24" fill="${t.solid}"/>
        <text x="${w / 2}" y="32" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="800" fill="${t.text}">${esc(t.label)}</text>
      </g>`;
    } else {
      out += `<g transform="translate(${x},680)">
        <rect width="${w}" height="48" rx="24" fill="#1A2438" stroke="${t.stroke}" stroke-width="2"/>
        <text x="${w / 2}" y="32" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="800" fill="${t.text}">${esc(t.label)}</text>
      </g>`;
    }
    x += w + 20;
  }
  return out;
}

async function processOne(promo, index) {
  const src = path.join(ROOT, 'store', promo.file);
  const out = path.join(OUT, `promo_${index + 1}.png`);
  console.log(`Building promo_${index + 1} (${promo.lines.join(' ')})…`);

  const screen = await croppedScreen(src, 860);
  const phoneRaw = await buildPhone(screen.buf, screen.w, screen.h);
  const phone = await scalePhone(phoneRaw, 920);
  const left = Math.round((W - phone.w) / 2);
  const top = 820;

  const line1Size = promo.lines[0].length > 10 ? 96 : 108;
  const line2Size = promo.lines[1].length > 10 ? 100 : 112;

  const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>${fontFace()}
      .eye{font-family:${FONT};font-size:24px;font-weight:800;letter-spacing:7px;fill:#5ECF80}
      .sub{font-family:${FONT};font-size:30px;font-weight:700;fill:#9AABBC}
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
  <g opacity="0.14" transform="rotate(-20 642 900)">
    <rect x="-200" y="180" width="1800" height="36" fill="#5ECF80"/>
    <rect x="-200" y="280" width="1800" height="16" fill="#FF5A3C"/>
    <rect x="-200" y="360" width="1800" height="50" fill="#fff"/>
    <rect x="-200" y="480" width="1800" height="20" fill="#5ECF80"/>
    <rect x="-200" y="1350" width="1800" height="40" fill="#fff"/>
    <rect x="-200" y="1500" width="1800" height="18" fill="#FF5A3C"/>
    <rect x="-200" y="1950" width="1800" height="55" fill="#5ECF80"/>
  </g>
  ${sparkles([
    [150, 110, 30, '#fff'],
    [1120, 150, 26, '#5ECF80'],
    [220, 700, 18, '#FF8A6A'],
    [1060, 740, 20, '#fff'],
  ])}
  ${stampBadge(1040, 145, promo.stamp.top, promo.stamp.bot, 10, promo.stamp.color)}
  <text x="80" y="140" class="eye">${esc('STIMPAD')}</text>
  ${outlinedText(promo.lines[0], 80, 290, line1Size, { outlineW: 10 })}
  ${outlinedText(promo.lines[1], 80, 420, line2Size, { outlineW: 10 })}
  ${makeWave()}
  ${makeTags(promo.tags)}
  <text x="80" y="780" class="sub">${esc(promo.sub)}</text>
</svg>`);

  await sharp(bg)
    .composite([{ input: phone.buf, left, top }])
    .png()
    .toFile(out);
  console.log(`  → ${out}`);
}

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const promos = LOCALE === 'fr' ? PROMOS_FR : LOCALE === 'de' ? PROMOS_DE : LOCALE === 'ja' ? PROMOS_JA : LOCALE === 'pt' ? PROMOS_PT : LOCALE === 'es' ? PROMOS_ES : PROMOS;
  for (let i = 0; i < promos.length; i++) {
    await processOne(promos[i], i);
  }
  console.log('Done — 6 promos in E+I style.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
