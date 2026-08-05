/**
 * Chroma-key neon green (#00FF00-ish) backgrounds to clean alpha PNGs.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-Users-Ultima-Desktop-StimPad",
  "assets"
);
const UI = path.join(ROOT, "assets", "ui");

function isGreenScreen(r, g, b) {
  // Neon green key: green dominant and fairly bright
  if (g < 90) return false;
  if (g <= r + 25) return false;
  if (g <= b + 25) return false;
  // avoid mint button greens that are softer / less saturated
  const sat = g - Math.max(r, b);
  if (sat < 40) return false;
  // pure key green is very high G
  if (g > 180 && sat > 60) return true;
  if (g > 140 && sat > 80) return true;
  if (g > 120 && r < 80 && b < 80) return true;
  return false;
}

async function chromaKey(src, dest) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const w = info.width;
  const h = info.height;
  const out = Buffer.from(data);
  let cleared = 0;
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (!isGreenScreen(r, g, b)) continue;
    // soft edge: if near green but not fully, feather
    const sat = g - Math.max(r, b);
    let a = 0;
    if (sat < 55) a = Math.round(((55 - sat) / 55) * 255);
    out[i + 3] = a;
    if (a === 0) cleared++;
  }
  // flood remaining pure green pockets from edges
  const seen = new Uint8Array(w * h);
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    seen[idx] = 1;
    q.push(idx);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (q.length) {
    const p = q.pop();
    const x = p % w;
    const y = ((p - x) / w) | 0;
    const i = p * 4;
    if (!isGreenScreen(out[i], out[i + 1], out[i + 2]) && out[i + 3] > 10) {
      // also clear near-black leftover canvas
      const max = Math.max(out[i], out[i + 1], out[i + 2]);
      if (!(max < 18 && out[i + 3] > 0)) continue;
    }
    if (isGreenScreen(out[i], out[i + 1], out[i + 2]) || Math.max(out[i], out[i + 1], out[i + 2]) < 18) {
      out[i + 3] = 0;
      cleared++;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(dest);
  console.log(path.basename(dest), "cleared~", cleared, "cornerA", out[3]);
}

async function main() {
  const map = [
    ["paywall_hero_raw.png", "paywall_hero.png"],
    ["paywall_perks_raw.png", "paywall_perks.png"],
    ["btn_unlock_plus_raw.png", "btn_unlock_plus.png"],
  ];
  for (const [from, to] of map) {
    const src = path.join(SRC, from);
    const dest = path.join(UI, to);
    if (!fs.existsSync(src)) {
      console.warn("missing", src);
      continue;
    }
    await chromaKey(src, dest);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
