/**
 * 9:16 thumbnail for YouTube Shorts + Facebook Reels.
 * Output: store/Videos/StimPad_shorts_thumb.png + .jpg  @ 1080×1920
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'store', 'Videos');
const FONT_B64 = fs.readFileSync(path.join(ROOT, 'assets', 'fonts', 'Nunito.ttf')).toString('base64');
const SCREEN = path.join(ROOT, 'store', 'IMG_0012.png');
const WORDMARK = path.join(ROOT, 'assets', 'branding', 'logo_wordmark.png');
const ICON = path.join(ROOT, 'assets', 'branding', 'icon_1024.png');

const W = 1080;
const H = 1920;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fontFace() {
  return `@font-face{font-family:'NunitoEmbed';src:url('data:font/ttf;base64,${FONT_B64}');}`;
}

async function roundRect(buf, w, h, r) {
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  );
  return sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function buildPhone() {
  const srcMeta = await sharp(SCREEN).metadata();
  const cropH = Math.min(srcMeta.height - 170, 1120);
  const screenW = 680;
  const screenH = Math.round((screenW / srcMeta.width) * cropH);
  const screenBuf = await sharp(SCREEN)
    .extract({ left: 0, top: 0, width: srcMeta.width, height: cropH })
    .resize(screenW, screenH, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const bezel = 14;
  const topChrome = 42;
  const bottomChrome = 32;
  const corner = 72;
  const screenR = 44;
  const phoneW = screenW + bezel * 2;
  const phoneH = screenH + topChrome + bottomChrome;
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
  <rect x="${bezel - 1}" y="${topChrome - 1}" width="${screenW + 2}" height="${screenH + 2}" rx="${screenR}" fill="#000"/>
  <rect x="${phoneW / 2 - 86}" y="14" width="172" height="28" rx="14" fill="#000"/>
  <circle cx="${phoneW / 2 + 54}" cy="28" r="4.5" fill="#0C1E28"/>
  <rect x="${phoneW / 2 - 56}" y="${phoneH - 18}" width="112" height="4" rx="2" fill="#fff" opacity="0.32"/>
</svg>`);
  const rounded = await roundRect(screenBuf, screenW, screenH, screenR);
  const buf = await sharp(frameSvg)
    .composite([{ input: rounded, left: bezel, top: topChrome }])
    .png()
    .toBuffer();
  return { buf, w: phoneW, h: phoneH };
}

function outlinedText(text, x, y, size, opts = {}) {
  const { fill = 'url(#titleGrad)', outline = '#000', outlineW = 9, anchor = 'middle' } = opts;
  let out = `<text x="${x + 3}" y="${y + 7}" text-anchor="${anchor}" font-family="NunitoEmbed,Arial" font-size="${size}" font-weight="800" fill="#000" opacity="0.4">${esc(text)}</text>`;
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    out += `<text x="${x + Math.cos(rad) * outlineW}" y="${y + Math.sin(rad) * outlineW}" text-anchor="${anchor}" font-family="NunitoEmbed,Arial" font-size="${size}" font-weight="800" fill="${outline}">${esc(text)}</text>`;
  }
  out += `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="NunitoEmbed,Arial" font-size="${size}" font-weight="800" fill="${fill}">${esc(text)}</text>`;
  return out;
}

async function main() {
  const phone = await buildPhone();
  const phoneLeft = Math.round((W - phone.w) / 2);
  const phoneTop = 455;

  const iconSize = 108;
  const icon = await sharp(ICON)
    .resize(iconSize, iconSize, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const iconRounded = await roundRect(icon, iconSize, iconSize, 24);

  const logoW = 520;
  const logo = await sharp(WORDMARK)
    .resize({ width: logoW, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const headerPad = 18;
  const headerW = iconSize + headerPad + logoMeta.width;
  const headerLeft = Math.round((W - headerW) / 2);
  const logoLeft = headerLeft + iconSize + headerPad;

  const bg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>${fontFace()}</style>
    <linearGradient id="base" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0C1018"/>
      <stop offset="100%" stop-color="#06080C"/>
    </linearGradient>
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#D8E8F8"/>
    </linearGradient>
    <radialGradient id="glowMint" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#1A4A42" stop-opacity="0.85"/>
      <stop offset="60%" stop-color="#0B1220" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#05080C" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowCoral" cx="82%" cy="22%" r="35%">
      <stop offset="0%" stop-color="#5A2A22" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#05080C" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#base)"/>
  <rect width="${W}" height="${H}" fill="url(#glowMint)"/>
  <rect width="${W}" height="${H}" fill="url(#glowCoral)"/>
  ${outlinedText('Instant', 540, 300, 124)}
  ${outlinedText('Calm', 540, 420, 136)}
  <g transform="translate(900, 178) rotate(12)">
    <circle cx="0" cy="0" r="96" fill="#5ECF80"/>
    <circle cx="0" cy="0" r="84" fill="none" stroke="#0B1220" stroke-width="3" stroke-dasharray="8 6"/>
    <text x="0" y="-4" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="40" font-weight="800" fill="#0B1220">70+</text>
    <text x="0" y="34" text-anchor="middle" font-family="NunitoEmbed,Arial" font-size="20" font-weight="800" fill="#0B1220">SOUNDS</text>
  </g>
</svg>`);

  const pngPath = path.join(OUT_DIR, 'StimPad_shorts_thumb.png');
  const jpgPath = path.join(OUT_DIR, 'StimPad_shorts_thumb.jpg');

  await sharp(bg)
    .composite([
      { input: iconRounded, left: headerLeft, top: 92 },
      { input: logo, left: logoLeft, top: 108 },
      { input: phone.buf, left: phoneLeft, top: phoneTop },
    ])
    .png()
    .toFile(pngPath);

  await sharp(pngPath)
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(jpgPath);

  const pngStat = fs.statSync(pngPath);
  const jpgStat = fs.statSync(jpgPath);
  console.log(`PNG  ${pngPath}  ${(pngStat.size / 1024).toFixed(0)} KB`);
  console.log(`JPG  ${jpgPath}  ${(jpgStat.size / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
