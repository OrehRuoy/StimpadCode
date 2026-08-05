/**
 * Build clean StimPad UI icons with real alpha (no baked checkerboards).
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const UI = path.join(ROOT, "assets", "ui");

function heartPath(cx, cy, s) {
  // Classic heart bezier approximate in SVG path units
  const x = cx;
  const y = cy;
  return [
    `M ${x} ${y + s * 0.3}`,
    `C ${x} ${y + s * 0.05}, ${x - s * 0.5} ${y - s * 0.35}, ${x - s * 0.5} ${y - s * 0.05}`,
    `C ${x - s * 0.5} ${y - s * 0.35}, ${x} ${y - s * 0.15}, ${x} ${y + s * 0.05}`,
    `C ${x} ${y - s * 0.15}, ${x + s * 0.5} ${y - s * 0.35}, ${x + s * 0.5} ${y - s * 0.05}`,
    `C ${x + s * 0.5} ${y - s * 0.35}, ${x} ${y + s * 0.05}, ${x} ${y + s * 0.3}`,
    "Z",
  ].join(" ");
}

async function writeFavoriteOn() {
  const size = 512;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#FF8A7A"/>
      <stop offset="55%" stop-color="#FF6B5B"/>
      <stop offset="100%" stop-color="#E84F45"/>
    </radialGradient>
  </defs>
  <path d="${heartPath(256, 250, 210)}" fill="url(#g)"/>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(UI, "icon_favorite_on.png"));
  console.log("wrote icon_favorite_on.png");
}

async function writeFavoriteOff() {
  const size = 512;
  const outer = heartPath(256, 250, 210);
  const inner = heartPath(256, 255, 145);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="stroke" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7EE8D0"/>
      <stop offset="100%" stop-color="#4FC9AE"/>
    </linearGradient>
  </defs>
  <path d="${outer}" fill="url(#stroke)"/>
  <path d="${inner}" fill="#000000" fill-opacity="0"/>
  <!-- cut hole via destination-out simulation: redraw transparent center using mask -->
  <mask id="m">
    <rect width="100%" height="100%" fill="white"/>
    <path d="${inner}" fill="black"/>
  </mask>
  <path d="${outer}" fill="url(#stroke)" mask="url(#m)"/>
</svg>`;
  // Cleaner: stroke-only heart
  const svg2 = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="stroke" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8EF0D8"/>
      <stop offset="100%" stop-color="#45C4A8"/>
    </linearGradient>
  </defs>
  <path d="${outer}" fill="none" stroke="url(#stroke)" stroke-width="42" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;
  await sharp(Buffer.from(svg2)).png().toFile(path.join(UI, "icon_favorite_off.png"));
  console.log("wrote icon_favorite_off.png");
}

/** Punch only near-black / light checkerboard from edges; protect colored subjects + navy tiles. */
async function softPunch(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const out = Buffer.from(data);
  const seen = new Uint8Array(w * h);
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i]) return;
    seen[i] = 1;
    q.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  const isCanvas = (r, g, b, a) => {
    if (a < 18) return true;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const avg = (r + g + b) / 3;
    const sat = max - min;
    // pure/near black canvas only (not navy button fill ~ bluish 30-60)
    if (max <= 22 && sat <= 8) return true;
    // white / light gray / checkerboard light cell
    if (avg >= 205 && sat <= 30) return true;
    if (sat <= 14 && avg >= 145 && avg <= 210) return true;
    return false;
  };
  let cleared = 0;
  while (q.length) {
    const p = q.pop();
    const x = p % w;
    const y = ((p - x) / w) | 0;
    const i = p * 4;
    if (!isCanvas(out[i], out[i + 1], out[i + 2], out[i + 3])) continue;
    out[i + 3] = 0;
    cleared++;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(file);
  console.log("softPunch", path.basename(file), "cleared", cleared);
}

async function main() {
  await writeFavoriteOn();
  await writeFavoriteOff();
  // Re-copy AI hero/perks from cursor assets if present, then soft punch
  const srcDir = path.join(
    process.env.USERPROFILE || "",
    ".cursor",
    "projects",
    "c-Users-Ultima-Desktop-StimPad",
    "assets"
  );
  for (const name of ["paywall_hero.png", "paywall_perks.png"]) {
    const src = path.join(srcDir, name);
    const dest = path.join(UI, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    if (fs.existsSync(dest)) await softPunch(dest);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
