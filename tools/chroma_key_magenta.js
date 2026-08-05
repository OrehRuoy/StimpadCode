/**
 * Chroma-key magenta (#FF00FF-ish) backgrounds — safe for mint UI accents.
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

function isMagenta(r, g, b) {
  // Magenta/fuchsia key: high R and B, low G
  if (g > 120) return false;
  if (r < 140 || b < 140) return false;
  if (r <= g + 40) return false;
  if (b <= g + 40) return false;
  // strong magenta
  if (r > 180 && b > 180 && g < 100) return true;
  if (r > 160 && b > 160 && g < 80) return true;
  return r > 150 && b > 150 && Math.min(r, b) - g > 50;
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
    if (!isMagenta(r, g, b)) continue;
    // feather soft magenta fringe
    const strength = Math.min(r, b) - g;
    let a = 0;
    if (strength < 55) a = Math.round(((55 - strength) / 55) * 180);
    out[i + 3] = a;
    if (a === 0) cleared++;
  }
  // flood remaining magenta / near-black from edges
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
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const max = Math.max(r, g, b);
    if (isMagenta(r, g, b) || max < 18) {
      out[i + 3] = 0;
      cleared++;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
  }
  // clear magenta fringe adjacent to transparent
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (out[i + 3] === 0) continue;
      if (!isMagenta(out[i], out[i + 1], out[i + 2])) continue;
      let nearT = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (out[((y + dy) * w + (x + dx)) * 4 + 3] < 40) nearT = true;
      }
      if (nearT) {
        out[i + 3] = 0;
        cleared++;
      }
    }
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(dest);
  console.log(path.basename(dest), "cleared~", cleared, "cornerA", out[3]);
}

async function main() {
  for (const [from, to] of [
    ["paywall_hero_raw.png", "paywall_hero.png"],
    ["paywall_perks_raw.png", "paywall_perks.png"],
  ]) {
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
